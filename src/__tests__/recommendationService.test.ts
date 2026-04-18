import { PrismaClient } from "@prisma/client";
import { encrypt, hashPhone, hashEmail } from "@/lib/crypto";
import * as RecService from "@/services/RecommendationService";

const prisma = new PrismaClient();

let chapterId: string;
let memberIds: string[] = [];

beforeAll(async () => {
  // Create test chapter
  const chapter = await prisma.chapters.create({
    data: {
      chapter_name: "RecService Test Chapter",
      meeting_day: 4,
      meeting_start_time: "07:00:00",
      rsvp_reminder_schedule: [],
      lookback_days: 180,
      cooldown_days: 60,
      max_recs_per_cycle: 3,
      rec_expiry_days: 30,
    },
  });
  chapterId = chapter.chapter_id;

  // Create 3 eligible members
  for (let i = 1; i <= 3; i++) {
    const phone = `+9180000${String(i).padStart(5, "0")}`;
    const email = `rec-test-${i}@bni.com`;
    const m = await prisma.members.create({
      data: {
        chapter_id: chapterId,
        full_name: `Rec Member ${i}`,
        mobile_enc: encrypt(phone),
        mobile_hash: hashPhone(phone),
        whatsapp_enc: encrypt(phone),
        whatsapp_hash: hashPhone(phone),
        email_enc: encrypt(email),
        email_hash: hashEmail(email),
        biz_category: `Category ${i}`,
        one_line_summary: `Recommendation test member ${i}`,
        office_address: `${i}00 Rec Road, Ahmedabad`,
        status: "ACTIVE",
        comm_eligible: true,
        rec_active: true,
        geocode_status: "RESOLVED",
        chapter_role: "MEMBER",
        joining_date: new Date(),
      },
    });
    memberIds.push(m.member_id);
  }
});

afterAll(async () => {
  await prisma.audit_logs.deleteMany({});
  await prisma.member_interactions.deleteMany({ where: { chapter_id: chapterId } });
  await prisma.recommendations.deleteMany({ where: { chapter_id: chapterId } });
  await prisma.recommendation_runs.deleteMany({ where: { chapter_id: chapterId } });
  await prisma.members.deleteMany({ where: { chapter_id: chapterId } });
  await prisma.chapters.deleteMany({ where: { chapter_id: chapterId } });
  await prisma.$disconnect();
});

afterEach(async () => {
  await prisma.member_interactions.deleteMany({ where: { chapter_id: chapterId } });
  await prisma.recommendations.deleteMany({ where: { chapter_id: chapterId } });
  await prisma.recommendation_runs.deleteMany({ where: { chapter_id: chapterId } });
});

