import { getWhatsAppAdapter } from "@/adapters";
import * as ChapterService from "@/services/ChapterService";
import { AppError } from "@/lib/AppError";
import type { recommendations, chapters } from "@prisma/client";
import type { MemberDecrypted } from "@/types/member";
import type { TemplateComponent } from "@/adapters/WhatsAppAdapter";

// ──────────────────────────────────────────────
// sendIntroduction
// ──────────────────────────────────────────────
export async function sendIntroduction(
  rec: recommendations,
  memberA: MemberDecrypted,
  memberB: MemberDecrypted,
  chapter: chapters
): Promise<{ msgIdA: string; msgIdB: string }> {
  const adapter = getWhatsAppAdapter();

  // 1. Load shareable fields
  const sf = await ChapterService.getShareableFieldMap(chapter.chapter_id);

  const templateName =
    process.env.WHATSAPP_TEMPLATE_NAME ?? "bni_121_introduction";

  // 2. Build components for A (about B)
  const componentsA = buildComponents(memberA, memberB, sf, chapter);

  // 3. Build components for B (about A)
  const componentsB = buildComponents(memberB, memberA, sf, chapter);

  // 4. Send both via Promise.allSettled
  const [resultA, resultB] = await Promise.allSettled([
    adapter.sendTemplate({
      to: normaliseToMetaFormat(memberA.whatsapp),
      templateName,
      language: "en",
      components: componentsA,
    }),
    adapter.sendTemplate({
      to: normaliseToMetaFormat(memberB.whatsapp),
      templateName,
      language: "en",
      components: componentsB,
    }),
  ]);

  // 5. If either rejected, throw
  if (resultA.status === "rejected" || resultB.status === "rejected") {
    throw new AppError("WHATSAPP_SEND_FAILED", 502, {
      memberA: resultA.status,
      memberB: resultB.status,
    });
  }

  // 6. Return message IDs
  return {
    msgIdA: resultA.value.messageId,
    msgIdB: resultB.value.messageId,
  };
}

// ──────────────────────────────────────────────
// sendAcknowledgement
// ──────────────────────────────────────────────
export async function sendAcknowledgement(
  whatsappNumber: string,
  contactName: string
): Promise<void> {
  const adapter = getWhatsAppAdapter();

  await adapter.sendTemplate({
    to: normaliseToMetaFormat(whatsappNumber),
    templateName: "bni_121_complete",
    language: "en",
    components: [
      {
        type: "body",
        parameters: [{ type: "text", text: contactName }],
      },
    ],
  });
}

// ──────────────────────────────────────────────
// Private helpers
// ──────────────────────────────────────────────

function buildComponents(
  recipient: MemberDecrypted,
  contact: MemberDecrypted,
  sf: Record<string, boolean>,
  chapter: chapters
): TemplateComponent[] {
  return [
    {
      type: "body",
      parameters: [
        { type: "text", text: recipient.full_name }, // {{1}} recipient name
        { type: "text", text: String(chapter.lookback_days) }, // {{2}} lookback days
        { type: "text", text: contact.full_name }, // {{3}} contact name
        {
          type: "text",
          text: sf.biz_category ? contact.biz_category : "—",
        }, // {{4}}
        {
          type: "text",
          text: sf.one_line_summary
            ? contact.intro_text ?? contact.one_line_summary
            : "—",
        }, // {{5}}
        {
          type: "text",
          text: sf.whatsapp ? contact.whatsapp : "—",
        }, // {{6}}
        {
          type: "text",
          text: sf.office_address
            ? formatLocation(contact, chapter)
            : "—",
        }, // {{7}}
        { type: "text", text: buildMapsLink(contact) }, // {{8}} always
      ],
    },
  ];
}

function normaliseToMetaFormat(phone: string): string {
  // Strip leading + then remove all non-digits
  const digits = phone.replace(/^\+/, "").replace(/\D/g, "");

  // Meta requires E.164 without + prefix, minimum 10 digits with country code
  // Indian numbers without country code (e.g. "09876543210") must be prefixed with 91
  if (digits.length === 10) {
    return `91${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    return `91${digits.slice(1)}`;
  }

  return digits;
}

function buildMapsLink(member: MemberDecrypted): string {
  if (
    member.geocode_status === "RESOLVED" &&
    member.latitude != null &&
    member.longitude != null
  ) {
    return `https://www.google.com/maps?q=${member.latitude},${member.longitude}`;
  }
  return `https://www.google.com/maps?q=${encodeURIComponent(member.office_address)}`;
}

function formatLocation(
  member: MemberDecrypted,
  chapter: chapters
): string {
  if (chapter.location_display_mode === "AREA_ONLY") {
    return extractArea(member.office_address);
  }
  return member.office_address;
}

function extractArea(fullAddress: string): string {
  const parts = fullAddress.split(",").map((p) => p.trim());
  if (parts.length <= 2) return fullAddress;
  return parts.slice(-2).join(", ");
}
