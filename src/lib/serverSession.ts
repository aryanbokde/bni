import { cookies } from "next/headers";
import type { AuthContext } from "./auth";
import { verifyAccessToken } from "./auth";

const SESSION_KEY = "bni_session";

/**
 * For Server Components and API routes.
 * Reads the access token from the Authorization header (if a Request is provided),
 * or falls back to reading non-sensitive session metadata from a cookie.
 */
export async function getServerSession(
  req?: Request
): Promise<AuthContext | null> {
  try {
    // If a Request is provided (e.g. in API routes), read from header
    if (req) {
      const authHeader = req.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        return verifyAccessToken(authHeader.slice(7));
      }
      return null;
    }

    // For Server Components, read the session metadata cookie
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get(SESSION_KEY);
    if (!sessionCookie?.value) return null;

    const parsed = JSON.parse(sessionCookie.value) as AuthContext;
    if (parsed.memberId && parsed.chapterId && parsed.role) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
