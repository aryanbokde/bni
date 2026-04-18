import { z } from "zod";
import { requireAuth, requireRole } from "@/lib/auth";
import { withErrorHandling, created } from "@/lib/apiResponse";
import { AppError } from "@/lib/AppError";
import * as RecommendationService from "@/services/RecommendationService";

const LT_ROLES = ["ADMIN", "PRESIDENT", "VP", "SECRETARY", "TREASURER"];

const ManualPairingSchema = z.object({
  member_a_id: z.string().min(1),
  member_b_id: z.string().min(1),
});

// POST /api/chapters/[chapterId]/recommendations/manual
export const POST = withErrorHandling(
  async (req: Request, { params }: { params: Record<string, string> }) => {
    const actor = await requireAuth(req);
    requireRole(actor, LT_ROLES);
    if (actor.chapterId !== params.chapterId) {
      throw new AppError("FORBIDDEN", 403);
    }

    const body = await req.json();
    const parsed = ManualPairingSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", 422, {
        message: "member_a_id and member_b_id are required",
      });
    }

    const rec = await RecommendationService.createManualPairing(
      params.chapterId,
      parsed.data.member_a_id,
      parsed.data.member_b_id,
      actor.memberId,
      actor.role
    );

    return created(rec);
  }
);
