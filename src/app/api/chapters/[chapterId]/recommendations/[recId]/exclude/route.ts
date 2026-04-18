import { z } from "zod";
import { requireAuth, requireRole } from "@/lib/auth";
import { withErrorHandling, ok } from "@/lib/apiResponse";
import { AppError } from "@/lib/AppError";
import * as RecommendationService from "@/services/RecommendationService";

const LT_ROLES = ["ADMIN", "PRESIDENT", "VP", "SECRETARY", "TREASURER"];

const ExcludeSchema = z.object({
  reason: z.string().min(1, "Reason is required"),
});

// POST /api/chapters/[chapterId]/recommendations/[recId]/exclude
export const POST = withErrorHandling(
  async (req: Request, { params }: { params: Record<string, string> }) => {
    const actor = await requireAuth(req);
    requireRole(actor, LT_ROLES);
    if (actor.chapterId !== params.chapterId) {
      throw new AppError("FORBIDDEN", 403);
    }

    const body = await req.json();
    const parsed = ExcludeSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", 422, {
        reason: "Reason is required",
      });
    }

    await RecommendationService.excludePair(
      params.recId,
      parsed.data.reason,
      actor.memberId,
      actor.role
    );

    return ok({ success: true });
  }
);
