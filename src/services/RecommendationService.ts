import { prisma } from "@/lib/db";
import { AppError } from "@/lib/AppError";
import { AuditService } from "@/services/AuditService";
import { computeEligiblePairs, rankAndCap } from "@/services/PairingEngine";
import { hashPhone, normalisePhone } from "@/lib/crypto";
import { getWhatsAppAdapter } from "@/adapters";
import type { chapters, recommendations, recommendation_runs } from "@prisma/client";
import type { PairCandidate } from "@/types/recommendation";

// Counters tracked during a run cycle
let pairsSent = 0;
let pairsSkipped = 0;

// ──────────────────────────────────────────────
// Quiet Hours check
// ──────────────────────────────────────────────
function isQuietHours(chapter: chapters): boolean {
  const tz = chapter.timezone ?? "Asia/Kolkata";
  // Get current time in chapter timezone
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0");
  const currentMinutes = hour * 60 + minute;

  const [startH, startM] = chapter.quiet_start.split(":").map(Number);
  const [endH, endM] = chapter.quiet_end.split(":").map(Number);
  const quietStart = startH * 60 + startM; // e.g. 21:00 = 1260
  const quietEnd = endH * 60 + endM;       // e.g. 07:00 = 420

  // Quiet hours can span midnight (e.g. 21:00 - 07:00)
  if (quietStart > quietEnd) {
    // e.g. 21:00-07:00 → quiet if >= 21:00 OR < 07:00
    return currentMinutes >= quietStart || currentMinutes < quietEnd;
  }
  // e.g. 23:00-23:30 → quiet if >= 23:00 AND < 23:30
  return currentMinutes >= quietStart && currentMinutes < quietEnd;
}

// ──────────────────────────────────────────────
// runRecommendationCycle
// ──────────────────────────────────────────────
export async function runRecommendationCycle(
  chapterId: string,
  triggerType: "POST_MEETING" | "SCHEDULED" | "MANUAL",
  meetingId?: string
): Promise<recommendation_runs> {
  // 1. Create run record
  const run = await prisma.recommendation_runs.create({
    data: {
      chapter_id: chapterId,
      trigger_type: triggerType,
      meeting_id: meetingId ?? null,
      status: "RUNNING",
    },
  });

  try {
    // 2. Load chapter settings
    const chapter = await prisma.chapters.findUniqueOrThrow({
      where: { chapter_id: chapterId },
    });

    // 3. Compute eligible pairs
    const allPairs = await computeEligiblePairs(chapterId, chapter);

    // 4. Rank and cap
    const cappedPairs = rankAndCap(allPairs, chapter.max_recs_per_cycle);

    // 5. Dispatch each pair (skip WhatsApp if quiet hours)
    pairsSent = 0;
    pairsSkipped = 0;
    const quiet = isQuietHours(chapter);
    if (quiet) {
      console.log(`[RecommendationService] Quiet hours active (${chapter.quiet_start}-${chapter.quiet_end}) — pairs will be QUEUED, WhatsApp deferred`);
    }

    for (const pair of cappedPairs) {
      await createAndDispatch(pair, run.run_id, chapter, quiet);
    }

    // 5b. Also dispatch any previously QUEUED recs (from quiet hours or reinstate)
    if (!quiet) {
      const queuedRecs = await prisma.recommendations.findMany({
        where: {
          chapter_id: chapterId,
          status: "QUEUED",
          OR: [{ run_id: null }, { run_id: { not: run.run_id } }],
        },
      });
      if (queuedRecs.length > 0) {
        console.log(`[RecommendationService] Dispatching ${queuedRecs.length} previously QUEUED recs`);
        for (const qRec of queuedRecs) {
          await dispatchQueued(qRec, chapter);
        }
      }
    }

    // 6. Update run: COMPLETED
    return prisma.recommendation_runs.update({
      where: { run_id: run.run_id },
      data: {
        status: "COMPLETED",
        pairs_evaluated: allPairs.length,
        pairs_sent: pairsSent,
        pairs_skipped: pairsSkipped,
        completed_at: new Date(),
      },
    });
  } catch (err) {
    // 7. On error: FAILED
    await prisma.recommendation_runs.update({
      where: { run_id: run.run_id },
      data: {
        status: "FAILED",
        error_detail: err instanceof Error ? err.message : String(err),
        completed_at: new Date(),
      },
    });
    throw err;
  }
}

