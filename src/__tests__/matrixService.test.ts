import { PrismaClient } from "@prisma/client";
import * as MatrixService from "@/services/MatrixService";
import { encrypt, hashPhone, hashEmail } from "@/lib/crypto";

const prisma = new PrismaClient();
let chapterId: string;
let memberA: string;
let memberB: string;
let memberC: string;
let memberD: string;

function createEncMember(name: string, overrides: Record<string, unknown> = {}) {
  const ts = Date.now() + Math.random();
  const phone = `+91${String(ts).slice(-10)}`;
  const email = `matrix${ts}@test.com`;
  return {
    chapter_id: chapterId,
    full_name: name,
    mobile_enc: encrypt(phone),
    mobile_hash: hashPhone(phone),
    whatsapp_enc: encrypt(phone),
    whatsapp_hash: hashPhone(phone),
    email_enc: encrypt(email),
    email_hash: hashEmail(email),
    biz_category: "Testing",
    one_line_summary: "Matrix test member summary here",
    office_address: "123 Test Street, Ahmedabad, Gujarat 380001",
    chapter_role: "MEMBER",
    joining_date: new Date(),
    ...overrides,
  };
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

beforeAll(async () => {
  const chapter = await prisma.chapters.create({
    data: {
      chapter_name: "Matrix Test Chapter",
      meeting_day: 4,
      meeting_start_time: "07:00:00",
      rsvp_reminder_schedule: [],
    },
  });
  chapterId = chapter.chapter_id;

  // Create 4 members (names sorted: Alice, Bob, Carol, Dave)
  const a = await prisma.members.create({ data: createEncMember("Alice Tester") });
  const b = await prisma.members.create({ data: createEncMember("Bob Tester") });
  const c = await prisma.members.create({ data: createEncMember("Carol Tester") });
  const d = await prisma.members.create({ data: createEncMember("Dave Tester") });
  memberA = a.member_id;
  memberB = b.member_id;
  memberC = c.member_id;
  memberD = d.member_id;

  // A and B met 30 days ago
  await prisma.member_interactions.create({
    data: {
      chapter_id: chapterId,
      member_a_id: memberA < memberB ? memberA : memberB,
      member_b_id: memberA < memberB ? memberB : memberA,
      interaction_date: daysAgo(30),
      source: "MANUAL",
    },
  });

  // A and C have a SENT recommendation
  await prisma.recommendations.create({
    data: {
      chapter_id: chapterId,
      member_a_id: memberA < memberC ? memberA : memberC,
      member_b_id: memberA < memberC ? memberC : memberA,
      status: "SENT",
      sent_at: daysAgo(5),
    },
  });
});

afterAll(async () => {
  await prisma.audit_logs.deleteMany({});
  await prisma.recommendations.deleteMany({ where: { chapter_id: chapterId } });
  await prisma.member_interactions.deleteMany({ where: { chapter_id: chapterId } });
  await prisma.members.deleteMany({ where: { chapter_id: chapterId } });
  await prisma.chapters.deleteMany({ where: { chapter_id: chapterId } });
  await prisma.$disconnect();
});

describe("MatrixService.getMatrix", () => {
  test("1. 4 members produces 4×4 matrix", async () => {
    const data = await MatrixService.getMatrix(chapterId, 180);
    expect(data.members).toHaveLength(4);
    expect(data.cells).toHaveLength(4);
    for (const row of data.cells) {
      expect(row).toHaveLength(4);
    }
  });

  test("2. A vs B cell is GREEN", async () => {
    const data = await MatrixService.getMatrix(chapterId, 180);
    const idxA = data.members.findIndex((m) => m.member_id === memberA);
    const idxB = data.members.findIndex((m) => m.member_id === memberB);
    expect(data.cells[idxA][idxB].state).toBe("GREEN");
    expect(data.cells[idxA][idxB].lastInteractionDate).toBeDefined();
  });

  test("3. A vs C cell is AMBER", async () => {
    const data = await MatrixService.getMatrix(chapterId, 180);
    const idxA = data.members.findIndex((m) => m.member_id === memberA);
    const idxC = data.members.findIndex((m) => m.member_id === memberC);
    expect(data.cells[idxA][idxC].state).toBe("AMBER");
    expect(data.cells[idxA][idxC].recId).toBeDefined();
  });

  test("4. B vs C cell is GAP", async () => {
    const data = await MatrixService.getMatrix(chapterId, 180);
    const idxB = data.members.findIndex((m) => m.member_id === memberB);
    const idxC = data.members.findIndex((m) => m.member_id === memberC);
    expect(data.cells[idxB][idxC].state).toBe("GAP");
  });

  test("5. diagonal (A vs A) is SELF", async () => {
    const data = await MatrixService.getMatrix(chapterId, 180);
    const idxA = data.members.findIndex((m) => m.member_id === memberA);
    expect(data.cells[idxA][idxA].state).toBe("SELF");
  });

  test("6. matrix is symmetric", async () => {
    const data = await MatrixService.getMatrix(chapterId, 180);
    for (let i = 0; i < data.members.length; i++) {
      for (let j = 0; j < data.members.length; j++) {
        expect(data.cells[i][j].state).toBe(data.cells[j][i].state);
      }
    }
  });

  test("7. windowDays filter: old interaction outside window = GAP", async () => {
    // Add an interaction between B and D from 200 days ago
    await prisma.member_interactions.create({
      data: {
        chapter_id: chapterId,
        member_a_id: memberB < memberD ? memberB : memberD,
        member_b_id: memberB < memberD ? memberD : memberB,
        interaction_date: daysAgo(200),
        source: "MANUAL",
      },
    });

    // With 180-day window: should be GREEN
    const data180 = await MatrixService.getMatrix(chapterId, 180);
    const idxB180 = data180.members.findIndex((m) => m.member_id === memberB);
    const idxD180 = data180.members.findIndex((m) => m.member_id === memberD);

    // With 90-day window: interaction is 200 days old, should be GAP
    const data90 = await MatrixService.getMatrix(chapterId, 90);
    const idxB90 = data90.members.findIndex((m) => m.member_id === memberB);
    const idxD90 = data90.members.findIndex((m) => m.member_id === memberD);
    expect(data90.cells[idxB90][idxD90].state).toBe("GAP");
  });
});

describe("MatrixService.getMemberCoverage", () => {
  test("8. returns correct totalMembers, membersMet, coveragePct", async () => {
    const coverage = await MatrixService.getMemberCoverage(memberA, chapterId, 180);
    // A has met B (interaction 30 days ago) — 1 member met out of 3 total
    expect(coverage.totalMembers).toBe(3);
    expect(coverage.membersMet).toBe(1);
    expect(coverage.notCovered).toBe(2);
    expect(coverage.coveragePct).toBeCloseTo(33.3, 0);
    expect(coverage.lastInteractionDate).toBeDefined();
    expect(coverage.pendingRecs).toBeGreaterThanOrEqual(1);
  });

  test("9. member with zero interactions: coveragePct = 0", async () => {
    // D has no interactions in 90-day window (the B-D one is 200 days old)
    const coverage = await MatrixService.getMemberCoverage(memberD, chapterId, 90);
    expect(coverage.membersMet).toBe(0);
    expect(coverage.coveragePct).toBe(0);
    expect(coverage.lastInteractionDate).toBeNull();
  });
});

describe("MatrixService edge cases", () => {
  test("10. GREEN takes priority over AMBER when pair has both interaction and SENT rec", async () => {
    // A and C already have a SENT rec. Add an interaction between them.
    await prisma.member_interactions.create({
      data: {
        chapter_id: chapterId,
        member_a_id: memberA < memberC ? memberA : memberC,
        member_b_id: memberA < memberC ? memberC : memberA,
        interaction_date: daysAgo(10),
        source: "MANUAL",
      },
    });

    const data = await MatrixService.getMatrix(chapterId, 180);
    const idxA = data.members.findIndex((m) => m.member_id === memberA);
    const idxC = data.members.findIndex((m) => m.member_id === memberC);
    expect(data.cells[idxA][idxC].state).toBe("GREEN");

    // Cleanup: remove the interaction so it doesn't affect other test suites
    await prisma.member_interactions.deleteMany({
      where: {
        chapter_id: chapterId,
        member_a_id: memberA < memberC ? memberA : memberC,
        member_b_id: memberA < memberC ? memberC : memberA,
      },
    });
  });

  test("11. 1-member chapter returns 1×1 matrix with SELF", async () => {
    // Create a separate chapter with 1 member
    const ch = await prisma.chapters.create({
      data: {
        chapter_name: "Solo Chapter",
        meeting_day: 1,
        meeting_start_time: "08:00:00",
        rsvp_reminder_schedule: [],
      },
    });

    const phone = `+91${Date.now().toString().slice(-10)}`;
    const email = `solo${Date.now()}@test.com`;
    await prisma.members.create({
      data: {
        chapter_id: ch.chapter_id,
        full_name: "Solo Member",
        mobile_enc: encrypt(phone),
        mobile_hash: hashPhone(phone),
        whatsapp_enc: encrypt(phone),
        whatsapp_hash: hashPhone(phone),
        email_enc: encrypt(email),
        email_hash: hashEmail(email),
        biz_category: "Testing",
        one_line_summary: "Solo member for matrix test",
        office_address: "123 Solo St, Ahmedabad 380001",
        chapter_role: "MEMBER",
        joining_date: new Date(),
      },
    });

    const data = await MatrixService.getMatrix(ch.chapter_id, 180);
    expect(data.members).toHaveLength(1);
    expect(data.cells).toHaveLength(1);
    expect(data.cells[0]).toHaveLength(1);
    expect(data.cells[0][0].state).toBe("SELF");

    // Cleanup
    await prisma.members.deleteMany({ where: { chapter_id: ch.chapter_id } });
    await prisma.chapters.deleteMany({ where: { chapter_id: ch.chapter_id } });
  });
});
