export type MemberStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

export type ChapterRole =
  | "MEMBER"
  | "PRESIDENT"
  | "VP"
  | "SECRETARY"
  | "TREASURER"
  | "ADMIN";

export type GeocodeStatus = "PENDING" | "RESOLVED" | "FAILED";

export interface MemberDecrypted {
  member_id: string;
  chapter_id: string;
  full_name: string;
  mobile: string;
  whatsapp: string;
  email: string;
  password_hash: string | null;
  biz_category: string;
  one_line_summary: string;
  intro_text: string | null;
  office_address: string;
  latitude: number | null;
  longitude: number | null;
  geocode_status: string;
  status: string;
  comm_eligible: boolean;
  rec_active: boolean;
  chapter_role: string;
  joining_date: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreateMemberDto {
  full_name: string;
  mobile: string;
  whatsapp: string;
  email: string;
  biz_category: string;
  one_line_summary: string;
  intro_text?: string;
  office_address: string;
  chapter_role: string;
  joining_date: string;
}

export type UpdateMemberDto = Partial<CreateMemberDto & {
  comm_eligible: boolean;
  rec_active: boolean;
}>;