// ──────────────────────────────────────────────
// createAndDispatch
// ──────────────────────────────────────────────
async function createAndDispatch(
  pair: PairCandidate,
  runId: string,
  chapter: chapters,
  quiet: boolean = false
): Promise<void> {
  const aId =
    pair.member_a.member_id < pair.member_b.member_id
      ? pair.member_a.member_id
      : pair.member_b.member_id;
  const bId =
    pair.member_a.member_id < pair.member_b.member_id
      ? pair.member_b.member_id
      : pair.member_a.member_id;

  // 1. Check for existing active rec (prevent duplicates)
  const existing = await prisma.recommendations.findFirst({
    where: {
      member_a_id: aId,
      member_b_id: bId,
      status: { in: ["QUEUED", "SENT"] },
    },
  });

  if (existing) {
    pairsSkipped++;
    return;
  }

  // 2. Insert recommendation
  const rec = await prisma.recommendations.create({
    data: {
      chapter_id: chapter.chapter_id,
      member_a_id: aId,
      member_b_id: bId,
      run_id: runId,
      status: "QUEUED",
    },
  });

  // 2b. If quiet hours, leave as QUEUED — will be sent on next non-quiet run
  if (quiet) {
    pairsSent++;
    return;
  }

  // 3. Send via WhatsApp
  try {
    const adapter = getWhatsAppAdapter();
    const templateName = process.env.WHATSAPP_TEMPLATE_NAME ?? "hello_world";
    const buildComponents = (from: typeof pair.member_a, to: typeof pair.member_b) =>
      templateName === "hello_world" ? [] : [
        {
          type: "body" as const,
          parameters: [
            { type: "text" as const, text: from.full_name },
            { type: "text" as const, text: to.full_name },
            { type: "text" as const, text: to.biz_category },
            { type: "text" as const, text: to.intro_text ?? to.one_line_summary },
            { type: "text" as const, text: to.office_address },
            { type: "text" as const, text: `https://www.google.com/maps?q=${encodeURIComponent(to.office_address)}` },
            { type: "text" as const, text: to.one_line_summary },
            { type: "text" as const, text: chapter.chapter_name },
          ],
        },
      ];

    // Send to both — catch individual failures so one bad number doesn't block the rec
    let msgIdA = "send_failed";
    let msgIdB = "send_failed";

    try {
      const resA = await adapter.sendTemplate({
        to: pair.member_a.whatsapp, templateName, language: "en_US",
        components: buildComponents(pair.member_a, pair.member_b),
      });
      msgIdA = resA.messageId;
    } catch (err) {
      console.error(`[WhatsApp] Failed to send to ${pair.member_a.full_name}:`, (err as Error).message);
    }

    try {
      const resB = await adapter.sendTemplate({
        to: pair.member_b.whatsapp, templateName, language: "en_US",
        components: buildComponents(pair.member_b, pair.member_a),
      });
      msgIdB = resB.messageId;
    } catch (err) {
      console.error(`[WhatsApp] Failed to send to ${pair.member_b.full_name}:`, (err as Error).message);
    }

    const waResult = { msgIdA, msgIdB };

    // 4. Update to SENT
    await prisma.recommendations.update({
      where: { rec_id: rec.rec_id },
      data: {
        status: "SENT",
        wa_msg_id_a: waResult.msgIdA,
        wa_msg_id_b: waResult.msgIdB,
        sent_at: new Date(),
        send_attempts: 1,
      },
    });
    pairsSent++;
  } catch {
    // 5. Increment send_attempts
    const updated = await prisma.recommendations.update({
      where: { rec_id: rec.rec_id },
      data: { send_attempts: { increment: 1 } },
    });

    if (updated.send_attempts >= 2) {
      console.error(
        `[RecommendationService] Failed to send rec ${rec.rec_id} after ${updated.send_attempts} attempts`
      );
    }
    pairsSkipped++;
  }
}

