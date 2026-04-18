import { prisma } from "@/lib/db";
import { pairKey } from "@/services/PairingEngine";
import { decryptMember } from "@/services/memberHelpers";
import type { MatrixData, MatrixCell, MemberCoverage } from "@/types/matrix";

export async function getMatrix(
  chapterId: string,
  windowDays: number
): Promise<MatrixData> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);

  // 1. Load ACTIVE members, sort alphabetically
  const rawMembers = await prisma.members.findMany({
    where: { chapter_id: chapterId, status: "ACTIVE" },
    orderBy: { full_name: "asc" },
  });

  const members = rawMembers.map(decryptMember);

  // 2. Load interactions in window
  const interactions = await prisma.member_interactions.findMany({
    where: {
      chapter_id: chapterId,
      interaction_date: { gte: cutoff },
    },
    select: { member_a_id: true, member_b_id: true, interaction_date: true },
    orderBy: { interaction_date: "desc" },
  });

  // 3. Load SENT recommendations
  const sentRecs = await prisma.recommendations.findMany({
    where: { chapter_id: chapterId, status: "SENT" },
    select: { rec_id: true, member_a_id: true, member_b_id: true, sent_at: true },
  });

  // 4. Load EXCLUDED recommendations
  const excludedRecs = await prisma.recommendations.findMany({
    where: { chapter_id: chapterId, status: "EXCLUDED" },
    select: { rec_id: true, member_a_id: true, member_b_id: true },
  });

  // Build lookup maps
  const interactionMap = new Map<string, Date>();
  for (const ix of interactions) {
    const key = pairKey(ix.member_a_id, ix.member_b_id);
    // Keep the most recent (already sorted desc)
    if (!interactionMap.has(key)) {
      interactionMap.set(key, ix.interaction_date);
    }
  }

  const sentRecMap = new Map<string, { recId: string; sentAt: Date | null }>();
  for (const r of sentRecs) {
    const key = pairKey(r.member_a_id, r.member_b_id);
    if (!sentRecMap.has(key)) {
      sentRecMap.set(key, { recId: r.rec_id, sentAt: r.sent_at });
    }
  }

  const excludedMap = new Map<string, string>();
  for (const r of excludedRecs) {
    excludedMap.set(pairKey(r.member_a_id, r.member_b_id), r.rec_id);
  }

  // 5. Build N×N matrix
  const n = members.length;
  const cells: MatrixCell[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => ({ state: "GAP" as const }))
  );

  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      if (i === j) {
        cells[i][j] = { state: "SELF" };
        continue;
      }

      const key = pairKey(members[i].member_id, members[j].member_id);

      let cell: MatrixCell;

      if (interactionMap.has(key)) {
        cell = { state: "GREEN", lastInteractionDate: interactionMap.get(key)! };
      } else if (sentRecMap.has(key)) {
        const rec = sentRecMap.get(key)!;
        cell = { state: "AMBER", recId: rec.recId, recSentAt: rec.sentAt ?? undefined };
      } else if (excludedMap.has(key)) {
        cell = { state: "EXCLUDED", recId: excludedMap.get(key)! };
      } else {
        cell = { state: "GAP" };
      }

      // Symmetric
      cells[i][j] = cell;
      cells[j][i] = cell;
    }
  }

  return { members, cells };
}

export async function getMemberCoverage(
  memberId: string,
  chapterId: string,
  windowDays: number
): Promise<MemberCoverage> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);

  // 1. Total ACTIVE members excluding self
  const totalMembers = await prisma.members.count({
    where: { chapter_id: chapterId, status: "ACTIVE", member_id: { not: memberId } },
  });

  // 2. Unique members met in window
  const interactions = await prisma.member_interactions.findMany({
    where: {
      chapter_id: chapterId,
      interaction_date: { gte: cutoff },
      OR: [{ member_a_id: memberId }, { member_b_id: memberId }],
    },
    select: { member_a_id: true, member_b_id: true, interaction_date: true },
    orderBy: { interaction_date: "desc" },
  });

  const metSet = new Set<string>();
  let lastInteractionDate: Date | null = null;

  for (const ix of interactions) {
    const other = ix.member_a_id === memberId ? ix.member_b_id : ix.member_a_id;
    metSet.add(other);
    if (!lastInteractionDate || ix.interaction_date > lastInteractionDate) {
      lastInteractionDate = ix.interaction_date;
    }
  }

  const membersMet = metSet.size;

  // 3. Count SENT recs involving this member
  const pendingRecs = await prisma.recommendations.count({
    where: {
      chapter_id: chapterId,
      status: "SENT",
      OR: [{ member_a_id: memberId }, { member_b_id: memberId }],
    },
  });

  // 4. Compute coverage
  const coveragePct = totalMembers > 0
    ? Math.round((membersMet / totalMembers) * 100 * 10) / 10
    : 0;

  return {
    totalMembers,
    membersMet,
    notCovered: totalMembers - membersMet,
    coveragePct,
    lastInteractionDate,
    pendingRecs,
  };
}
