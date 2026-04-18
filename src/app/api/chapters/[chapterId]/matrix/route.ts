import { requireAuth, requireRole } from "@/lib/auth";
import { withErrorHandling, ok } from "@/lib/apiResponse";
import { AppError } from "@/lib/AppError";
import * as MatrixService from "@/services/MatrixService";

const LT_ROLES = ["ADMIN", "PRESIDENT", "VP", "SECRETARY", "TREASURER"];
const ALLOWED_WINDOWS = [30, 60, 90, 180, 365];

// GET /api/chapters/[chapterId]/matrix
export const GET = withErrorHandling(
  async (req: Request, { params }: { params: Record<string, string> }) => {
    const actor = await requireAuth(req);
    requireRole(actor, LT_ROLES);
    if (actor.chapterId !== params.chapterId) {
      throw new AppError("FORBIDDEN", 403);
    }

    const url = new URL(req.url);
    let windowDays = Number(url.searchParams.get("windowDays")) || 180;
    if (!ALLOWED_WINDOWS.includes(windowDays)) {
      windowDays = 180;
    }

    const data = await MatrixService.getMatrix(params.chapterId, windowDays);

    return ok({
      members: data.members,
      cells: data.cells,
      windowDays,
    });
  }
);
