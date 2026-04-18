import { requireAuth } from "@/lib/auth";
import { withErrorHandling, ok } from "@/lib/apiResponse";
import { AppError } from "@/lib/AppError";
import { prisma } from "@/lib/db";

const LT_ROLES = ["ADMIN", "PRESIDENT", "VP", "SECRETARY", "TREASURER"];

// GET /api/chapters/[chapterId]/recommendations
export const GET = withErrorHandling(
  async (req: Request, { params }: { params: Record<string, string> }) => {
    const actor = await requireAuth(req);
    if (actor.chapterId !== params.chapterId) {
      throw new AppError("FORBIDDEN", 403);
    }

    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? undefined;
    const memberId = url.searchParams.get("member_id") ?? undefined;
    const page = Number(url.searchParams.get("page")) || 1;
    const pageSize = Number(url.searchParams.get("pageSize")) || 20;

    const where: Record<string, unknown> = {
      chapter_id: params.chapterId,
    };
    if (status) where.status = status;

    // Non-LT users (MEMBER) can only see their own recommendations
    if (!LT_ROLES.includes(actor.role)) {
      where.OR = [
        { member_a_id: actor.memberId },
        { member_b_id: actor.memberId },
      ];
    } else if (memberId) {
      where.OR = [{ member_a_id: memberId }, { member_b_id: memberId }];
    }

    const [recs, total] = await Promise.all([
      prisma.recommendations.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.recommendations.count({ where }),
    ]);

    return ok(recs, { total, page });
  }
);
