import { requireAuth, requireRole } from "@/lib/auth";
import { withErrorHandling, ok } from "@/lib/apiResponse";
import { AppError } from "@/lib/AppError";
import * as RecommendationService from "@/services/RecommendationService";

const LT_ROLES = ["ADMIN", "PRESIDENT", "VP", "SECRETARY", "TREASURER"];

// POST /api/chapters/[chapterId]/recommendations/[recId]/reinstate
export const POST = withErrorHandling(
  async (req: Request, { params }: { params: Record<string, string> }) => {
    const actor = await requireAuth(req);
    requireRole(actor, LT_ROLES);
    if (actor.chapterId !== params.chapterId) {
      throw new AppError("FORBIDDEN", 403);
    }

    await RecommendationService.reinstateRecommendation(
      params.recId,
      actor.memberId,
      actor.role
    );

    return ok({ success: true });
  }
);
