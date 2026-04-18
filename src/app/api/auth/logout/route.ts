import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { logout } from "@/services/AuthService";

export async function POST() {
  const cookieStore = cookies();
  const refreshToken = cookieStore.get("refresh_token")?.value;

  if (refreshToken) {
    await logout(refreshToken);
  }

  const response = new NextResponse(null, { status: 204 });
  response.cookies.delete("refresh_token");
  response.cookies.delete("bni_session");
  return response;
}