describe("RecommendationService", () => {
  test("1. runRecommendationCycle creates run and recommendation records", async () => {
    const run = await RecService.runRecommendationCycle(chapterId, "MANUAL");

    expect(run.status).toBe("COMPLETED");
    expect(run.pairs_evaluated).toBe(3); // C(3,2) = 3
    expect(run.pairs_sent).toBe(3);
    expect(run.completed_at).not.toBeNull();

    const recs = await prisma.recommendations.findMany({
      where: { chapter_id: chapterId },
    });
    expect(recs).toHaveLength(3);
    expect(recs.every((r) => r.status === "SENT")).toBe(true);
  });

  test("2. runRecommendationCycle handles 0 eligible pairs gracefully", async () => {
    // Create a chapter with no eligible members
    const emptyChapter = await prisma.chapters.create({
      data: {
        chapter_name: "Empty Chapter",
        meeting_day: 1,
        meeting_start_time: "08:00:00",
        rsvp_reminder_schedule: [],
      },
    });

    const run = await RecService.runRecommendationCycle(
      emptyChapter.chapter_id,
      "MANUAL"
    );

    expect(run.status).toBe("COMPLETED");
    expect(run.pairs_evaluated).toBe(0);
    expect(run.pairs_sent).toBe(0);

    // Cleanup
    await prisma.recommendation_runs.deleteMany({
      where: { chapter_id: emptyChapter.chapter_id },
    });
    await prisma.chapters.delete({
      where: { chapter_id: emptyChapter.chapter_id },
    });
  });

  test("3. createAndDispatch prevents duplicate active rec for same pair", async () => {
    // Run cycle — creates 3 recs
    await RecService.runRecommendationCycle(chapterId, "MANUAL");

    // Run again — should skip all 3 (already SENT)
    const run2 = await RecService.runRecommendationCycle(chapterId, "MANUAL");

    // All pairs should be skipped (open recs exist)
    expect(run2.pairs_sent).toBe(0);
  });

  test("4. completeRecommendation creates interaction and updates status", async () => {
    await RecService.runRecommendationCycle(chapterId, "MANUAL");

    const rec = await prisma.recommendations.findFirst({
      where: { chapter_id: chapterId, status: "SENT" },
    });
    expect(rec).not.toBeNull();

    await RecService.completeRecommendation(
      rec!.rec_id,
      rec!.member_a_id,
      new Date(),
      "Great meeting",
      "UI",
      rec!.member_a_id,
      "MEMBER"
    );

    // Check rec updated
    const updated = await prisma.recommendations.findUnique({
      where: { rec_id: rec!.rec_id },
    });
    expect(updated!.status).toBe("COMPLETED");
    expect(updated!.completed_at).not.toBeNull();

    // Check interaction created
    const ix = await prisma.member_interactions.findFirst({
      where: { rec_id: rec!.rec_id },
    });
    expect(ix).not.toBeNull();
    expect(ix!.notes).toBe("Great meeting");
  });

  test("5. completeRecommendation throws 409 if already COMPLETED", async () => {
    await RecService.runRecommendationCycle(chapterId, "MANUAL");

    const rec = await prisma.recommendations.findFirst({
      where: { chapter_id: chapterId, status: "SENT" },
    });

    // Complete once
    await RecService.completeRecommendation(
      rec!.rec_id,
      rec!.member_a_id,
      new Date(),
      undefined,
      "UI",
      rec!.member_a_id,
      "MEMBER"
    );

    // Complete again — should throw 409
    await expect(
      RecService.completeRecommendation(
        rec!.rec_id,
        rec!.member_a_id,
        new Date(),
        undefined,
        "UI",
        rec!.member_a_id,
        "MEMBER"
      )
    ).rejects.toMatchObject({
      code: "RECOMMENDATION_ALREADY_COMPLETED",
      httpStatus: 409,
    });
  });

  test("6. expireStaleRecommendations expires correct records", async () => {
    // Create a rec with sent_at 60 days ago (chapter rec_expiry_days = 30)
    const [a, b] =
      memberIds[0] < memberIds[1]
        ? [memberIds[0], memberIds[1]]
        : [memberIds[1], memberIds[0]];

    await prisma.recommendations.create({
      data: {
        chapter_id: chapterId,
        member_a_id: a,
        member_b_id: b,
        status: "SENT",
        sent_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      },
    });

    // Create a fresh SENT rec (should NOT expire)
    const [c, d] =
      memberIds[1] < memberIds[2]
        ? [memberIds[1], memberIds[2]]
        : [memberIds[2], memberIds[1]];

    await prisma.recommendations.create({
      data: {
        chapter_id: chapterId,
        member_a_id: c,
        member_b_id: d,
        status: "SENT",
        sent_at: new Date(),
      },
    });

    const expired = await RecService.expireStaleRecommendations(chapterId);
    expect(expired).toBe(1);

    const remaining = await prisma.recommendations.findMany({
      where: { chapter_id: chapterId, status: "SENT" },
    });
    expect(remaining).toHaveLength(1);
  });

  test("7. handleWebhookReply DONE marks rec as COMPLETED", async () => {
    await RecService.runRecommendationCycle(chapterId, "MANUAL");

    // Pick any SENT rec, use its member_a for the webhook sender
    const rec = await prisma.recommendations.findFirst({
      where: { chapter_id: chapterId, status: "SENT" },
    });
    const idx = memberIds.indexOf(rec!.member_a_id);
    const phone = `+9180000${String(idx + 1).padStart(5, "0")}`;

    // handleWebhookReply picks the most recent SENT rec for that member
    // (orderBy sent_at desc) — query with the same ordering so our
    // assertion targets the exact rec the service will complete.
    const targetRec = await prisma.recommendations.findFirst({
      where: {
        status: "SENT",
        OR: [
          { member_a_id: rec!.member_a_id },
          { member_b_id: rec!.member_a_id },
        ],
      },
      orderBy: { sent_at: "desc" },
    });

    await RecService.handleWebhookReply("wa_msg_123", phone, "DONE");

    const updated = await prisma.recommendations.findUnique({
      where: { rec_id: targetRec!.rec_id },
    });
    expect(updated!.status).toBe("COMPLETED");
  });

  test("8. handleWebhookReply STOP sets member rec_active=false", async () => {
    const phone = `+9180000${String(1).padStart(5, "0")}`;

    // Ensure rec_active is true first
    await prisma.members.update({
      where: { member_id: memberIds[0] },
      data: { rec_active: true },
    });

    await RecService.handleWebhookReply("wa_msg_456", phone, "STOP");

    const member = await prisma.members.findUnique({
      where: { member_id: memberIds[0] },
    });
    expect(member!.rec_active).toBe(false);

    // Restore
    await prisma.members.update({
      where: { member_id: memberIds[0] },
      data: { rec_active: true },
    });
  });

  test("9. handleWebhookReply unknown text does not throw", async () => {
    const phone = `+9180000${String(1).padStart(5, "0")}`;
    await expect(
      RecService.handleWebhookReply("wa_msg_789", phone, "Hello there!")
    ).resolves.toBeUndefined();
  });
});
