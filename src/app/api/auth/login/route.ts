import { NextResponse } from "next/server";
import { z } from "zod";
import { login } from "@/services/AuthService";
import { AppError } from "@/lib/AppError";
import { checkRateLimit } from "@/lib/rateLimit";

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(req: Request) {
  try {
    // Rate limit by IP (relaxed in development for testing)
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const rateLimit = process.env.NODE_ENV === "production" ? 5 : 50;
    if (!checkRateLimit(ip, rateLimit, 15 * 60 * 1000)) {
      throw new AppError("RATE_LIMIT_EXCEEDED", 429, {
        message: "Too many login attempts. Try again in 15 minutes.",
      });
    }

    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        fieldErrors[issue.path.join(".")] = issue.message;
      }
      throw new AppError("VALIDATION_ERROR", 422, fieldErrors);
    }

    const { accessToken, refreshToken, member } = await login(
      parsed.data.email,
      parsed.data.password
    );

    const response = NextResponse.json(
      { data: { accessToken, member } },
      { status: 200 }
    );

    // Set refresh token as HttpOnly cookie — NEVER in response body
    response.cookies.set("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/api/auth",
    });

    // Set non-sensitive session cookie for Server Components
    response.cookies.set("bni_session", JSON.stringify({
      memberId: member.member_id,
      chapterId: member.chapter_id,
      role: member.chapter_role,
    }), {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message, fields: err.fields } },
        { status: err.httpStatus }
      );
    }
    console.error("Login error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
