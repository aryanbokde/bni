import { prisma } from "@/lib/db";
import { AppError } from "@/lib/AppError";
import {
  encrypt,
  hashPhone,
  hashEmail,
  normalisePhone,
  normaliseEmail,
} from "@/lib/crypto";
import { decryptMember } from "@/services/memberHelpers";
import type {
  MemberDecrypted,
  CreateMemberDto,
  UpdateMemberDto,
} from "@/types/member";

// ──────────────────────────────────────────────
// checkDuplicates
// ──────────────────────────────────────────────
export async function checkDuplicates(
  chapterId: string,
  hashes: {
    mobileHash?: string;
    whatsappHash?: string;
    emailHash?: string;
  },
  excludeMemberId?: string
): Promise<void> {
  const notSelf = excludeMemberId
    ? { member_id: { not: excludeMemberId } }
    : {};

  if (hashes.mobileHash) {
    const existing = await prisma.members.findFirst({
      where: {
        chapter_id: chapterId,
        mobile_hash: hashes.mobileHash,
        ...notSelf,
      },
    });
    if (existing) {
      throw new AppError("MEMBER_DUPLICATE_MOBILE", 409, {
        mobile: "A member with this mobile number already exists",
      });
    }
  }

  if (hashes.whatsappHash) {
    const existing = await prisma.members.findFirst({
      where: {
        chapter_id: chapterId,
        whatsapp_hash: hashes.whatsappHash,
        ...notSelf,
      },
    });
    if (existing) {
      throw new AppError("MEMBER_DUPLICATE_WHATSAPP", 409, {
        whatsapp: "A member with this WhatsApp number already exists",
      });
    }
  }

  if (hashes.emailHash) {
    const existing = await prisma.members.findFirst({
      where: {
        chapter_id: chapterId,
        email_hash: hashes.emailHash,
        ...notSelf,
      },
    });
    if (existing) {
      throw new AppError("MEMBER_DUPLICATE_EMAIL", 409, {
        email: "A member with this email already exists",
      });
    }
  }
}

