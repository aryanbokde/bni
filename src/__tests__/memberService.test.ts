import { PrismaClient } from "@prisma/client";
import * as MemberService from "@/services/MemberService";
import type { CreateMemberDto } from "@/types/member";

const prisma = new PrismaClient();
let chapterId: string;
let actorId: string;

const baseDto: CreateMemberDto = {
  full_name: "Test Member One",
  mobile: "+911234567890",
  whatsapp: "+911234567890",
  email: "testmember1@example.com",
  biz_category: "Software Development",
  one_line_summary: "Full stack developer building awesome apps",
  office_address: "123 Test Street, Ahmedabad, Gujarat 380001",
  chapter_role: "MEMBER",
  joining_date: new Date().toISOString(),
};

beforeAll(async () => {
  const chapter = await prisma.chapters.create({
    data: {
      chapter_name: "MemberService Test Chapter",
      meeting_day: 2,
      meeting_start_time: "07:00:00",
      rsvp_reminder_schedule: [],
    },
  });
  chapterId = chapter.chapter_id;
  actorId = "00000000-0000-0000-0000-000000000001";
});

afterAll(async () => {
  await prisma.audit_logs.deleteMany({});
  await prisma.members.deleteMany({ where: { chapter_id: chapterId } });
  await prisma.chapters.deleteMany({ where: { chapter_id: chapterId } });
  await prisma.$disconnect();
});

describe("MemberService", () => {
  let createdMemberId: string;

  test("1. createMember — happy path", async () => {
    const member = await MemberService.createMember(chapterId, baseDto, actorId);

    createdMemberId = member.member_id;
    expect(member.member_id).toBeDefined();
    expect(member.full_name).toBe("Test Member One");
    expect(member.mobile).toBe("+911234567890");
    expect(member.email).toBe("testmember1@example.com");
    expect(member.chapter_role).toBe("MEMBER");
    expect(member.status).toBe("ACTIVE");
    expect(member.password_hash).toBeNull();
  });

  test("2. createMember — duplicate mobile: throws MEMBER_DUPLICATE_MOBILE", async () => {
    await expect(
      MemberService.createMember(
        chapterId,
        {
          ...baseDto,
          whatsapp: "+919999999999",
          email: "unique1@example.com",
          // mobile same as baseDto
        },
        actorId
      )
    ).rejects.toMatchObject({ code: "MEMBER_DUPLICATE_MOBILE" });
  });

  test("3. createMember — duplicate whatsapp: throws MEMBER_DUPLICATE_WHATSAPP", async () => {
    await expect(
      MemberService.createMember(
        chapterId,
        {
          ...baseDto,
          mobile: "+918888888888",
          email: "unique2@example.com",
          // whatsapp same as baseDto
        },
        actorId
      )
    ).rejects.toMatchObject({ code: "MEMBER_DUPLICATE_WHATSAPP" });
  });

  test("4. createMember — missing required field: throws validation error", async () => {
    await expect(
      MemberService.createMember(
        chapterId,
        { ...baseDto, full_name: "" } as CreateMemberDto,
        actorId
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  test("5. updateMember — changes name: audit log written", async () => {
    const updated = await MemberService.updateMember(
      createdMemberId,
      chapterId,
      { full_name: "Updated Name" },
      actorId
    );

    expect(updated.full_name).toBe("Updated Name");

    const audit = await prisma.audit_logs.findFirst({
      where: {
        entity_id: createdMemberId,
        field_name: "full_name",
        operation: "UPDATE",
      },
      orderBy: { occurred_at: "desc" },
    });
    expect(audit).not.toBeNull();
    expect(audit!.old_value).toBe("Test Member One");
    expect(audit!.new_value).toBe("Updated Name");
  });

  test("6. updateMember — changes address: geocode_status reset to PENDING", async () => {
    const updated = await MemberService.updateMember(
      createdMemberId,
      chapterId,
      { office_address: "456 New Street, Mumbai, Maharashtra 400001" },
      actorId
    );

    expect(updated.geocode_status).toBe("PENDING");
  });

  test("7. archiveMember — sets status=ARCHIVED, comm_eligible=false, rec_active=false", async () => {
    await MemberService.archiveMember(
      createdMemberId,
      "No longer active",
      actorId,
      "ADMIN"
    );

    const member = await prisma.members.findUnique({
      where: { member_id: createdMemberId },
    });
    expect(member!.status).toBe("ARCHIVED");
    expect(member!.comm_eligible).toBe(false);
    expect(member!.rec_active).toBe(false);
  });

  test("8. archiveMember — already archived: throws 409", async () => {
    await expect(
      MemberService.archiveMember(createdMemberId, "Again", actorId, "ADMIN")
    ).rejects.toMatchObject({ code: "MEMBER_ALREADY_ARCHIVED", httpStatus: 409 });
  });

  test("9. getMembersByChapter — filters by status", async () => {
    // Restore the archived member so we have both statuses
    await MemberService.restoreMember(createdMemberId, actorId, "ADMIN");

    // Create a second member and archive it
    const second = await MemberService.createMember(
      chapterId,
      {
        ...baseDto,
        full_name: "Second Member",
        mobile: "+917777777777",
        whatsapp: "+917777777777",
        email: "second@example.com",
      },
      actorId
    );
    await MemberService.archiveMember(second.member_id, "test", actorId, "ADMIN");

    const activeOnly = await MemberService.getMembersByChapter(chapterId, {
      status: "ACTIVE",
    });
    const archivedOnly = await MemberService.getMembersByChapter(chapterId, {
      status: "ARCHIVED",
    });

    expect(activeOnly.every((m) => m.status === "ACTIVE")).toBe(true);
    expect(archivedOnly.every((m) => m.status === "ARCHIVED")).toBe(true);
    expect(activeOnly.length).toBeGreaterThanOrEqual(1);
    expect(archivedOnly.length).toBeGreaterThanOrEqual(1);
  });

  test("10. checkDuplicates — allows same phone if excludeMemberId matches", async () => {
    const { hashPhone } = await import("@/lib/crypto");
    const mobileHash = hashPhone("+911234567890");

    // Should NOT throw when excluding self
    await expect(
      MemberService.checkDuplicates(
        chapterId,
        { mobileHash },
        createdMemberId
      )
    ).resolves.toBeUndefined();

    // Should throw when not excluding
    await expect(
      MemberService.checkDuplicates(chapterId, { mobileHash })
    ).rejects.toMatchObject({ code: "MEMBER_DUPLICATE_MOBILE" });
  });
});
