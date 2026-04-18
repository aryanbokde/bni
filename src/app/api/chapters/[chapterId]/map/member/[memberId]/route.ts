import { requireAuth } from "@/lib/auth";
import { withErrorHandling, ok } from "@/lib/apiResponse";
import { AppError } from "@/lib/AppError";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import * as ChapterService from "@/services/ChapterService";

const LT_ROLES = ["ADMIN", "PRESIDENT", "VP", "SECRETARY", "TREASURER"];

// GET /api/chapters/[chapterId]/map/member/[memberId]
export const GET = withErrorHandling(
  async (req: Request, { params }: { params: Record<string, string> }) => {
    const actor = await requireAuth(req);
    if (actor.chapterId !== params.chapterId) {
      throw new AppError("FORBIDDEN", 403);
    }

    const member = await prisma.members.findUnique({
      where: { member_id: params.memberId },
    });

    if (!member || member.chapter_id !== params.chapterId) {
      throw new AppError("NOT_FOUND", 404);
    }

    const chapter = await prisma.chapters.findUniqueOrThrow({
      where: { chapter_id: params.chapterId },
    });

    const sf = await ChapterService.getShareableFieldMap(params.chapterId);
    const isLT = LT_ROLES.includes(actor.role);
    const isSelf = actor.memberId === params.memberId;

    // Build info card — only shareable fields
    const card: Record<string, unknown> = {
      member_id: member.member_id,
      full_name: member.full_name, // always
    };

    if (sf.biz_category) {
      card.biz_category = member.biz_category;
    }

    if (sf.one_line_summary) {
      card.one_line_summary = member.intro_text ?? member.one_line_summary;
    }

    if (sf.whatsapp && !isSelf) {
      card.whatsapp = decrypt(Buffer.from(member.whatsapp_enc));
    }

    // Office display — LT/ADMIN always get full address
    if (isLT) {
      card.office_address = member.office_address;
    } else if (sf.office_address) {
      if (chapter.location_display_mode === "AREA_ONLY") {
        card.office_address = extractArea(member.office_address);
      } else {
        card.office_address = member.office_address;
      }
    }

    // Maps link — always included
    if (
      member.geocode_status === "RESOLVED" &&
      member.latitude != null &&
      member.longitude != null
    ) {
      card.maps_link = `https://www.google.com/maps?q=${member.latitude},${member.longitude}`;
    } else {
      card.maps_link = `https://www.google.com/maps?q=${encodeURIComponent(member.office_address)}`;
    }

    return ok(card);
  }
);

function extractArea(fullAddress: string): string {
  const parts = fullAddress.split(",").map((p) => p.trim());
  if (parts.length <= 2) return fullAddress;
  return parts.slice(-2).join(", ");
}
