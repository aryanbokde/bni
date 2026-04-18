import { z } from "zod";

export const CreateMemberSchema = z.object({
  full_name: z.string().min(2).max(150),
  mobile: z.string().min(10).max(20),
  whatsapp: z.string().min(10).max(20),
  email: z.string().email(),
  biz_category: z.string().min(2).max(100),
  one_line_summary: z.string().min(10).max(250),
  intro_text: z.string().max(400).optional(),
  office_address: z.string().min(10),
  chapter_role: z.enum([
    "MEMBER",
    "PRESIDENT",
    "VP",
    "SECRETARY",
    "TREASURER",
    "ADMIN",
  ]),
  joining_date: z.string().datetime(),
});

export const UpdateMemberSchema = CreateMemberSchema.extend({
  comm_eligible: z.boolean().optional(),
  rec_active: z.boolean().optional(),
}).partial();

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const SetPasswordSchema = z.object({
  memberId: z.string().uuid(),
  newPassword: z.string().min(8),
});

export function formatZodErrors(
  error: z.ZodError
): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    fields[issue.path.join(".")] = issue.message;
  }
  return fields;
}
