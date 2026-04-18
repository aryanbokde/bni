import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { refreshTokens } from "@/services/AuthService";
import { AppError } from "@/lib/AppError";

export async function POST() {
  const cookieStore = cookies();
  const rawRefreshToken = cookieStore.get("refresh_token")?.value;

  if (!rawRefreshToken) {
    const response = NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "No refresh token" } },
      { status: 401 }
    );
    response.cookies.delete("refresh_token");
    return response;
  }

  try {
    const { accessToken, refreshToken } = await refreshTokens(rawRefreshToken);

    const response = NextResponse.json(
      { data: { accessToken } },
      { status: 200 }
    );

    response.cookies.set("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 7,
      path: "/api/auth",
    });

    return response;
  } catch (err) {
    const response = NextResponse.json(
      {
        error: {
          code: err instanceof AppError ? err.code : "INTERNAL_ERROR",
          message: "Refresh failed",
        },
      },
      { status: 401 }
    );
    response.cookies.delete("refresh_token");
    return response;
  }
}
