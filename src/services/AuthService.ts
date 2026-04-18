import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/AppError";
import { hashEmail } from "@/lib/crypto";
import {
  signAccessToken,
  signRefreshToken,
  hashRefreshToken,
} from "@/lib/auth";
import type { MemberDecrypted } from "@/types/member";
import { decryptMember } from "@/services/memberHelpers";

const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILED_ATTEMPTS = 5;
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

export async function login(
  email: string,
  password: string
): Promise<{ accessToken: string; refreshToken: string; member: MemberDecrypted }> {
  const emailHash = hashEmail(email);

  const member = await prisma.members.findFirst({
    where: { email_hash: emailHash, status: "ACTIVE" },
  });

  if (!member) {
    throw new AppError("INVALID_CREDENTIALS", 401);
  }

  // Check account lock
  if (
    member.failed_login_attempts >= MAX_FAILED_ATTEMPTS &&
    member.locked_until &&
    member.locked_until > new Date()
  ) {
    throw new AppError("ACCOUNT_LOCKED", 401, {
      message: "Too many failed attempts. Try again in 15 minutes.",
    });
  }

  // Check password is set
  if (!member.password_hash) {
    throw new AppError("PASSWORD_NOT_SET", 401, {
      message: "Contact your Chapter Admin to activate your account.",
    });
  }

  // Verify password
  const valid = await bcrypt.compare(password, member.password_hash);
  if (!valid) {
    const newAttempts = member.failed_login_attempts + 1;
    await prisma.members.update({
      where: { member_id: member.member_id },
      data: {
        failed_login_attempts: newAttempts,
        ...(newAttempts >= MAX_FAILED_ATTEMPTS && {
          locked_until: new Date(Date.now() + LOCK_DURATION_MS),
        }),
      },
    });
    throw new AppError("INVALID_CREDENTIALS", 401);
  }

  // Success — reset counters
  await prisma.members.update({
    where: { member_id: member.member_id },
    data: { failed_login_attempts: 0, locked_until: null },
  });

  // Generate tokens
  const accessToken = signAccessToken({
    memberId: member.member_id,
    chapterId: member.chapter_id,
    role: member.chapter_role,
  });

  const rawRefresh = signRefreshToken();
  const refreshHash = hashRefreshToken(rawRefresh);

  await prisma.refresh_tokens.create({
    data: {
      member_id: member.member_id,
      token_hash: refreshHash,
      expires_at: new Date(
        Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
      ),
    },
  });

  // Audit log
  await prisma.audit_logs.create({
    data: {
      entity_type: "members",
      entity_id: member.member_id,
      operation: "LOGIN",
      actor_id: member.member_id,
      actor_role: member.chapter_role,
      source: "API",
    },
  });

  return {
    accessToken,
    refreshToken: rawRefresh,
    member: decryptMember(member),
  };
}

export async function setPassword(
  memberId: string,
  newPassword: string,
  actorId: string,
  actorRole: string
): Promise<void> {
  if (actorRole !== "ADMIN" && actorId !== memberId) {
    throw new AppError("FORBIDDEN", 403);
  }

  // Validate password strength
  if (
    newPassword.length < 8 ||
    !/[a-zA-Z]/.test(newPassword) ||
    !/[0-9]/.test(newPassword)
  ) {
    throw new AppError("WEAK_PASSWORD", 422, {
      password:
        "Minimum 8 characters with at least one letter and one number",
    });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.members.update({
    where: { member_id: memberId },
    data: {
      password_hash: passwordHash,
      failed_login_attempts: 0,
      locked_until: null,
    },
  });

  // Audit — NEVER log actual password values
  await prisma.audit_logs.create({
    data: {
      entity_type: "members",
      entity_id: memberId,
      operation: "UPDATE",
      field_name: "password_hash",
      old_value: "[REDACTED]",
      new_value: "[REDACTED]",
      actor_id: actorId,
      actor_role: actorRole,
      source: "API",
    },
  });
}

export async function resetPassword(
  memberId: string,
  tempPassword: string,
  actorId: string
): Promise<void> {
  await setPassword(memberId, tempPassword, actorId, "ADMIN");
}

export async function refreshTokens(
  rawRefreshToken: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const tokenHash = hashRefreshToken(rawRefreshToken);

  const existing = await prisma.refresh_tokens.findFirst({
    where: {
      token_hash: tokenHash,
      is_revoked: false,
      expires_at: { gt: new Date() },
    },
  });

  if (!existing) {
    throw new AppError("INVALID_REFRESH_TOKEN", 401);
  }

  // Revoke old token
  await prisma.refresh_tokens.update({
    where: { id: existing.id },
    data: { is_revoked: true },
  });

  // Load member for current role
  const member = await prisma.members.findUnique({
    where: { member_id: existing.member_id },
  });

  if (!member || member.status !== "ACTIVE") {
    throw new AppError("UNAUTHENTICATED", 401);
  }

  // Generate new pair
  const accessToken = signAccessToken({
    memberId: member.member_id,
    chapterId: member.chapter_id,
    role: member.chapter_role,
  });

  const newRawRefresh = signRefreshToken();
  const newRefreshHash = hashRefreshToken(newRawRefresh);

  await prisma.refresh_tokens.create({
    data: {
      member_id: member.member_id,
      token_hash: newRefreshHash,
      expires_at: new Date(
        Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
      ),
    },
  });

  return { accessToken, refreshToken: newRawRefresh };
}

export async function logout(rawRefreshToken: string): Promise<void> {
  try {
    const tokenHash = hashRefreshToken(rawRefreshToken);
    await prisma.refresh_tokens.updateMany({
      where: { token_hash: tokenHash },
      data: { is_revoked: true },
    });
  } catch {
    // Fail silently — logout should always succeed from user's perspective
  }
}
