import type { AuthContext } from "./auth";

const SESSION_KEY = "bni_session";

/**
 * For Client Components — reads non-sensitive session data from localStorage.
 * The actual access token is in memory via TokenProvider.
 * This provides memberId, chapterId, and role for UI rendering.
 */
export function getClientSession(): AuthContext | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as AuthContext;
    if (parsed.memberId && parsed.chapterId && parsed.role) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function setClientSession(session: AuthContext): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearClientSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
}

export { SESSION_KEY };
