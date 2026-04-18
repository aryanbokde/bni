import { NextResponse } from "next/server";

export function withCors(res: NextResponse): NextResponse {
  res.headers.set(
    "Access-Control-Allow-Origin",
    process.env.NEXT_PUBLIC_APP_URL!
  );
  res.headers.set(
    "Access-Control-Allow-Methods",
    "GET,POST,PATCH,DELETE,OPTIONS"
  );
  res.headers.set(
    "Access-Control-Allow-Headers",
    "Authorization,Content-Type"
  );
  res.headers.set("Access-Control-Allow-Credentials", "true");
  return res;
}
