import { prisma } from "@/lib/db";
import * as MemberService from "@/services/MemberService";
import type { chapters } from "@prisma/client";
import type { MemberDecrypted } from "@/types/member";
import type { PairCandidate } from "@/types/recommendation";

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export async function computeEligiblePairs(
  chapterId: string,
  chapter: chapters
): Promise<PairCandidate[]> {
  // 1. Get eligible members
  const members = await MemberService.getEligibleForRecommendation(chapterId);

  // 2. Need at least 2 members
  if (members.length < 2) return [];

  // 3. Generate all unique pairs (a_id < b_id)
  const allPairs: { a: MemberDecrypted; b: MemberDecrypted; key: string }[] = [];
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const a = members[i];
      const b = members[j];
      const key =
        a.member_id < b.member_id
          ? `${a.member_id}|${b.member_id}`
          : `${b.member_id}|${a.member_id}`;
      allPairs.push({
        a: a.member_id < b.member_id ? a : b,
        b: a.member_id < b.member_id ? b : a,
        key,
      });
    }
  }

  const now = new Date();
  const lookbackDate = new Date(
    now.getTime() - chapter.lookback_days * 24 * 60 * 60 * 1000
  );
  const cooldownDate = new Date(
    now.getTime() - chapter.cooldown_days * 24 * 60 * 60 * 1000
  );

  // 4. Load 4 lookup sets + lastMetMap in parallel
  const [recentInteractions, openRecs, cooldownRecs, excludedRecs] =
    await Promise.all([
      // a) Recent interactions within lookback window
      prisma.member_interactions.findMany({
        where: {
          chapter_id: chapterId,
          interaction_date: { gte: lookbackDate },
        },
        select: { member_a_id: true, member_b_id: true, interaction_date: true },
      }),
      // b) Open recommendations (QUEUED or SENT)
      prisma.recommendations.findMany({
        where: {
          chapter_id: chapterId,
          status: { in: ["QUEUED", "SENT"] },
        },
        select: { member_a_id: true, member_b_id: true },
      }),
      // c) Recently completed/updated within cooldown
      prisma.recommendations.findMany({
        where: {
          chapter_id: chapterId,
          updated_at: { gte: cooldownDate },
        },
        select: { member_a_id: true, member_b_id: true },
      }),
      // d) Excluded recommendations
      prisma.recommendations.findMany({
        where: {
          chapter_id: chapterId,
          status: "EXCLUDED",
        },
        select: { member_a_id: true, member_b_id: true },
      }),
    ]);

  // Build sets
  const recentMet = new Set(
    recentInteractions.map((r) => pairKey(r.member_a_id, r.member_b_id))
  );

  const openRecsSet = new Set(
    openRecs.map((r) => pairKey(r.member_a_id, r.member_b_id))
  );

  const cooldownSet = new Set(
    cooldownRecs.map((r) => pairKey(r.member_a_id, r.member_b_id))
  );

  const excludedSet = new Set(
    excludedRecs.map((r) => pairKey(r.member_a_id, r.member_b_id))
  );

  // 5. Build lastMetMap from ALL interactions (not just lookback)
  const allInteractions = await prisma.member_interactions.findMany({
    where: { chapter_id: chapterId },
    select: { member_a_id: true, member_b_id: true, interaction_date: true },
    orderBy: { interaction_date: "desc" },
  });

  const lastMetMap = new Map<string, Date>();
  for (const ix of allInteractions) {
    const key = pairKey(ix.member_a_id, ix.member_b_id);
    if (!lastMetMap.has(key)) {
      lastMetMap.set(key, ix.interaction_date);
    }
  }

  // 6. Filter candidates
  const filtered = allPairs.filter(
    (p) =>
      !recentMet.has(p.key) &&
      !openRecsSet.has(p.key) &&
      !cooldownSet.has(p.key) &&
      !excludedSet.has(p.key)
  );

  // 7. Map to PairCandidate
  return filtered.map((p) => ({
    member_a: p.a,
    member_b: p.b,
    lastInteractionDate: lastMetMap.get(p.key) ?? null,
  }));
}

export function rankAndCap(
  pairs: PairCandidate[],
  maxPerMember: number
): PairCandidate[] {
  // 1. Sort: null first (never met), then ascending by date (oldest first)
  const sorted = [...pairs].sort((a, b) => {
    if (a.lastInteractionDate === null && b.lastInteractionDate === null)
      return 0;
    if (a.lastInteractionDate === null) return -1;
    if (b.lastInteractionDate === null) return 1;
    return a.lastInteractionDate.getTime() - b.lastInteractionDate.getTime();
  });

  // 2-3. Walk sorted list, track per-member count, cap
  const memberCount = new Map<string, number>();
  const result: PairCandidate[] = [];

  for (const pair of sorted) {
    const aCount = memberCount.get(pair.member_a.member_id) ?? 0;
    const bCount = memberCount.get(pair.member_b.member_id) ?? 0;

    if (aCount >= maxPerMember || bCount >= maxPerMember) continue;

    result.push(pair);
    memberCount.set(pair.member_a.member_id, aCount + 1);
    memberCount.set(pair.member_b.member_id, bCount + 1);
  }

  return result;
}