// ──────────────────────────────────────────────
// dispatchQueued — send WhatsApp for a previously QUEUED rec
// ──────────────────────────────────────────────
async function dispatchQueued(
  rec: recommendations,
  chapter: chapters
): Promise<void> {
  try {
    const adapter = getWhatsAppAdapter();
    const templateName = process.env.WHATSAPP_TEMPLATE_NAME ?? "hello_world";
    const memberA = await prisma.members.findUniqueOrThrow({ where: { member_id: rec.member_a_id } });
    const memberB = await prisma.members.findUniqueOrThrow({ where: { member_id: rec.member_b_id } });
    const { decrypt } = await import("@/lib/crypto");
    const decA = { full_name: memberA.full_name, whatsapp: decrypt(Buffer.from(memberA.whatsapp_enc)), biz_category: memberA.biz_category, one_line_summary: memberA.one_line_summary, intro_text: memberA.intro_text, office_address: memberA.office_address };
    const decB = { full_name: memberB.full_name, whatsapp: decrypt(Buffer.from(memberB.whatsapp_enc)), biz_category: memberB.biz_category, one_line_summary: memberB.one_line_summary, intro_text: memberB.intro_text, office_address: memberB.office_address };

    const buildComponents = (from: typeof decA, to: typeof decA) =>
      templateName === "hello_world" ? [] : [
        { type: "body" as const, parameters: [
          { type: "text" as const, text: from.full_name },
          { type: "text" as const, text: to.full_name },
          { type: "text" as const, text: to.biz_category },
          { type: "text" as const, text: to.intro_text ?? to.one_line_summary },
          { type: "text" as const, text: to.office_address },
          { type: "text" as const, text: `https://www.google.com/maps?q=${encodeURIComponent(to.office_address)}` },
          { type: "text" as const, text: to.one_line_summary },
          { type: "text" as const, text: chapter.chapter_name },
        ]},
      ];

    let msgIdA = "send_failed";
    let msgIdB = "send_failed";

    try {
      const resA = await adapter.sendTemplate({ to: decA.whatsapp, templateName, language: "en_US", components: buildComponents(decA, decB) });
      msgIdA = resA.messageId;
    } catch (err) { console.error(`[WhatsApp] Queued send failed for ${decA.full_name}:`, (err as Error).message); }

    try {
      const resB = await adapter.sendTemplate({ to: decB.whatsapp, templateName, language: "en_US", components: buildComponents(decB, decA) });
      msgIdB = resB.messageId;
    } catch (err) { console.error(`[WhatsApp] Queued send failed for ${decB.full_name}:`, (err as Error).message); }

    await prisma.recommendations.update({
      where: { rec_id: rec.rec_id },
      data: { status: "SENT", wa_msg_id_a: msgIdA, wa_msg_id_b: msgIdB, sent_at: new Date(), send_attempts: 1 },
    });
    console.log(`[RecommendationService] Dispatched queued rec ${rec.rec_id}`);
  } catch (err) {
    console.error(`[RecommendationService] Failed to dispatch queued rec ${rec.rec_id}:`, err);
  }
}

// ──────────────────────────────────────────────
// completeRecommendation
// ──────────────────────────────────────────────
export async function completeRecommendation(
  recId: string,
  confirmedByMemberId: string,
  interactionDate: Date,
  notes: string | undefined,
  source: string,
  actorId: string,
  actorRole: string
): Promise<void> {
  // 1. Load rec
  const rec = await prisma.recommendations.findUnique({
    where: { rec_id: recId },
  });
  if (!rec) throw new AppError("RECOMMENDATION_NOT_FOUND", 404);

  // 2. Check status
  if (rec.status === "COMPLETED") {
    throw new AppError("RECOMMENDATION_ALREADY_COMPLETED", 409);
  }

  // 3. Transaction: insert interaction + update rec
  const aId = rec.member_a_id < rec.member_b_id ? rec.member_a_id : rec.member_b_id;
  const bId = rec.member_a_id < rec.member_b_id ? rec.member_b_id : rec.member_a_id;

  await prisma.$transaction([
    prisma.member_interactions.create({
      data: {
        chapter_id: rec.chapter_id,
        member_a_id: aId,
        member_b_id: bId,
        interaction_date: interactionDate,
        source,
        confirmed_by: confirmedByMemberId,
        rec_id: recId,
        notes: notes ?? null,
      },
    }),
    prisma.recommendations.update({
      where: { rec_id: recId },
      data: { status: "COMPLETED", completed_at: new Date() },
    }),
  ]);

  // 4. Audit
  await AuditService.log({
    entityType: "recommendations",
    entityId: recId,
    operation: "COMPLETE",
    fieldName: "status",
    oldValue: rec.status,
    newValue: `COMPLETED (interaction: ${interactionDate.toISOString()})`,
    actorId,
    actorRole,
    source: "API",
  });
}

// ──────────────────────────────────────────────
// excludePair
// ──────────────────────────────────────────────
export async function excludePair(
  recId: string,
  reason: string,
  actorId: string,
  actorRole: string
): Promise<void> {
  const rec = await prisma.recommendations.findUnique({
    where: { rec_id: recId },
  });
  if (!rec) throw new AppError("RECOMMENDATION_NOT_FOUND", 404);

  await prisma.recommendations.update({
    where: { rec_id: recId },
    data: {
      status: "EXCLUDED",
      excluded_at: new Date(),
      excluded_by: actorId,
      excluded_reason: reason,
    },
  });

  await AuditService.log({
    entityType: "recommendations",
    entityId: recId,
    operation: "EXCLUDE",
    newValue: reason,
    actorId,
    actorRole,
    source: "API",
  });
}

