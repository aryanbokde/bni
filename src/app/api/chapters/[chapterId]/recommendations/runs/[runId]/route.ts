import { requireAuth, requireRole } from "@/lib/auth";
import { withErrorHandling, ok } from "@/lib/apiResponse";
import { AppError } from "@/lib/AppError";
import { prisma } from "@/lib/db";

const LT_ROLES = ["ADMIN", "PRESIDENT", "VP", "SECRETARY", "TREASURER"];

// GET /api/chapters/[chapterId]/recommendations/runs/[runId]
export const GET = withErrorHandling(
  async (req: Request, { params }: { params: Record<string, string> }) => {
    const actor = await requireAuth(req);
    requireRole(actor, LT_ROLES);
    if (actor.chapterId !== params.chapterId) {
      throw new AppError("FORBIDDEN", 403);
    }

    const run = await prisma.recommendation_runs.findUnique({
      where: { run_id: params.runId },
    });

    if (!run || run.chapter_id !== params.chapterId) {
      throw new AppError("RUN_NOT_FOUND", 404);
    }

    return ok(run);
  }
);
