import { requireAuth, requireRole } from "@/lib/auth";
import { withErrorHandling, noContent } from "@/lib/apiResponse";
import { AppError } from "@/lib/AppError";
import * as MemberService from "@/services/MemberService";

// POST /api/chapters/[chapterId]/members/[memberId]/restore
export const POST = withErrorHandling(
  async (req: Request, { params }: { params: Record<string, string> }) => {
    const actor = await requireAuth(req);
    requireRole(actor, ["ADMIN"]);
    if (actor.chapterId !== params.chapterId) {
      throw new AppError("FORBIDDEN", 403);
    }

    await MemberService.restoreMember(
      params.memberId,
      actor.memberId,
      actor.role
    );
    return noContent();
  }
);
