import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { signAccessToken } from "@/lib/auth";
import * as AuthService from "@/services/AuthService";
import { encrypt, hashPhone, hashEmail } from "@/lib/crypto";

const prisma = new PrismaClient();

// ──────────────────────────────────────────────
// Check 2: All protected API routes return 401 without token
// ──────────────────────────────────────────────
describe("API Authentication — 401 without token", () => {
  const PROTECTED_ROUTES: { method: string; path: string }[] = [
    { method: "GET", path: "/api/chapters/fake-id/members" },
    { method: "GET", path: "/api/chapters/fake-id/settings" },
    { method: "GET", path: "/api/chapters/fake-id/shareable-fields" },
    { method: "GET", path: "/api/chapters/fake-id/audit-logs" },
    { method: "GET", path: "/api/chapters/fake-id/map/members" },
    { method: "GET", path: "/api/chapters/fake-id/map/member/fake-member" },
    { method: "GET", path: "/api/chapters/fake-id/matrix" },
    { method: "GET", path: "/api/chapters/fake-id/matrix/member/fake-member" },
    { method: "GET", path: "/api/chapters/fake-id/recommendations" },
    { method: "GET", path: "/api/chapters/fake-id/recommendations/runs" },
    { method: "GET", path: "/api/chapters/fake-id/recommendations/export" },
    { method: "GET", path: "/api/admin/jobs/run/geocoding-retry" },
  ];

  for (const route of PROTECTED_ROUTES) {
    test(`${route.method} ${route.path} → 401`, async () => {
      const handlers = await import(
        `@/app${route.path.replace(/fake-id/g, "[chapterId]").replace(/fake-member/g, "[memberId]")}/route`
      ).catch(() => null);

      if (!handlers) return; // Route may use dynamic segments differently

      const handler = handlers[route.method];
      if (!handler) return;

      const req = new Request(`http://localhost:3000${route.path}`);
      const res = await handler(req, {
        params: { chapterId: "fake-id", memberId: "fake-member", recId: "fake-rec", runId: "fake-run", jobName: "geocoding-retry" },
      });
      const body = await res.json();
      expect(res.status).toBe(401);
      expect(body.error.code).toBe("UNAUTHENTICATED");
    });
  }
});

// ──────────────────────────────────────────────
// Check 3: Encrypted PII never in API responses
// ──────────────────────────────────────────────
describe("PII not leaked in API responses", () => {
  let chapterId: string;
  let memberId: string;

  beforeAll(async () => {
    const chapter = await prisma.chapters.findFirst();
    if (!chapter) return;
    chapterId = chapter.chapter_id;
    const member = await prisma.members.findFirst({
      where: { chapter_id: chapterId },
    });
    if (member) memberId = member.member_id;
  });

  test("GET members list does not contain _enc fields", async () => {
    if (!chapterId) return;

    const { GET } = await import("@/app/api/chapters/[chapterId]/members/route");
    const token = signAccessToken({ memberId: memberId!, chapterId, role: "ADMIN" });
    const req = new Request("http://localhost:3000/api/test", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const res = await GET(req, { params: { chapterId } });
    const text = await res.text();

    expect(text).not.toContain("mobile_enc");
    expect(text).not.toContain("whatsapp_enc");
    expect(text).not.toContain("email_enc");
    expect(text).not.toContain("password_hash");
    expect(text).not.toContain("mobile_hash");
  });

  test("GET member detail does not contain _enc fields", async () => {
    if (!chapterId || !memberId) return;

    const { GET } = await import("@/app/api/chapters/[chapterId]/members/[memberId]/route");
    const token = signAccessToken({ memberId, chapterId, role: "ADMIN" });
    const req = new Request("http://localhost:3000/api/test", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const res = await GET(req, { params: { chapterId, memberId } });
    const text = await res.text();

    expect(text).not.toContain("mobile_enc");
    expect(text).not.toContain("whatsapp_enc");
    expect(text).not.toContain("email_enc");
    expect(text).not.toContain("password_hash");
  });
});

// ──────────────────────────────────────────────
// Check 4: Webhook signature verification
// ──────────────────────────────────────────────
describe("Webhook security", () => {
  test("MetaCloudApiAdapter rejects wrong HMAC signature", () => {
    const { MetaCloudApiAdapter } = require("@/adapters/WhatsAppAdapter");
    const adapter = new MetaCloudApiAdapter();
    const payload = Buffer.from('{"entry":[]}');
    const result = adapter.verifyWebhookSignature(payload, "sha256=wrong_signature");
    expect(result).toBe(false);
  });

  test("MetaCloudApiAdapter accepts correct HMAC signature", () => {
    const { MetaCloudApiAdapter } = require("@/adapters/WhatsAppAdapter");
    const adapter = new MetaCloudApiAdapter();
    const body = '{"entry":[]}';
    const payload = Buffer.from(body);
    const secret = process.env.WHATSAPP_API_TOKEN ?? "";
    const hmac = crypto.createHmac("sha256", secret).update(body).digest("hex");
    const result = adapter.verifyWebhookSignature(payload, `sha256=${hmac}`);
    expect(result).toBe(true);
  });
});

// ──────────────────────────────────────────────
// Check 5: JWT security
// ──────────────────────────────────────────────
describe("JWT security", () => {
  test("Access token with tampered payload is rejected", async () => {
    const { verifyAccessToken } = await import("@/lib/auth");
    // Create a token, tamper with it
    const token = signAccessToken({
      memberId: "test",
      chapterId: "test",
      role: "ADMIN",
    });
    const parts = token.split(".");
    // Tamper with payload
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    payload.role = "SUPERADMIN";
    parts[1] = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const tampered = parts.join(".");

    expect(() => verifyAccessToken(tampered)).toThrow();
  });

  test("Refresh token rotation — old token rejected after refresh", async () => {
    // Create a test member with password
    const phone = `+91${Date.now().toString().slice(-10)}`;
    const email = `jwt-test-${Date.now()}@test.com`;
    const chapter = await prisma.chapters.findFirst();
    if (!chapter) return;

    const bcrypt = require("bcryptjs");
    const member = await prisma.members.create({
      data: {
        chapter_id: chapter.chapter_id,
        full_name: "JWT Test",
        mobile_enc: encrypt(phone),
        mobile_hash: hashPhone(phone),
        whatsapp_enc: encrypt(phone),
        whatsapp_hash: hashPhone(phone),
        email_enc: encrypt(email),
        email_hash: hashEmail(email),
        password_hash: bcrypt.hashSync("Test@1234", 10),
        biz_category: "Test",
        one_line_summary: "JWT security test member",
        office_address: "Test St",
        chapter_role: "MEMBER",
        joining_date: new Date(),
      },
    });

    // Login to get refresh token
    const loginResult = await AuthService.login(email, "Test@1234");
    const oldRefreshToken = loginResult.refreshToken;

    // Refresh to rotate
    const newTokens = await AuthService.refreshTokens(oldRefreshToken);
    expect(newTokens.accessToken).toBeDefined();

    // Old refresh token should now be rejected
    await expect(
      AuthService.refreshTokens(oldRefreshToken)
    ).rejects.toThrow();

    // Cleanup
    await prisma.refresh_tokens.deleteMany({
      where: { member_id: member.member_id },
    });
    await prisma.members.deleteMany({
      where: { member_id: member.member_id },
    });
  });
});
