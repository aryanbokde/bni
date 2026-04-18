import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose/jwt/verify";

// Middleware runs in Edge Runtime — cannot use jsonwebtoken (Node.js only).
// Use jose (Web Crypto based) for JWT verification here.

const PUBLIC_API_PATHS = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/refresh",
  "/api/webhooks",
];

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only intercept API routes (not page routes)
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Public API routes: no auth needed
  if (PUBLIC_API_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // All other API routes: require Bearer token
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (token) {
    try {
      await jwtVerify(token, getJwtSecret(), { algorithms: ["HS256"] });
      return NextResponse.next();
    } catch {
      // Token invalid or expired — fall through to 401
    }
  }

  return NextResponse.json(
    { error: { code: "UNAUTHENTICATED", message: "Authentication required" } },
    { status: 401 }
  );
}

export const config = {
  matcher: ["/api/:path*"],
};
