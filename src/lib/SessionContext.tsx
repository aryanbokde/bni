"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type { AuthContext } from "./auth";
import {
  getClientSession,
  setClientSession,
  clearClientSession,
} from "./session";
import { useSetAccessToken } from "./TokenProvider";

interface SessionContextValue {
  session: AuthContext | null;
  setSession: (session: AuthContext) => void;
  logout: () => Promise<void>;
}

const SessionCtx = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionCtx);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

export default function SessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSessionState] = useState<AuthContext | null>(null);
  const router = useRouter();
  const setAccessToken = useSetAccessToken();

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = getClientSession();
    if (stored) {
      setSessionState(stored);
    }
  }, []);

  const setSession = useCallback((newSession: AuthContext) => {
    setClientSession(newSession);
    setSessionState(newSession);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Fail silently — always complete logout from user's perspective
    }
    clearClientSession();
    setSessionState(null);
    setAccessToken(null);
    router.push("/login");
  }, [router, setAccessToken]);

  const value = useMemo(
    () => ({ session, setSession, logout }),
    [session, setSession, logout]
  );

  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}