// ──────────────────────────────────────────────
// createMember
// ──────────────────────────────────────────────
export async function createMember(
  chapterId: string,
  dto: CreateMemberDto,
  actorId: string
): Promise<MemberDecrypted> {
  // 1. Validate required fields
  if (!dto.full_name || !dto.mobile || !dto.whatsapp || !dto.email) {
    throw new AppError("VALIDATION_ERROR", 422, {
      message: "full_name, mobile, whatsapp, and email are required",
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(dto.email)) {
    throw new AppError("VALIDATION_ERROR", 422, {
      email: "Invalid email format",
    });
  }

  // 2-3. Normalise
  const mobile = normalisePhone(dto.mobile);
  const whatsapp = normalisePhone(dto.whatsapp);
  const email = normaliseEmail(dto.email);

  // 4. Hash for duplicate checks
  const mobileHash = hashPhone(mobile);
  const whatsappHash = hashPhone(whatsapp);
  const emailHash = hashEmail(email);

  // 5. Check duplicates
  await checkDuplicates(chapterId, { mobileHash, whatsappHash, emailHash });

  // 6. Encrypt PII
  const mobileEnc = encrypt(mobile);
  const whatsappEnc = encrypt(whatsapp);
  const emailEnc = encrypt(email);

  // 7. Insert
  const member = await prisma.members.create({
    data: {
      chapter_id: chapterId,
      full_name: dto.full_name,
      mobile_enc: mobileEnc,
      mobile_hash: mobileHash,
      whatsapp_enc: whatsappEnc,
      whatsapp_hash: whatsappHash,
      email_enc: emailEnc,
      email_hash: emailHash,
      password_hash: null,
      failed_login_attempts: 0,
      locked_until: null,
      biz_category: dto.biz_category,
      one_line_summary: dto.one_line_summary,
      intro_text: dto.intro_text ?? null,
      office_address: dto.office_address,
      chapter_role: dto.chapter_role,
      joining_date: new Date(dto.joining_date),
    },
  });

  // 8. Audit log
  await prisma.audit_logs.create({
    data: {
      entity_type: "members",
      entity_id: member.member_id,
      operation: "CREATE",
      actor_id: actorId,
      actor_role: "ADMIN",
      source: "API",
    },
  });

  // 9. Trigger geocoding async (fire-and-forget)
  import("@/services/GeocodingService").then((geo) => {
    geo.geocodeMember(member.member_id);
  });

  // 10. Return decrypted
  return decryptMember(member);
}

// ──────────────────────────────────────────────
// updateMember
// ──────────────────────────────────────────────
export async function updateMember(
  memberId: string,
  chapterId: string,
  dto: UpdateMemberDto,
  actorId: string
): Promise<MemberDecrypted> {
  // 1. Load existing
  const existing = await prisma.members.findFirst({
    where: { member_id: memberId, chapter_id: chapterId },
  });
  if (!existing) {
    throw new AppError("MEMBER_NOT_FOUND", 404);
  }

  const updateData: Record<string, unknown> = {};
  const auditChanges: { field: string; oldVal: string; newVal: string }[] = [];

  // 2-3. Handle PII field changes
  if (dto.mobile !== undefined) {
    const mobile = normalisePhone(dto.mobile);
    const mobileHash = hashPhone(mobile);
    await checkDuplicates(chapterId, { mobileHash }, memberId);
    updateData.mobile_enc = encrypt(mobile);
    updateData.mobile_hash = mobileHash;
    auditChanges.push({ field: "mobile", oldVal: "[ENCRYPTED]", newVal: "[ENCRYPTED]" });
  }

  if (dto.whatsapp !== undefined) {
    const whatsapp = normalisePhone(dto.whatsapp);
    const whatsappHash = hashPhone(whatsapp);
    await checkDuplicates(chapterId, { whatsappHash }, memberId);
    updateData.whatsapp_enc = encrypt(whatsapp);
    updateData.whatsapp_hash = whatsappHash;
    auditChanges.push({ field: "whatsapp", oldVal: "[ENCRYPTED]", newVal: "[ENCRYPTED]" });
  }

  if (dto.email !== undefined) {
    const email = normaliseEmail(dto.email);
    const emailHash = hashEmail(email);
    await checkDuplicates(chapterId, { emailHash }, memberId);
    updateData.email_enc = encrypt(email);
    updateData.email_hash = emailHash;
    auditChanges.push({ field: "email", oldVal: "[ENCRYPTED]", newVal: "[ENCRYPTED]" });
  }

  // Non-PII fields
  const plainFields: (keyof UpdateMemberDto)[] = [
    "full_name",
    "biz_category",
    "one_line_summary",
    "intro_text",
    "chapter_role",
    "comm_eligible",
    "rec_active",
  ];

  for (const field of plainFields) {
    if (dto[field] !== undefined) {
      updateData[field] = dto[field];
      auditChanges.push({
        field,
        oldVal: String(existing[field as keyof typeof existing] ?? ""),
        newVal: String(dto[field]),
      });
    }
  }

  // 4. Address change → reset geocode
  if (dto.office_address !== undefined) {
    updateData.office_address = dto.office_address;
    updateData.geocode_status = "PENDING";
    auditChanges.push({
      field: "office_address",
      oldVal: existing.office_address,
      newVal: dto.office_address,
    });

    // Trigger geocoding async (fire-and-forget)
    import("@/services/GeocodingService").then((geo) => {
      geo.geocodeMember(memberId);
    });
  }

  if (dto.joining_date !== undefined) {
    updateData.joining_date = new Date(dto.joining_date);
    auditChanges.push({
      field: "joining_date",
      oldVal: existing.joining_date.toISOString(),
      newVal: dto.joining_date,
    });
  }

  // 5. Update
  const updated = await prisma.members.update({
    where: { member_id: memberId },
    data: updateData,
  });

  // 6. Audit logs per field
  for (const change of auditChanges) {
    await prisma.audit_logs.create({
      data: {
        entity_type: "members",
        entity_id: memberId,
        operation: "UPDATE",
        field_name: change.field,
        old_value: change.oldVal,
        new_value: change.newVal,
        actor_id: actorId,
        actor_role: "ADMIN",
        source: "API",
      },
    });
  }

  // 7. Return decrypted
  return decryptMember(updated);
}

// ──────────────────────────────────────────────
// archiveMember
// ──────────────────────────────────────────────
export async function archiveMember(
  memberId: string,
  reason: string,
  actorId: string,
  actorRole: string
): Promise<void> {
  const member = await prisma.members.findUnique({
    where: { member_id: memberId },
  });
  if (!member) throw new AppError("MEMBER_NOT_FOUND", 404);
  if (member.status === "ARCHIVED") {
    throw new AppError("MEMBER_ALREADY_ARCHIVED", 409);
  }

  await prisma.members.update({
    where: { member_id: memberId },
    data: {
      status: "ARCHIVED",
      comm_eligible: false,
      rec_active: false,
    },
  });

  await prisma.audit_logs.create({
    data: {
      entity_type: "members",
      entity_id: memberId,
      operation: "ARCHIVE",
      field_name: "status",
      old_value: member.status,
      new_value: reason,
      actor_id: actorId,
      actor_role: actorRole,
      source: "API",
    },
  });
}

// ──────────────────────────────────────────────
// restoreMember
// ──────────────────────────────────────────────
export async function restoreMember(
  memberId: string,
  actorId: string,
  actorRole: string
): Promise<void> {
  const member = await prisma.members.findUnique({
    where: { member_id: memberId },
  });
  if (!member) throw new AppError("MEMBER_NOT_FOUND", 404);

  await prisma.members.update({
    where: { member_id: memberId },
    data: { status: "ACTIVE" },
  });

  await prisma.audit_logs.create({
    data: {
      entity_type: "members",
      entity_id: memberId,
      operation: "RESTORE",
      field_name: "status",
      old_value: member.status,
      new_value: "ACTIVE",
      actor_id: actorId,
      actor_role: actorRole,
      source: "API",
    },
  });
}

// ──────────────────────────────────────────────
// getMembersByChapter
// ──────────────────────────────────────────────
export async function getMembersByChapter(
  chapterId: string,
  filters: { status?: string; role?: string; search?: string } = {}
): Promise<MemberDecrypted[]> {
  const where: Record<string, unknown> = { chapter_id: chapterId };

  if (filters.status) where.status = filters.status;
  if (filters.role) where.chapter_role = filters.role;
  if (filters.search) {
    where.OR = [
      { full_name: { contains: filters.search } },
      { biz_category: { contains: filters.search } },
    ];
  }

  const members = await prisma.members.findMany({
    where,
    orderBy: { full_name: "asc" },
  });

  return members.map(decryptMember);
}

// ──────────────────────────────────────────────
// getMemberById
// ──────────────────────────────────────────────
export async function getMemberById(
  memberId: string,
  chapterId: string
): Promise<MemberDecrypted> {
  const member = await prisma.members.findFirst({
    where: { member_id: memberId, chapter_id: chapterId },
  });
  if (!member) throw new AppError("MEMBER_NOT_FOUND", 404);
  return decryptMember(member);
}

// ──────────────────────────────────────────────
// getEligibleForRecommendation
// ──────────────────────────────────────────────
export async function getEligibleForRecommendation(
  chapterId: string
): Promise<MemberDecrypted[]> {
  const members = await prisma.members.findMany({
    where: {
      chapter_id: chapterId,
      status: "ACTIVE",
      comm_eligible: true,
      rec_active: true,
      geocode_status: "RESOLVED",
      biz_category: { not: "" },
      one_line_summary: { not: "" },
      office_address: { not: "" },
    },
    orderBy: { full_name: "asc" },
  });

  return members.map(decryptMember);
}