// ──────────────────────────────────────────────
// reinstateRecommendation
// ──────────────────────────────────────────────
export async function reinstateRecommendation(
  recId: string,
  actorId: string,
  actorRole: string
): Promise<void> {
  const rec = await prisma.recommendations.findUnique({
    where: { rec_id: recId },
  });
  if (!rec) throw new AppError("RECOMMENDATION_NOT_FOUND", 404);
  if (rec.status !== "EXCLUDED") {
    throw new AppError("RECOMMENDATION_NOT_EXCLUDED", 409);
  }

  await prisma.recommendations.update({
    where: { rec_id: recId },
    data: {
      status: "QUEUED",
      excluded_at: null,
      excluded_by: null,
      excluded_reason: null,
    },
  });

  await AuditService.log({
    entityType: "recommendations",
    entityId: recId,
    operation: "RESTORE",
    actorId,
    actorRole,
    source: "API",
  });
}

// ──────────────────────────────────────────────
// createManualPairing
// ──────────────────────────────────────────────
export async function createManualPairing(
  chapterId: string,
  memberAId: string,
  memberBId: string,
  actorId: string,
  actorRole: string
): Promise<recommendations> {
  const aId = memberAId < memberBId ? memberAId : memberBId;
  const bId = memberAId < memberBId ? memberBId : memberAId;

  // Check for existing active rec
  const existing = await prisma.recommendations.findFirst({
    where: {
      member_a_id: aId,
      member_b_id: bId,
      status: { in: ["QUEUED", "SENT"] },
    },
  });

  if (existing) {
    throw new AppError("RECOMMENDATION_ALREADY_EXISTS", 409);
  }

  const rec = await prisma.recommendations.create({
    data: {
      chapter_id: chapterId,
      member_a_id: aId,
      member_b_id: bId,
      status: "QUEUED",
    },
  });

  // Check quiet hours — if quiet, stay QUEUED (next cron will send)
  const chapter = await prisma.chapters.findUniqueOrThrow({ where: { chapter_id: chapterId } });
  if (isQuietHours(chapter)) {
    console.log(`[ManualPairing] Quiet hours active — pair saved as QUEUED, WhatsApp deferred`);

    await AuditService.log({
      entityType: "recommendations",
      entityId: rec.rec_id,
      operation: "CREATE",
      newValue: `Manual pairing (quiet hours — QUEUED): ${aId} + ${bId}`,
      actorId,
      actorRole,
      source: "API",
    });

    return prisma.recommendations.findUniqueOrThrow({ where: { rec_id: rec.rec_id } });
  }

  // Send WhatsApp and update to SENT
  try {
    const adapter = getWhatsAppAdapter();
    const templateName = process.env.WHATSAPP_TEMPLATE_NAME ?? "hello_world";
    const memberA = await prisma.members.findUniqueOrThrow({ where: { member_id: aId } });
    const memberB = await prisma.members.findUniqueOrThrow({ where: { member_id: bId } });
    const { decrypt } = await import("@/lib/crypto");
    const decA = { full_name: memberA.full_name, whatsapp: decrypt(Buffer.from(memberA.whatsapp_enc)), biz_category: memberA.biz_category, one_line_summary: memberA.one_line_summary, intro_text: memberA.intro_text, office_address: memberA.office_address };
    const decB = { full_name: memberB.full_name, whatsapp: decrypt(Buffer.from(memberB.whatsapp_enc)), biz_category: memberB.biz_category, one_line_summary: memberB.one_line_summary, intro_text: memberB.intro_text, office_address: memberB.office_address };

    const buildComponents = (from: typeof decA, to: typeof decA) =>
      templateName === "hello_world" ? [] : [
        { type: "body" as const, parameters: [
          { type: "text" as const, text: from.full_name },
          { type: "text" as const, text: to.full_name },
          { type: "text" as const, text: to.biz_category },
          { type: "text" as const, text: to.intro_text ?? to.one_line_summary },
          { type: "text" as const, text: to.office_address },
          { type: "text" as const, text: `https://www.google.com/maps?q=${encodeURIComponent(to.office_address)}` },
          { type: "text" as const, text: to.one_line_summary },
          { type: "text" as const, text: chapter.chapter_name },
        ]},
      ];

    let msgIdA = "send_failed";
    let msgIdB = "send_failed";

    try {
      const resA = await adapter.sendTemplate({ to: decA.whatsapp, templateName, language: "en_US", components: buildComponents(decA, decB) });
      msgIdA = resA.messageId;
    } catch (err) { console.error(`[WhatsApp] Manual send failed for ${decA.full_name}:`, (err as Error).message); }

    try {
      const resB = await adapter.sendTemplate({ to: decB.whatsapp, templateName, language: "en_US", components: buildComponents(decB, decA) });
      msgIdB = resB.messageId;
    } catch (err) { console.error(`[WhatsApp] Manual send failed for ${decB.full_name}:`, (err as Error).message); }

    await prisma.recommendations.update({
      where: { rec_id: rec.rec_id },
      data: { status: "SENT", wa_msg_id_a: msgIdA, wa_msg_id_b: msgIdB, sent_at: new Date(), send_attempts: 1 },
    });
  } catch (err) {
    console.error("[ManualPairing] WhatsApp send error:", err);
    // Still mark as SENT so it appears in the UI
    await prisma.recommendations.update({
      where: { rec_id: rec.rec_id },
      data: { status: "SENT", sent_at: new Date(), send_attempts: 1 },
    });
  }

  await AuditService.log({
    entityType: "recommendations",
    entityId: rec.rec_id,
    operation: "CREATE",
    newValue: `Manual pairing: ${aId} + ${bId}`,
    actorId,
    actorRole,
    source: "API",
  });

  // Reload updated rec
  return prisma.recommendations.findUniqueOrThrow({ where: { rec_id: rec.rec_id } });
}

