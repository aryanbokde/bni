import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { withErrorHandling, ok } from "@/lib/apiResponse";
import { AppError } from "@/lib/AppError";
import { prisma } from "@/lib/db";
import * as RecommendationService from "@/services/RecommendationService";

const LT_ROLES = ["ADMIN", "PRESIDENT", "VP", "SECRETARY", "TREASURER"];

const CompleteSchema = z.object({
  interaction_date: z.string().min(1),
  notes: z.string().optional(),
});

// POST /api/chapters/[chapterId]/recommendations/[recId]/complete
export const POST = withErrorHandling(
  async (req: Request, { params }: { params: Record<string, string> }) => {
    const actor = await requireAuth(req);
    if (actor.chapterId !== params.chapterId) {
      throw new AppError("FORBIDDEN", 403);
    }

    // ADMIN/LT can complete any rec; MEMBER can only complete their own
    if (!LT_ROLES.includes(actor.role)) {
      const rec = await prisma.recommendations.findUnique({
        where: { rec_id: params.recId },
      });
      if (
        !rec ||
        (rec.member_a_id !== actor.memberId &&
          rec.member_b_id !== actor.memberId)
      ) {
        throw new AppError("FORBIDDEN", 403);
      }
    }

    const body = await req.json();
    const parsed = CompleteSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", 422, {
        interaction_date: "Interaction date is required",
      });
    }

    await RecommendationService.completeRecommendation(
      params.recId,
      actor.memberId,
      new Date(parsed.data.interaction_date),
      parsed.data.notes,
      "UI",
      actor.memberId,
      actor.role
    );

    return ok({ success: true });
  }
);
