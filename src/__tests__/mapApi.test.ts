import { PrismaClient } from "@prisma/client";
import { encrypt, hashPhone, hashEmail } from "@/lib/crypto";
import { signAccessToken } from "@/lib/auth";

const prisma = new PrismaClient();
let chapterId: string;
let resolvedMemberId: string;
let pendingMemberId: string;
let archivedMemberId: string;

function createEncMember(overrides: Record<string, unknown> = {}) {
  const phone = `+91${Date.now().toString().slice(-10)}`;
  const email = `map${Date.now()}@test.com`;
  return {
    chapter_id: chapterId,
    full_name: "Map Test Member",
    mobile_enc: encrypt(phone),
    mobile_hash: hashPhone(phone),
    whatsapp_enc: encrypt(phone),
    whatsapp_hash: hashPhone(phone),
    email_enc: encrypt(email),
    email_hash: hashEmail(email),
    biz_category: "Testing",
    one_line_summary: "Map test summary",
    office_address: "123 Test Street, Satellite, Ahmedabad, Gujarat 380015",
    chapter_role: "MEMBER",
    joining_date: new Date(),
    geocode_status: "PENDING",
    ...overrides,
  };
}

function makeRequest(token: string): Request {
  return new Request("http://localhost:3000/api/test", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

beforeAll(async () => {
  const chapter = await prisma.chapters.create({
    data: {
      chapter_name: "Map API Test Chapter",
      meeting_day: 4,
      meeting_start_time: "07:00:00",
      rsvp_reminder_schedule: [],
      location_display_mode: "AREA_ONLY",
    },
  });
  chapterId = chapter.chapter_id;

  // Seed shareable fields — whatsapp NOT shareable
  const fieldDefaults = [
    { field_name: "full_name", is_shareable: true },
    { field_name: "biz_category", is_shareable: true },
    { field_name: "one_line_summary", is_shareable: true },
    { field_name: "whatsapp", is_shareable: false },
    { field_name: "office_address", is_shareable: true },
  ];
  for (const f of fieldDefaults) {
    await prisma.shareable_fields.create({
      data: { chapter_id: chapterId, ...f },
    });
  }

  // Create RESOLVED member
  const resolved = await prisma.members.create({
    data: createEncMember({
      full_name: "Resolved Member",
      geocode_status: "RESOLVED",
      latitude: 23.0225,
      longitude: 72.5714,
    }),
  });
  resolvedMemberId = resolved.member_id;

  // Create PENDING member
  const pending = await prisma.members.create({
    data: createEncMember({
      full_name: "Pending Member",
      geocode_status: "PENDING",
    }),
  });
  pendingMemberId = pending.member_id;

  // Create ARCHIVED member (should not appear)
  const archived = await prisma.members.create({
    data: createEncMember({
      full_name: "Archived Member",
      status: "ARCHIVED",
      geocode_status: "RESOLVED",
      latitude: 23.05,
      longitude: 72.60,
    }),
  });
  archivedMemberId = archived.member_id;
});

afterAll(async () => {
  await prisma.audit_logs.deleteMany({});
  await prisma.shareable_fields.deleteMany({ where: { chapter_id: chapterId } });
  await prisma.members.deleteMany({ where: { chapter_id: chapterId } });
  await prisma.chapters.deleteMany({ where: { chapter_id: chapterId } });
  await prisma.$disconnect();
});

describe("GET /api/chapters/[chapterId]/map/members", () => {
  // Import the route handler
  let GET: (req: Request, ctx: { params: Record<string, string> }) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import(
      "@/app/api/chapters/[chapterId]/map/members/route"
    );
    GET = mod.GET;
  });

  test("1. returns only ACTIVE members", async () => {
    const token = signAccessToken({
      memberId: resolvedMemberId,
      chapterId,
      role: "MEMBER",
    });
    const req = makeRequest(token);
    const res = await GET(req, { params: { chapterId } });
    const body = await res.json();

    const allIds = [
      ...body.data.pins.map((m: { member_id: string }) => m.member_id),
      ...body.data.listOnly.map((m: { member_id: string }) => m.member_id),
    ];

    expect(allIds).toContain(resolvedMemberId);
    expect(allIds).toContain(pendingMemberId);
    expect(allIds).not.toContain(archivedMemberId);
  });

  test("2. PENDING members appear in listOnly, not pins", async () => {
    const token = signAccessToken({
      memberId: resolvedMemberId,
      chapterId,
      role: "MEMBER",
    });
    const req = makeRequest(token);
    const res = await GET(req, { params: { chapterId } });
    const body = await res.json();

    const pinIds = body.data.pins.map((m: { member_id: string }) => m.member_id);
    const listIds = body.data.listOnly.map((m: { member_id: string }) => m.member_id);

    expect(pinIds).toContain(resolvedMemberId);
    expect(pinIds).not.toContain(pendingMemberId);
    expect(listIds).toContain(pendingMemberId);
    expect(listIds).not.toContain(resolvedMemberId);
  });
});

describe("GET /api/chapters/[chapterId]/map/member/[memberId]", () => {
  let GET: (req: Request, ctx: { params: Record<string, string> }) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import(
      "@/app/api/chapters/[chapterId]/map/member/[memberId]/route"
    );
    GET = mod.GET;
  });

  test("3. respects shareable_fields — whatsapp not returned if not shareable", async () => {
    // Request as a different member (not self)
    const token = signAccessToken({
      memberId: pendingMemberId,
      chapterId,
      role: "MEMBER",
    });
    const req = makeRequest(token);
    const res = await GET(req, {
      params: { chapterId, memberId: resolvedMemberId },
    });
    const body = await res.json();

    expect(body.data.full_name).toBe("Resolved Member");
    expect(body.data.biz_category).toBe("Testing");
    expect(body.data.whatsapp).toBeUndefined();
    expect(body.data.maps_link).toBeDefined();
  });

  test("4. location_display_mode=AREA_ONLY returns only area, not full address", async () => {
    // Request as regular MEMBER (not LT)
    const token = signAccessToken({
      memberId: pendingMemberId,
      chapterId,
      role: "MEMBER",
    });
    const req = makeRequest(token);
    const res = await GET(req, {
      params: { chapterId, memberId: resolvedMemberId },
    });
    const body = await res.json();

    // Full address: "123 Test Street, Satellite, Ahmedabad, Gujarat 380015"
    // AREA_ONLY should return last 2 parts: "Ahmedabad, Gujarat 380015"
    expect(body.data.office_address).toBe("Ahmedabad, Gujarat 380015");
    expect(body.data.office_address).not.toContain("123 Test Street");
  });
});
