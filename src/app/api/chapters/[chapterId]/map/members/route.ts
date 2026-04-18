import { requireAuth } from "@/lib/auth";
import { withErrorHandling, ok } from "@/lib/apiResponse";
import { AppError } from "@/lib/AppError";
import { prisma } from "@/lib/db";

// GET /api/chapters/[chapterId]/map/members
export const GET = withErrorHandling(
  async (req: Request, { params }: { params: Record<string, string> }) => {
    const actor = await requireAuth(req);
    if (actor.chapterId !== params.chapterId) {
      throw new AppError("FORBIDDEN", 403);
    }

    const members = await prisma.members.findMany({
      where: {
        chapter_id: params.chapterId,
        status: "ACTIVE",
      },
      select: {
        member_id: true,
        full_name: true,
        biz_category: true,
        latitude: true,
        longitude: true,
        geocode_status: true,
      },
    });

    const pins = members
      .filter((m) => m.geocode_status === "RESOLVED")
      .map((m) => ({
        member_id: m.member_id,
        full_name: m.full_name,
        biz_category: m.biz_category,
        latitude: m.latitude,
        longitude: m.longitude,
        geocode_status: m.geocode_status,
      }));

    const listOnly = members
      .filter((m) => m.geocode_status !== "RESOLVED")
      .map((m) => ({
        member_id: m.member_id,
        full_name: m.full_name,
        biz_category: m.biz_category,
        geocode_status: m.geocode_status,
      }));

    return ok({ pins, listOnly });
  }
);
