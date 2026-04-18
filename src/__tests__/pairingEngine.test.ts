import { PrismaClient } from "@prisma/client";
import { encrypt, hashPhone, hashEmail } from "@/lib/crypto";
import { computeEligiblePairs, rankAndCap, pairKey } from "@/services/PairingEngine";
import type { chapters } from "@prisma/client";
import type { MemberDecrypted } from "@/types/member";
import type { PairCandidate } from "@/types/recommendation";

const prisma = new PrismaClient();

let chapter: chapters;
let memberIds: string[] = [];

beforeAll(async () => {
  // Create test chapter
  chapter = await prisma.chapters.create({
    data: {
      chapter_name: "PairingEngine Test Chapter",
      meeting_day: 4,
      meeting_start_time: "07:00:00",
      rsvp_reminder_schedule: [],
      lookback_days: 180,
      cooldown_days: 60,
      max_recs_per_cycle: 3,
    },
  });

  // Create 5 eligible members
  for (let i = 1; i <= 5; i++) {
    const phone = `+9190000${String(i).padStart(5, "0")}`;
    const email = `pairing-test-${i}@bni.com`;
    const m = await prisma.members.create({
      data: {
        chapter_id: chapter.chapter_id,
        full_name: `Pairing Member ${i}`,
        mobile_enc: encrypt(phone),
        mobile_hash: hashPhone(phone),
        whatsapp_enc: encrypt(phone),
        whatsapp_hash: hashPhone(phone),
        email_enc: encrypt(email),
        email_hash: hashEmail(email),
        biz_category: `Category ${i}`,
        one_line_summary: `Test member ${i} for pairing engine`,
        office_address: `${i}00 Test Road, Ahmedabad`,
        status: "ACTIVE",
        comm_eligible: true,
        rec_active: true,
        geocode_status: "RESOLVED",
        chapter_role: "MEMBER",
        joining_date: new Date(),
      },
    });
    memberIds.push(m.member_id);
  }
});

afterAll(async () => {
  await prisma.member_interactions.deleteMany({ where: { chapter_id: chapter.chapter_id } });
  await prisma.recommendations.deleteMany({ where: { chapter_id: chapter.chapter_id } });
  await prisma.recommendation_runs.deleteMany({ where: { chapter_id: chapter.chapter_id } });
  await prisma.members.deleteMany({ where: { chapter_id: chapter.chapter_id } });
  await prisma.chapters.deleteMany({ where: { chapter_id: chapter.chapter_id } });
  await prisma.$disconnect();
});

