import { requireAuth, requireRole } from "@/lib/auth";
import { withErrorHandling, ok, created } from "@/lib/apiResponse";
import { AppError } from "@/lib/AppError";
import { CreateMemberSchema, formatZodErrors } from "@/lib/validation";
import * as MemberService from "@/services/MemberService";

// GET /api/chapters/[chapterId]/members
export const GET = withErrorHandling(
  async (req: Request, { params }: { params: Record<string, string> }) => {
    const actor = await requireAuth(req);
    if (actor.chapterId !== params.chapterId) {
      throw new AppError("FORBIDDEN", 403);
    }

    const url = new URL(req.url);
    const filters = {
      status: url.searchParams.get("status") ?? undefined,
      role: url.searchParams.get("role") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
    };

    const members = await MemberService.getMembersByChapter(
      params.chapterId,
      filters
    );
    // Strip sensitive fields before sending to client
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const safe = members.map(({ password_hash, ...rest }) => rest);
    return ok(safe);
  }
);

// POST /api/chapters/[chapterId]/members
export const POST = withErrorHandling(
  async (req: Request, { params }: { params: Record<string, string> }) => {
    const actor = await requireAuth(req);
    requireRole(actor, ["ADMIN"]);
    if (actor.chapterId !== params.chapterId) {
      throw new AppError("FORBIDDEN", 403);
    }

    const body = await req.json();
    const parsed = CreateMemberSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", 422, formatZodErrors(parsed.error));
    }

    const member = await MemberService.createMember(
      params.chapterId,
      parsed.data,
      actor.memberId
    );
    return created(member);
  }
);
