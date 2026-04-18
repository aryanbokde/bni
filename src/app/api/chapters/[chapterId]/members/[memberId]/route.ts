import { requireAuth } from "@/lib/auth";
import { withErrorHandling, ok } from "@/lib/apiResponse";
import { AppError } from "@/lib/AppError";
import { UpdateMemberSchema, formatZodErrors } from "@/lib/validation";
import * as MemberService from "@/services/MemberService";

// GET /api/chapters/[chapterId]/members/[memberId]
export const GET = withErrorHandling(
  async (req: Request, { params }: { params: Record<string, string> }) => {
    const actor = await requireAuth(req);
    if (actor.chapterId !== params.chapterId) {
      throw new AppError("FORBIDDEN", 403);
    }

    const member = await MemberService.getMemberById(
      params.memberId,
      params.chapterId
    );
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, ...safe } = member;
    return ok(safe);
  }
);

// PATCH /api/chapters/[chapterId]/members/[memberId]
export const PATCH = withErrorHandling(
  async (req: Request, { params }: { params: Record<string, string> }) => {
    const actor = await requireAuth(req);
    if (actor.chapterId !== params.chapterId) {
      throw new AppError("FORBIDDEN", 403);
    }

    // ADMIN or self
    if (actor.role !== "ADMIN" && actor.memberId !== params.memberId) {
      throw new AppError("FORBIDDEN", 403);
    }

    const body = await req.json();
    const parsed = UpdateMemberSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", 422, formatZodErrors(parsed.error));
    }

    // Non-ADMIN cannot change role, joining_date, or eligibility flags
    const data = { ...parsed.data };
    if (actor.role !== "ADMIN") {
      delete data.chapter_role;
      delete data.comm_eligible;
      delete data.rec_active;
      delete data.joining_date;
    }

    const member = await MemberService.updateMember(
      params.memberId,
      params.chapterId,
      data,
      actor.memberId
    );
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash: _, ...safe } = member;
    return ok(safe);
  }
);
