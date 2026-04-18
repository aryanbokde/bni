import { requireAuth } from "@/lib/auth";
import { withErrorHandling, ok } from "@/lib/apiResponse";
import { AppError } from "@/lib/AppError";
import * as MatrixService from "@/services/MatrixService";

const LT_ROLES = ["ADMIN", "PRESIDENT", "VP", "SECRETARY", "TREASURER"];

// GET /api/chapters/[chapterId]/matrix/member/[memberId]
export const GET = withErrorHandling(
  async (req: Request, { params }: { params: Record<string, string> }) => {
    const actor = await requireAuth(req);
    if (actor.chapterId !== params.chapterId) {
      throw new AppError("FORBIDDEN", 403);
    }

    // ADMIN/LT can view any member; others can only view self
    const isLT = LT_ROLES.includes(actor.role);
    const isSelf = actor.memberId === params.memberId;
    if (!isLT && !isSelf) {
      throw new AppError("FORBIDDEN", 403);
    }

    const url = new URL(req.url);
    const windowDays = Number(url.searchParams.get("windowDays")) || 180;

    const coverage = await MatrixService.getMemberCoverage(
      params.memberId,
      params.chapterId,
      windowDays
    );

    return ok(coverage);
  }
);
