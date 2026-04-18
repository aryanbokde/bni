import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import {
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  hashRefreshToken,
  requireRole,
  AuthContext,
} from "@/lib/auth";
import { AppError } from "@/lib/AppError";
import { encrypt, hashEmail, hashPhone } from "@/lib/crypto";
import * as AuthService from "@/services/AuthService";

const prisma = new PrismaClient();

let chapterId: string;
let memberAId: string;
let memberBId: string;
let memberCId: string;

beforeAll(async () => {
  // Clean up prior auth test data only (scoped by chapter name)
  const oldChapter = await prisma.chapters.findFirst({
    where: { chapter_name: "Auth Test Chapter" },
  });
  if (oldChapter) {
    await prisma.refresh_tokens.deleteMany({});
    await prisma.audit_logs.deleteMany({});
    await prisma.member_interactions.deleteMany({ where: { chapter_id: oldChapter.chapter_id } });
    await prisma.recommendations.deleteMany({ where: { chapter_id: oldChapter.chapter_id } });
    await prisma.recommendation_runs.deleteMany({ where: { chapter_id: oldChapter.chapter_id } });
    await prisma.members.deleteMany({ where: { chapter_id: oldChapter.chapter_id } });
    await prisma.shareable_fields.deleteMany({ where: { chapter_id: oldChapter.chapter_id } });
    await prisma.chapters.deleteMany({ where: { chapter_id: oldChapter.chapter_id } });
  } else {
    // First run — clean refresh tokens and audit logs globally (they have no chapter FK)
    await prisma.refresh_tokens.deleteMany({});
    await prisma.audit_logs.deleteMany({});
  }

  // Create test chapter
  const chapter = await prisma.chapters.create({
    data: {
      chapter_name: "Auth Test Chapter",
      meeting_day: 4,
      meeting_start_time: "07:00:00",
      rsvp_reminder_schedule: [],
    },
  });
  chapterId = chapter.chapter_id;

  // Member A: ACTIVE MEMBER with password
  const mA = await prisma.members.create({
    data: {
      chapter_id: chapterId,
      full_name: "Member A",
      mobile_enc: encrypt("+910000000001"),
      mobile_hash: hashPhone("+910000000001"),
      whatsapp_enc: encrypt("+910000000001"),
      whatsapp_hash: hashPhone("+910000000001"),
      email_enc: encrypt("test@bni.com"),
      email_hash: hashEmail("test@bni.com"),
      password_hash: bcrypt.hashSync("TestPass1", 10),
      biz_category: "Test",
      one_line_summary: "Test member A",
      office_address: "Test",
      chapter_role: "MEMBER",
      status: "ACTIVE",
      joining_date: new Date(),
    },
  });
  memberAId = mA.member_id;

  // Member B: ACTIVE ADMIN with password
  const mB = await prisma.members.create({
    data: {
      chapter_id: chapterId,
      full_name: "Member B",
      mobile_enc: encrypt("+910000000002"),
      mobile_hash: hashPhone("+910000000002"),
      whatsapp_enc: encrypt("+910000000002"),
      whatsapp_hash: hashPhone("+910000000002"),
      email_enc: encrypt("admin@bni.com"),
      email_hash: hashEmail("admin@bni.com"),
      password_hash: bcrypt.hashSync("AdminPass1", 10),
      biz_category: "Admin",
      one_line_summary: "Test admin B",
      office_address: "Test",
      chapter_role: "ADMIN",
      status: "ACTIVE",
      joining_date: new Date(),
    },
  });
  memberBId = mB.member_id;

  // Member C: INACTIVE
  const mC = await prisma.members.create({
    data: {
      chapter_id: chapterId,
      full_name: "Member C",
      mobile_enc: encrypt("+910000000003"),
      mobile_hash: hashPhone("+910000000003"),
      whatsapp_enc: encrypt("+910000000003"),
      whatsapp_hash: hashPhone("+910000000003"),
      email_enc: encrypt("inactive@bni.com"),
      email_hash: hashEmail("inactive@bni.com"),
      password_hash: bcrypt.hashSync("Pass1234", 10),
      biz_category: "Inactive",
      one_line_summary: "Test inactive C",
      office_address: "Test",
      chapter_role: "MEMBER",
      status: "INACTIVE",
      joining_date: new Date(),
    },
  });
  memberCId = mC.member_id;
});

afterAll(async () => {
  // Clean up scoped to auth test chapter
  await prisma.refresh_tokens.deleteMany({});
  await prisma.audit_logs.deleteMany({});
  await prisma.members.deleteMany({ where: { chapter_id: chapterId } });
  await prisma.shareable_fields.deleteMany({ where: { chapter_id: chapterId } });
  await prisma.chapters.deleteMany({ where: { chapter_id: chapterId } });
  await prisma.$disconnect();
});

