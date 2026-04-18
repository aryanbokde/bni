import { PrismaClient } from "@prisma/client";
import * as GeocodingService from "@/services/GeocodingService";
import * as adapters from "@/adapters";
import { encrypt, hashPhone, hashEmail } from "@/lib/crypto";
import type { GoogleMapsAdapter } from "@/adapters/GoogleMapsAdapter";

const prisma = new PrismaClient();
let chapterId: string;
let memberId: string;

function createEncMember(
  overrides: Record<string, unknown> = {}
) {
  const phone = `+91${Date.now().toString().slice(-10)}`;
  const email = `geo${Date.now()}@test.com`;
  return {
    chapter_id: chapterId,
    full_name: "Geo Test Member",
    mobile_enc: encrypt(phone),
    mobile_hash: hashPhone(phone),
    whatsapp_enc: encrypt(phone),
    whatsapp_hash: hashPhone(phone),
    email_enc: encrypt(email),
    email_hash: hashEmail(email),
    biz_category: "Testing",
    one_line_summary: "Test member for geocoding",
    office_address: "123 Test Street, Ahmedabad, Gujarat 380001",
    chapter_role: "MEMBER",
    joining_date: new Date(),
    geocode_status: "PENDING",
    ...overrides,
  };
}

beforeAll(async () => {
  const chapter = await prisma.chapters.create({
    data: {
      chapter_name: "Geocoding Test Chapter",
      meeting_day: 3,
      meeting_start_time: "07:00:00",
      rsvp_reminder_schedule: [],
    },
  });
  chapterId = chapter.chapter_id;
});

afterAll(async () => {
  await prisma.audit_logs.deleteMany({});
  await prisma.members.deleteMany({ where: { chapter_id: chapterId } });
  await prisma.chapters.deleteMany({ where: { chapter_id: chapterId } });
  await prisma.$disconnect();
});

describe("GeocodingService", () => {
  test("1. geocodeMember — PENDING member: updates to RESOLVED with coordinates", async () => {
    const member = await prisma.members.create({ data: createEncMember() });
    memberId = member.member_id;

    await GeocodingService.geocodeMember(memberId);

    const updated = await prisma.members.findUnique({
      where: { member_id: memberId },
    });
    expect(updated!.geocode_status).toBe("RESOLVED");
    expect(updated!.latitude).toBe(23.0225);
    expect(updated!.longitude).toBe(72.5714);
  });

  test("2. geocodeMember — adapter returns null: sets status=FAILED", async () => {
    const member = await prisma.members.create({ data: createEncMember() });

    // Mock adapter to return null
    const originalGet = adapters.getGoogleMapsAdapter;
    const nullAdapter: GoogleMapsAdapter = {
      geocode: async () => null,
    };
    jest
      .spyOn(adapters, "getGoogleMapsAdapter")
      .mockReturnValue(nullAdapter);

    await GeocodingService.geocodeMember(member.member_id);

    const updated = await prisma.members.findUnique({
      where: { member_id: member.member_id },
    });
    expect(updated!.geocode_status).toBe("FAILED");
    expect(updated!.latitude).toBeNull();

    jest.restoreAllMocks();
  });

  test("3. geocodeMember — adapter throws error: status remains PENDING (caught gracefully)", async () => {
    const member = await prisma.members.create({ data: createEncMember() });

    const errorAdapter: GoogleMapsAdapter = {
      geocode: async () => {
        throw new Error("API quota exceeded");
      },
    };
    jest
      .spyOn(adapters, "getGoogleMapsAdapter")
      .mockReturnValue(errorAdapter);

    // Should not throw
    await GeocodingService.geocodeMember(member.member_id);

    const updated = await prisma.members.findUnique({
      where: { member_id: member.member_id },
    });
    expect(updated!.geocode_status).toBe("PENDING");

    jest.restoreAllMocks();
  });

  test("4. retryPending — processes up to 50 members", async () => {
    // Clean ALL existing test members to start fresh
    await prisma.audit_logs.deleteMany({});
    await prisma.members.deleteMany({ where: { chapter_id: chapterId } });

    // Create 3 PENDING members
    const created: string[] = [];
    for (let i = 0; i < 3; i++) {
      const m = await prisma.members.create({
        data: createEncMember({ geocode_status: "PENDING" }),
      });
      created.push(m.member_id);
    }

    // Mock setTimeout to avoid real delays
    jest.useFakeTimers({ advanceTimers: true });

    const result = await GeocodingService.retryPending();

    jest.useRealTimers();

    // Our 3 members should be resolved (other suites may add extras)
    expect(result.retried).toBeGreaterThanOrEqual(3);
    expect(result.resolved).toBeGreaterThanOrEqual(3);

    // Verify our members are now RESOLVED
    for (const id of created) {
      const m = await prisma.members.findUnique({ where: { member_id: id } });
      expect(m!.geocode_status).toBe("RESOLVED");
    }
  });

  test("5. retryPending — respects rate limiting delay", async () => {
    // Clean ALL existing test members to start fresh
    await prisma.audit_logs.deleteMany({});
    await prisma.members.deleteMany({ where: { chapter_id: chapterId } });

    // Create 5 PENDING members
    for (let i = 0; i < 5; i++) {
      await prisma.members.create({
        data: createEncMember({ geocode_status: "PENDING" }),
      });
    }

    const start = Date.now();
    const result = await GeocodingService.retryPending();
    const elapsed = Date.now() - start;

    expect(result.retried).toBeGreaterThanOrEqual(5);
    // 5+ members × 100ms delay each
    expect(elapsed).toBeGreaterThanOrEqual(400);
  });
});
