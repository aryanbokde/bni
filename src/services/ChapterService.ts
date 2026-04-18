import { prisma } from "@/lib/db";
import { AppError } from "@/lib/AppError";
import { AuditService } from "@/services/AuditService";
import type { chapters, shareable_fields } from "@prisma/client";

export async function getChapterSettings(
  chapterId: string
): Promise<chapters> {
  const chapter = await prisma.chapters.findUnique({
    where: { chapter_id: chapterId },
  });
  if (!chapter) throw new AppError("CHAPTER_NOT_FOUND", 404);
  return chapter;
}

export async function updateChapterSettings(
  chapterId: string,
  dto: Partial<chapters>,
  actorId: string,
  actorRole: string
): Promise<chapters> {
  const existing = await prisma.chapters.findUnique({
    where: { chapter_id: chapterId },
  });
  if (!existing) throw new AppError("CHAPTER_NOT_FOUND", 404);

  // Exclude non-updatable fields
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { chapter_id: _, created_at: __, updated_at: ___, ...safeDto } = dto;

  // Audit each changed field
  for (const [key, newVal] of Object.entries(safeDto)) {
    const oldVal = existing[key as keyof chapters];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      await AuditService.log({
        entityType: "chapters",
        entityId: chapterId,
        operation: "UPDATE",
        fieldName: key,
        oldValue: String(oldVal ?? ""),
        newValue: String(newVal ?? ""),
        actorId,
        actorRole,
        source: "API",
      });
    }
  }

  return prisma.chapters.update({
    where: { chapter_id: chapterId },
    data: safeDto as Parameters<typeof prisma.chapters.update>[0]["data"],
  });
}

export async function getShareableFields(
  chapterId: string
): Promise<shareable_fields[]> {
  return prisma.shareable_fields.findMany({
    where: { chapter_id: chapterId },
    orderBy: { field_name: "asc" },
  });
}

export async function updateShareableFields(
  chapterId: string,
  updates: { field_name: string; is_shareable: boolean }[],
  actorId: string
): Promise<shareable_fields[]> {
  for (const update of updates) {
    const existing = await prisma.shareable_fields.findUnique({
      where: {
        chapter_id_field_name: {
          chapter_id: chapterId,
          field_name: update.field_name,
        },
      },
    });

    const oldValue = existing ? String(existing.is_shareable) : "N/A";

    await prisma.shareable_fields.upsert({
      where: {
        chapter_id_field_name: {
          chapter_id: chapterId,
          field_name: update.field_name,
        },
      },
      update: {
        is_shareable: update.is_shareable,
        updated_by: actorId,
      },
      create: {
        chapter_id: chapterId,
        field_name: update.field_name,
        is_shareable: update.is_shareable,
        updated_by: actorId,
      },
    });

    if (oldValue !== String(update.is_shareable)) {
      await AuditService.log({
        entityType: "shareable_fields",
        entityId: `${chapterId}:${update.field_name}`,
        operation: "UPDATE",
        fieldName: "is_shareable",
        oldValue,
        newValue: String(update.is_shareable),
        actorId,
        actorRole: "ADMIN",
        source: "API",
      });
    }
  }

  return getShareableFields(chapterId);
}

export async function getShareableFieldMap(
  chapterId: string
): Promise<Record<string, boolean>> {
  const fields = await getShareableFields(chapterId);
  return Object.fromEntries(
    fields.map((f) => [f.field_name, f.is_shareable])
  );
}
