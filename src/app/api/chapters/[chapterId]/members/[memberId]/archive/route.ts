import { z } from "zod";
import { requireAuth, requireRole } from "@/lib/auth";
import { withErrorHandling, noContent } from "@/lib/apiResponse";
import { AppError } from "@/lib/AppError";
import * as MemberService from "@/services/MemberService";

const ArchiveSchema = z.object({
  reason: z.string().min(1, "Reason is required"),
});

// POST /api/chapters/[chapterId]/members/[memberId]/archive
export const POST = withErrorHandling(
  async (req: Request, { params }: { params: Record<string, string> }) => {
    const actor = await requireAuth(req);
    requireRole(actor, ["ADMIN"]);
    if (actor.chapterId !== params.chapterId) {
      throw new AppError("FORBIDDEN", 403);
    }

    const body = await req.json();
    const parsed = ArchiveSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", 422, {
        reason: "Reason is required",
      });
    }

    await MemberService.archiveMember(
      params.memberId,
      parsed.data.reason,
      actor.memberId,
      actor.role
    );
    return noContent();
  }
);
