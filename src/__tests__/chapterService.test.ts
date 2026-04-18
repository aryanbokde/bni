import { PrismaClient } from "@prisma/client";
import * as ChapterService from "@/services/ChapterService";

const prisma = new PrismaClient();
let chapterId: string;
const actorId = "00000000-0000-0000-0000-000000000099";

beforeAll(async () => {
  const chapter = await prisma.chapters.create({
    data: {
      chapter_name: "ChapterService Test",
      meeting_day: 3,
      meeting_start_time: "08:00:00",
      rsvp_reminder_schedule: [],
      lookback_days: 180,
    },
  });
  chapterId = chapter.chapter_id;
});

afterAll(async () => {
  await prisma.audit_logs.deleteMany({});
  await prisma.shareable_fields.deleteMany({ where: { chapter_id: chapterId } });
  await prisma.chapters.deleteMany({ where: { chapter_id: chapterId } });
  await prisma.$disconnect();
});

describe("ChapterService", () => {
  test("1. updateChapterSettings — writes audit log per changed field", async () => {
    await ChapterService.updateChapterSettings(
      chapterId,
      { lookback_days: 90, cooldown_days: 30 },
      actorId,
      "ADMIN"
    );

    const lookbackAudit = await prisma.audit_logs.findFirst({
      where: {
        entity_id: chapterId,
        field_name: "lookback_days",
        operation: "UPDATE",
      },
    });
    expect(lookbackAudit).not.toBeNull();
    expect(lookbackAudit!.old_value).toBe("180");
    expect(lookbackAudit!.new_value).toBe("90");

    const cooldownAudit = await prisma.audit_logs.findFirst({
      where: {
        entity_id: chapterId,
        field_name: "cooldown_days",
        operation: "UPDATE",
      },
    });
    expect(cooldownAudit).not.toBeNull();
    expect(cooldownAudit!.old_value).toBe("60");
    expect(cooldownAudit!.new_value).toBe("30");
  });

  test("2. updateShareableFields — upserts correctly", async () => {
    const result = await ChapterService.updateShareableFields(
      chapterId,
      [
        { field_name: "full_name", is_shareable: true },
        { field_name: "biz_category", is_shareable: false },
        { field_name: "whatsapp", is_shareable: true },
      ],
      actorId
    );

    expect(result).toHaveLength(3);
    const map = Object.fromEntries(
      result.map((f) => [f.field_name, f.is_shareable])
    );
    expect(map.full_name).toBe(true);
    expect(map.biz_category).toBe(false);
    expect(map.whatsapp).toBe(true);

    // Update one field
    const updated = await ChapterService.updateShareableFields(
      chapterId,
      [{ field_name: "biz_category", is_shareable: true }],
      actorId
    );

    const updatedMap = Object.fromEntries(
      updated.map((f) => [f.field_name, f.is_shareable])
    );
    expect(updatedMap.biz_category).toBe(true);
    // Others unchanged
    expect(updatedMap.full_name).toBe(true);
  });

  test("3. getShareableFieldMap — returns correct boolean map", async () => {
    const map = await ChapterService.getShareableFieldMap(chapterId);

    expect(typeof map.full_name).toBe("boolean");
    expect(map.full_name).toBe(true);
    expect(map.biz_category).toBe(true);
    expect(map.whatsapp).toBe(true);
  });
});
