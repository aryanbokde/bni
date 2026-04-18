import { requireAuth, requireRole } from "@/lib/auth";
import { withErrorHandling, ok } from "@/lib/apiResponse";
import { AppError } from "@/lib/AppError";
import * as ChapterService from "@/services/ChapterService";

const LT_ROLES = ["ADMIN", "PRESIDENT", "VP", "SECRETARY", "TREASURER"];

// GET /api/chapters/[chapterId]/settings
export const GET = withErrorHandling(
  async (req: Request, { params }: { params: Record<string, string> }) => {
    const actor = await requireAuth(req);
    requireRole(actor, LT_ROLES);
    if (actor.chapterId !== params.chapterId) {
      throw new AppError("FORBIDDEN", 403);
    }

    const settings = await ChapterService.getChapterSettings(params.chapterId);
    return ok(settings);
  }
);

// PATCH /api/chapters/[chapterId]/settings
export const PATCH = withErrorHandling(
  async (req: Request, { params }: { params: Record<string, string> }) => {
    const actor = await requireAuth(req);
    requireRole(actor, ["ADMIN", "PRESIDENT"]);
    if (actor.chapterId !== params.chapterId) {
      throw new AppError("FORBIDDEN", 403);
    }

    const body = await req.json();
    const updated = await ChapterService.updateChapterSettings(
      params.chapterId,
      body,
      actor.memberId,
      actor.role
    );
    return ok(updated);
  }
);
