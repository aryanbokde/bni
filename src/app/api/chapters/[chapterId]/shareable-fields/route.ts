import { z } from "zod";
import { requireAuth, requireRole } from "@/lib/auth";
import { withErrorHandling, ok } from "@/lib/apiResponse";
import { AppError } from "@/lib/AppError";
import * as ChapterService from "@/services/ChapterService";

const UpdateShareableFieldsSchema = z.object({
  updates: z.array(
    z.object({
      field_name: z.string().min(1),
      is_shareable: z.boolean(),
    })
  ),
});

// GET /api/chapters/[chapterId]/shareable-fields
// Spec: ADMIN only
export const GET = withErrorHandling(
  async (req: Request, { params }: { params: Record<string, string> }) => {
    const actor = await requireAuth(req);
    requireRole(actor, ["ADMIN"]);
    if (actor.chapterId !== params.chapterId) {
      throw new AppError("FORBIDDEN", 403);
    }

    const fields = await ChapterService.getShareableFields(params.chapterId);
    return ok(fields);
  }
);

// PATCH /api/chapters/[chapterId]/shareable-fields
// Spec: ADMIN only
export const PATCH = withErrorHandling(
  async (req: Request, { params }: { params: Record<string, string> }) => {
    const actor = await requireAuth(req);
    requireRole(actor, ["ADMIN"]);
    if (actor.chapterId !== params.chapterId) {
      throw new AppError("FORBIDDEN", 403);
    }

    const body = await req.json();
    const parsed = UpdateShareableFieldsSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", 422, {
        updates: "Invalid shareable fields format",
      });
    }

    const updated = await ChapterService.updateShareableFields(
      params.chapterId,
      parsed.data.updates,
      actor.memberId
    );
    return ok(updated);
  }
);
