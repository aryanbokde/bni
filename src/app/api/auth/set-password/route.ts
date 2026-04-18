import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { setPassword } from "@/services/AuthService";
import { AppError } from "@/lib/AppError";

const setPasswordSchema = z.object({
  memberId: z.string().min(1),
  newPassword: z.string().min(1, "Password is required"),
});

export async function POST(req: Request) {
  try {
    const actor = await requireAuth(req);

    const body = await req.json();
    const parsed = setPasswordSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        fieldErrors[issue.path.join(".")] = issue.message;
      }
      throw new AppError("VALIDATION_ERROR", 422, fieldErrors);
    }

    await setPassword(
      parsed.data.memberId,
      parsed.data.newPassword,
      actor.memberId,
      actor.role
    );

    return NextResponse.json({ data: { success: true } }, { status: 200 });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message, fields: err.fields } },
        { status: err.httpStatus }
      );
    }
    console.error("Set password error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