// ──────────────────────────────────────────────
// expireStaleRecommendations
// ──────────────────────────────────────────────
export async function expireStaleRecommendations(
  chapterId: string
): Promise<number> {
  const chapter = await prisma.chapters.findUniqueOrThrow({
    where: { chapter_id: chapterId },
  });

  const expiryDate = new Date(
    Date.now() - chapter.rec_expiry_days * 24 * 60 * 60 * 1000
  );

  const result = await prisma.recommendations.updateMany({
    where: {
      chapter_id: chapterId,
      status: "SENT",
      sent_at: { lt: expiryDate },
    },
    data: {
      status: "EXPIRED",
      expired_at: new Date(),
    },
  });

  return result.count;
}

// ──────────────────────────────────────────────
// handleWebhookReply
// ──────────────────────────────────────────────
export async function handleWebhookReply(
  waMessageId: string,
  senderWhatsapp: string,
  replyText: string
): Promise<void> {
  // 1-2. Normalise and find member
  const normalised = normalisePhone(senderWhatsapp);
  const whatsappHash = hashPhone(normalised);

  const member = await prisma.members.findFirst({
    where: { whatsapp_hash: whatsappHash },
  });

  // 3. Not found
  if (!member) {
    console.warn(
      `[WebhookReply] Unknown sender: ${normalised} (hash: ${whatsappHash})`
    );
    return;
  }

  // 4. Normalise reply
  const reply = replyText.toUpperCase().trim();

  // 5. Completion keywords
  const COMPLETE_KEYWORDS = ["DONE", "COMPLETED", "MET", "✅"];
  if (COMPLETE_KEYWORDS.includes(reply)) {
    // 8. Find most recent SENT rec for this member
    const rec = await prisma.recommendations.findFirst({
      where: {
        status: "SENT",
        OR: [
          { member_a_id: member.member_id },
          { member_b_id: member.member_id },
        ],
      },
      orderBy: { sent_at: "desc" },
    });

    if (rec) {
      await completeRecommendation(
        rec.rec_id,
        member.member_id,
        new Date(),
        `Confirmed via WhatsApp: "${replyText}"`,
        "WEBHOOK",
        member.member_id,
        member.chapter_role
      );
    } else {
      console.warn(
        `[WebhookReply] No SENT rec found for member ${member.member_id}`
      );
    }
    return;
  }

  // 6. Stop keyword
  if (reply === "STOP") {
    await prisma.members.update({
      where: { member_id: member.member_id },
      data: { rec_active: false },
    });

    await AuditService.log({
      entityType: "members",
      entityId: member.member_id,
      operation: "UPDATE",
      fieldName: "rec_active",
      oldValue: "true",
      newValue: "false",
      actorId: member.member_id,
      actorRole: member.chapter_role,
      source: "WEBHOOK",
    });
    return;
  }

  // 7. Unrecognised reply
  console.warn(
    `[WebhookReply] Unrecognised reply from ${member.member_id}: "${replyText}"`
  );
}
