import { PrismaClient } from "@prisma/client";
import { encrypt, hashPhone, hashEmail } from "@/lib/crypto";

const prisma = new PrismaClient();

let testChapterId: string;
let testMemberId: string;
let testMobileHash: string;

beforeAll(async () => {
  // Create self-contained test data
  const chapter = await prisma.chapters.create({
    data: {
      chapter_name: "DB Test Chapter",
      meeting_day: 4,
      meeting_start_time: "07:00:00",
      timezone: "Asia/Kolkata",
      rsvp_reminder_schedule: [],
      lookback_days: 180,
      cooldown_days: 60,
      max_recs_per_cycle: 3,
    },
  });
  testChapterId = chapter.chapter_id;

  // Seed shareable fields
  const fields = [
    { field_name: "full_name", is_shareable: true },
    { field_name: "biz_category", is_shareable: true },
    { field_name: "one_line_summary", is_shareable: true },
    { field_name: "intro_text", is_shareable: false },
    { field_name: "whatsapp", is_shareable: true },
    { field_name: "office_address", is_shareable: false },
  ];
  for (const f of fields) {
    await prisma.shareable_fields.create({
      data: { chapter_id: testChapterId, ...f },
    });
  }

  // Create a test member
  testMobileHash = hashPhone("+910099990001");
  const member = await prisma.members.create({
    data: {
      chapter_id: testChapterId,
      full_name: "DB Test Member",
      mobile_enc: encrypt("+910099990001"),
      mobile_hash: testMobileHash,
      whatsapp_enc: encrypt("+910099990001"),
      whatsapp_hash: hashPhone("+910099990001"),
      email_enc: encrypt("dbtest@bni.com"),
      email_hash: hashEmail("dbtest@bni.com"),
      biz_category: "Testing",
      one_line_summary: "DB test member",
      office_address: "Test",
      joining_date: new Date(),
    },
  });
  testMemberId = member.member_id;
});

afterAll(async () => {
  try {
    await prisma.member_interactions.deleteMany({ where: { chapter_id: testChapterId } });
    await prisma.members.deleteMany({ where: { chapter_id: testChapterId } });
    await prisma.shareable_fields.deleteMany({ where: { chapter_id: testChapterId } });
    await prisma.chapters.deleteMany({ where: { chapter_id: testChapterId } });
  } catch {
    // Already cleaned by another test suite
  }
  await prisma.$disconnect();
});

describe("Database", () => {
  test("PrismaClient connects to MySQL successfully", async () => {
    const result = await prisma.$queryRaw<[{ "1": bigint }]>`SELECT 1`;
    expect(Number(result[0]["1"])).toBe(1);
  });

  test("test chapter exists with correct fields", async () => {
    const chapter = await prisma.chapters.findUnique({
      where: { chapter_id: testChapterId },
    });
    expect(chapter).not.toBeNull();
    expect(chapter!.meeting_day).toBe(4);
    expect(chapter!.timezone).toBe("Asia/Kolkata");
    expect(chapter!.lookback_days).toBe(180);
    expect(chapter!.cooldown_days).toBe(60);
    expect(chapter!.max_recs_per_cycle).toBe(3);
  });

  test("shareable_fields are seeded correctly (6 fields)", async () => {
    const fields = await prisma.shareable_fields.findMany({
      where: { chapter_id: testChapterId },
      orderBy: { field_name: "asc" },
    });

    expect(fields).toHaveLength(6);

    const fieldMap = Object.fromEntries(
      fields.map((f) => [f.field_name, f.is_shareable])
    );
    expect(fieldMap).toEqual({
      biz_category: true,
      full_name: true,
      intro_text: false,
      office_address: false,
      one_line_summary: true,
      whatsapp: true,
    });
  });

  test("UNIQUE constraint on (chapter_id, mobile_hash) is enforced", async () => {
    await expect(
      prisma.members.create({
        data: {
          chapter_id: testChapterId,
          full_name: "Duplicate Test",
          mobile_enc: Buffer.from("test"),
          mobile_hash: testMobileHash, // same hash = should fail
          whatsapp_enc: Buffer.from("test"),
          whatsapp_hash: "unique-whatsapp-hash-for-test-0000000000000000000000000000",
          email_enc: Buffer.from("test"),
          email_hash: "unique-email-hash-for-test-00000000000000000000000000000000",
          biz_category: "Test",
          one_line_summary: "Test duplicate",
          office_address: "Test",
          joining_date: new Date(),
        },
      })
    ).rejects.toThrow();
  });

  test("member_interactions does NOT enforce a_id < b_id at DB level (application concern)", async () => {
    const idA = "zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz";
    const idB = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

    const interaction = await prisma.member_interactions.create({
      data: {
        chapter_id: testChapterId,
        member_a_id: idA,
        member_b_id: idB,
        interaction_date: new Date(),
        source: "TEST",
      },
    });

    expect(interaction.interaction_id).toBeDefined();

    await prisma.member_interactions.deleteMany({
      where: { interaction_id: interaction.interaction_id },
    });
  });
});
