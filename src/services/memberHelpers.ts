import type { members } from "@prisma/client";
import { decrypt } from "@/lib/crypto";
import type { MemberDecrypted } from "@/types/member";

export function decryptMember(member: members): MemberDecrypted {
  return {
    member_id: member.member_id,
    chapter_id: member.chapter_id,
    full_name: member.full_name,
    mobile: decrypt(Buffer.from(member.mobile_enc)),
    whatsapp: decrypt(Buffer.from(member.whatsapp_enc)),
    email: decrypt(Buffer.from(member.email_enc)),
    password_hash: member.password_hash,
    biz_category: member.biz_category,
    one_line_summary: member.one_line_summary,
    intro_text: member.intro_text,
    office_address: member.office_address,
    latitude: member.latitude,
    longitude: member.longitude,
    geocode_status: member.geocode_status,
    status: member.status,
    comm_eligible: member.comm_eligible,
    rec_active: member.rec_active,
    chapter_role: member.chapter_role,
    joining_date: member.joining_date,
    created_at: member.created_at,
    updated_at: member.updated_at,
  };
}
