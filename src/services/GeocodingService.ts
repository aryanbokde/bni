import { prisma } from "@/lib/db";
import { getGoogleMapsAdapter } from "@/adapters";
import { AuditService } from "@/services/AuditService";

export async function geocodeMember(memberId: string): Promise<void> {
  try {
    const member = await prisma.members.findUnique({
      where: { member_id: memberId },
      select: { member_id: true, office_address: true, chapter_id: true },
    });

    if (!member || !member.office_address) return;

    const adapter = getGoogleMapsAdapter();
    const result = await adapter.geocode(member.office_address);

    if (result) {
      await prisma.members.update({
        where: { member_id: memberId },
        data: {
          latitude: result.lat,
          longitude: result.lng,
          geocode_status: "RESOLVED",
        },
      });
    } else {
      await prisma.members.update({
        where: { member_id: memberId },
        data: { geocode_status: "FAILED" },
      });
    }

    AuditService.log({
      entityType: "MEMBER",
      entityId: memberId,
      operation: "UPDATE",
      fieldName: "geocode_status",
      newValue: result ? "RESOLVED" : "FAILED",
      actorId: "SYSTEM",
      actorRole: "SYSTEM",
      source: "SCHEDULER",
    });
  } catch (err) {
    console.error(`[GeocodingService] geocodeMember failed for ${memberId}:`, err);
  }
}

export async function retryPending(): Promise<{
  retried: number;
  resolved: number;
  failed: number;
}> {
  const members = await prisma.members.findMany({
    where: {
      geocode_status: { in: ["PENDING", "FAILED"] },
      status: "ACTIVE",
    },
    select: { member_id: true },
    take: 50,
  });

  let resolved = 0;
  let failed = 0;

  for (const m of members) {
    await geocodeMember(m.member_id);

    // Check outcome
    const updated = await prisma.members.findUnique({
      where: { member_id: m.member_id },
      select: { geocode_status: true },
    });
    if (updated?.geocode_status === "RESOLVED") resolved++;
    else failed++;

    // Rate-limit: 100ms delay between calls
    await new Promise((r) => setTimeout(r, 100));
  }

  return { retried: members.length, resolved, failed };
}