describe("computeEligiblePairs", () => {
  afterEach(async () => {
    await prisma.member_interactions.deleteMany({ where: { chapter_id: chapter.chapter_id } });
    await prisma.recommendations.deleteMany({ where: { chapter_id: chapter.chapter_id } });
  });

  test("1. returns all unique pairs (10 for 5 members) when no history", async () => {
    const pairs = await computeEligiblePairs(chapter.chapter_id, chapter);
    // C(5,2) = 10
    expect(pairs).toHaveLength(10);
  });

  test("2. excludes pairs that met within lookback window", async () => {
    // Create a recent interaction between member 1 and 2
    const [a, b] = memberIds[0] < memberIds[1] ? [memberIds[0], memberIds[1]] : [memberIds[1], memberIds[0]];
    await prisma.member_interactions.create({
      data: {
        chapter_id: chapter.chapter_id,
        member_a_id: a,
        member_b_id: b,
        interaction_date: new Date(), // today = within lookback
        source: "TEST",
      },
    });

    const pairs = await computeEligiblePairs(chapter.chapter_id, chapter);
    expect(pairs).toHaveLength(9);

    const keys = pairs.map((p) => pairKey(p.member_a.member_id, p.member_b.member_id));
    expect(keys).not.toContain(pairKey(memberIds[0], memberIds[1]));
  });

  test("3. excludes pairs with open recommendations", async () => {
    const [a, b] = memberIds[0] < memberIds[2] ? [memberIds[0], memberIds[2]] : [memberIds[2], memberIds[0]];
    await prisma.recommendations.create({
      data: {
        chapter_id: chapter.chapter_id,
        member_a_id: a,
        member_b_id: b,
        status: "SENT",
      },
    });

    const pairs = await computeEligiblePairs(chapter.chapter_id, chapter);
    const keys = pairs.map((p) => pairKey(p.member_a.member_id, p.member_b.member_id));
    expect(keys).not.toContain(pairKey(memberIds[0], memberIds[2]));
    expect(pairs).toHaveLength(9);
  });

  test("4. excludes pairs in cooldown period", async () => {
    const [a, b] = memberIds[1] < memberIds[3] ? [memberIds[1], memberIds[3]] : [memberIds[3], memberIds[1]];
    // Recently completed rec (within cooldown)
    await prisma.recommendations.create({
      data: {
        chapter_id: chapter.chapter_id,
        member_a_id: a,
        member_b_id: b,
        status: "COMPLETED",
        completed_at: new Date(),
        // updated_at is auto-set to now by Prisma @updatedAt
      },
    });

    const pairs = await computeEligiblePairs(chapter.chapter_id, chapter);
    const keys = pairs.map((p) => pairKey(p.member_a.member_id, p.member_b.member_id));
    expect(keys).not.toContain(pairKey(memberIds[1], memberIds[3]));
  });

  test("5. excludes EXCLUDED pairs", async () => {
    const [a, b] = memberIds[2] < memberIds[4] ? [memberIds[2], memberIds[4]] : [memberIds[4], memberIds[2]];
    await prisma.recommendations.create({
      data: {
        chapter_id: chapter.chapter_id,
        member_a_id: a,
        member_b_id: b,
        status: "EXCLUDED",
        excluded_at: new Date(),
        excluded_by: memberIds[0],
        excluded_reason: "Test exclusion",
      },
    });

    const pairs = await computeEligiblePairs(chapter.chapter_id, chapter);
    const keys = pairs.map((p) => pairKey(p.member_a.member_id, p.member_b.member_id));
    expect(keys).not.toContain(pairKey(memberIds[2], memberIds[4]));
  });
});

describe("rankAndCap", () => {
  function makePair(aId: string, bId: string, lastDate: Date | null): PairCandidate {
    return {
      member_a: { member_id: aId } as MemberDecrypted,
      member_b: { member_id: bId } as MemberDecrypted,
      lastInteractionDate: lastDate,
    };
  }

  test("6. sorts null lastInteractionDate first (never-met pairs)", () => {
    const pairs = [
      makePair("a", "b", new Date("2026-01-01")),
      makePair("c", "d", null),
      makePair("e", "f", new Date("2025-06-01")),
    ];

    const ranked = rankAndCap(pairs, 10);
    expect(ranked[0].lastInteractionDate).toBeNull();
    expect(ranked[1].lastInteractionDate!.getTime()).toBeLessThan(
      ranked[2].lastInteractionDate!.getTime()
    );
  });

  test("7. enforces per-member cap correctly", () => {
    // Member "a" appears in 3 pairs, cap is 2
    const pairs = [
      makePair("a", "b", null),
      makePair("a", "c", null),
      makePair("a", "d", null),
      makePair("b", "c", null),
    ];

    const ranked = rankAndCap(pairs, 2);
    const aCount = ranked.filter(
      (p) => p.member_a.member_id === "a" || p.member_b.member_id === "a"
    ).length;
    expect(aCount).toBeLessThanOrEqual(2);
  });

  test("8. returns fewer pairs than cap when members exhausted", () => {
    // Only 2 members, 1 possible pair, cap is 5
    const pairs = [makePair("x", "y", null)];
    const ranked = rankAndCap(pairs, 5);
    expect(ranked).toHaveLength(1);
  });
});