// ──────────────────────────────────────────────
// AuthService.login tests (1-8)
// ──────────────────────────────────────────────
describe("AuthService.login", () => {
  // Reset failed attempts before each login test
  beforeEach(async () => {
    await prisma.members.updateMany({
      where: { member_id: memberAId },
      data: { failed_login_attempts: 0, locked_until: null },
    });
  });

  test("1. valid credentials → returns accessToken, refreshToken, decrypted member", async () => {
    const result = await AuthService.login("test@bni.com", "TestPass1");
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.member.email).toBe("test@bni.com");
    expect(result.member.full_name).toBe("Member A");
    expect(result.member.chapter_role).toBe("MEMBER");
  });

  test("2. wrong password → throws INVALID_CREDENTIALS", async () => {
    await expect(
      AuthService.login("test@bni.com", "WrongPassword1")
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS", httpStatus: 401 });
  });

  test("3. non-existent email → throws INVALID_CREDENTIALS", async () => {
    await expect(
      AuthService.login("nobody@bni.com", "SomePass1")
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS", httpStatus: 401 });
  });

  test("4. inactive member → throws INVALID_CREDENTIALS", async () => {
    await expect(
      AuthService.login("inactive@bni.com", "Pass1234")
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS", httpStatus: 401 });
  });

  test("5. null password_hash → throws PASSWORD_NOT_SET", async () => {
    // Temporarily clear password
    await prisma.members.update({
      where: { member_id: memberAId },
      data: { password_hash: null },
    });

    await expect(
      AuthService.login("test@bni.com", "TestPass1")
    ).rejects.toMatchObject({ code: "PASSWORD_NOT_SET", httpStatus: 401 });

    // Restore
    await prisma.members.update({
      where: { member_id: memberAId },
      data: { password_hash: bcrypt.hashSync("TestPass1", 10) },
    });
  });

  test("6. 5 failed attempts → 6th attempt throws ACCOUNT_LOCKED", async () => {
    // Fail 5 times
    for (let i = 0; i < 5; i++) {
      await expect(
        AuthService.login("test@bni.com", "wrong")
      ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    }

    // 6th attempt should be locked
    await expect(
      AuthService.login("test@bni.com", "TestPass1")
    ).rejects.toMatchObject({ code: "ACCOUNT_LOCKED", httpStatus: 401 });
  });

  test("7. after lockout expires → login succeeds again", async () => {
    // Set lock in the past
    await prisma.members.update({
      where: { member_id: memberAId },
      data: {
        failed_login_attempts: 5,
        locked_until: new Date(Date.now() - 1000), // expired
      },
    });

    const result = await AuthService.login("test@bni.com", "TestPass1");
    expect(result.accessToken).toBeDefined();
  });

  test("8. successful login resets failed_login_attempts to 0", async () => {
    // Set some failed attempts
    await prisma.members.update({
      where: { member_id: memberAId },
      data: { failed_login_attempts: 3, locked_until: null },
    });

    await AuthService.login("test@bni.com", "TestPass1");

    const member = await prisma.members.findUnique({
      where: { member_id: memberAId },
    });
    expect(member!.failed_login_attempts).toBe(0);
  });
});

// ──────────────────────────────────────────────
// AuthService.setPassword tests (9-14)
// ──────────────────────────────────────────────
describe("AuthService.setPassword", () => {
  test("9. ADMIN sets password for any member → succeeds", async () => {
    await AuthService.setPassword(memberAId, "NewAdmin1", memberBId, "ADMIN");
    const member = await prisma.members.findUnique({
      where: { member_id: memberAId },
    });
    expect(await bcrypt.compare("NewAdmin1", member!.password_hash!)).toBe(true);

    // Restore original password
    await AuthService.setPassword(memberAId, "TestPass1", memberBId, "ADMIN");
  });

  test("10. MEMBER sets own password → succeeds", async () => {
    await AuthService.setPassword(memberAId, "SelfSet1", memberAId, "MEMBER");
    const member = await prisma.members.findUnique({
      where: { member_id: memberAId },
    });
    expect(await bcrypt.compare("SelfSet1", member!.password_hash!)).toBe(true);

    // Restore
    await AuthService.setPassword(memberAId, "TestPass1", memberBId, "ADMIN");
  });

  test("11. MEMBER tries to set another member's password → throws FORBIDDEN", async () => {
    await expect(
      AuthService.setPassword(memberBId, "Hacked123", memberAId, "MEMBER")
    ).rejects.toMatchObject({ code: "FORBIDDEN", httpStatus: 403 });
  });

  test("12. password under 8 chars → throws WEAK_PASSWORD", async () => {
    await expect(
      AuthService.setPassword(memberAId, "Short1", memberAId, "MEMBER")
    ).rejects.toMatchObject({ code: "WEAK_PASSWORD", httpStatus: 422 });
  });

  test("13. password with no number → throws WEAK_PASSWORD", async () => {
    await expect(
      AuthService.setPassword(memberAId, "NoNumberHere", memberAId, "MEMBER")
    ).rejects.toMatchObject({ code: "WEAK_PASSWORD", httpStatus: 422 });
  });

  test("14. after setPassword → login with new password succeeds", async () => {
    await AuthService.setPassword(memberAId, "Changed1", memberBId, "ADMIN");
    const result = await AuthService.login("test@bni.com", "Changed1");
    expect(result.accessToken).toBeDefined();

    // Restore
    await AuthService.setPassword(memberAId, "TestPass1", memberBId, "ADMIN");
  });
});

// ──────────────────────────────────────────────
// AuthService.refreshTokens tests (15-18)
// ──────────────────────────────────────────────
describe("AuthService.refreshTokens", () => {
  test("15. valid refresh token → returns new access + refresh tokens", async () => {
    const loginResult = await AuthService.login("test@bni.com", "TestPass1");
    const result = await AuthService.refreshTokens(loginResult.refreshToken);
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.refreshToken).not.toBe(loginResult.refreshToken);
  });

  test("16. old refresh token invalidated after rotation", async () => {
    const loginResult = await AuthService.login("test@bni.com", "TestPass1");
    const oldToken = loginResult.refreshToken;

    // Use it once (rotate)
    await AuthService.refreshTokens(oldToken);

    // Second use should fail
    await expect(
      AuthService.refreshTokens(oldToken)
    ).rejects.toMatchObject({ code: "INVALID_REFRESH_TOKEN" });
  });

  test("17. expired refresh token → throws INVALID_REFRESH_TOKEN", async () => {
    const loginResult = await AuthService.login("test@bni.com", "TestPass1");
    const tokenHash = hashRefreshToken(loginResult.refreshToken);

    // Set expiry in the past
    await prisma.refresh_tokens.updateMany({
      where: { token_hash: tokenHash },
      data: { expires_at: new Date(Date.now() - 1000) },
    });

    await expect(
      AuthService.refreshTokens(loginResult.refreshToken)
    ).rejects.toMatchObject({ code: "INVALID_REFRESH_TOKEN" });
  });

  test("18. revoked refresh token → throws INVALID_REFRESH_TOKEN", async () => {
    const loginResult = await AuthService.login("test@bni.com", "TestPass1");
    const tokenHash = hashRefreshToken(loginResult.refreshToken);

    // Revoke it
    await prisma.refresh_tokens.updateMany({
      where: { token_hash: tokenHash },
      data: { is_revoked: true },
    });

    await expect(
      AuthService.refreshTokens(loginResult.refreshToken)
    ).rejects.toMatchObject({ code: "INVALID_REFRESH_TOKEN" });
  });
});

// ──────────────────────────────────────────────
// JWT utility tests (19-22)
// ──────────────────────────────────────────────
describe("JWT utilities", () => {
  const testPayload: AuthContext = {
    memberId: "member-123",
    chapterId: "chapter-456",
    role: "ADMIN",
  };

  test("19. access token expires after 15 minutes", () => {
    const token = signAccessToken(testPayload);
    const decoded = jwt.decode(token) as { iat: number; exp: number };
    expect(decoded.exp - decoded.iat).toBe(15 * 60);
  });

  test("20. verifyAccessToken rejects tampered token", () => {
    const token = signAccessToken(testPayload);
    const tampered = token.slice(0, -5) + "XXXXX";

    expect(() => verifyAccessToken(tampered)).toThrow(AppError);
    try {
      verifyAccessToken(tampered);
    } catch (err) {
      expect((err as AppError).code).toBe("UNAUTHENTICATED");
    }
  });

  test("21. JWT payload contains memberId, chapterId, and role", () => {
    const token = signAccessToken(testPayload);
    const result = verifyAccessToken(token);
    expect(result.memberId).toBe("member-123");
    expect(result.chapterId).toBe("chapter-456");
    expect(result.role).toBe("ADMIN");
  });

  test("22. requireRole allows correct role, throws FORBIDDEN for wrong role", () => {
    expect(() => requireRole(testPayload, ["ADMIN"])).not.toThrow();

    expect(() =>
      requireRole({ ...testPayload, role: "MEMBER" }, ["ADMIN"])
    ).toThrow(AppError);

    try {
      requireRole({ ...testPayload, role: "MEMBER" }, ["ADMIN"]);
    } catch (err) {
      expect((err as AppError).code).toBe("FORBIDDEN");
      expect((err as AppError).httpStatus).toBe(403);
    }
  });
});
