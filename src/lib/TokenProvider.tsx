"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { clearClientSession } from "./session";

interface TokenContextValue {
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
  refreshAccessToken: () => Promise<string | null>;
}

const TokenContext = createContext<TokenContextValue | null>(null);

export function useAccessToken(): string | null {
  const ctx = useContext(TokenContext);
  if (!ctx) throw new Error("useAccessToken must be used within TokenProvider");
  return ctx.accessToken;
}

export function useSetAccessToken(): (token: string | null) => void {
  const ctx = useContext(TokenContext);
  if (!ctx)
    throw new Error("useSetAccessToken must be used within TokenProvider");
  return ctx.setAccessToken;
}

export function useRefreshAccessToken(): () => Promise<string | null> {
  const ctx = useContext(TokenContext);
  if (!ctx)
    throw new Error(
      "useRefreshAccessToken must be used within TokenProvider"
    );
  return ctx.refreshAccessToken;
}

const PUBLIC_PATHS = ["/login"];

export default function TokenProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const isPublicPath = PUBLIC_PATHS.some((p) => pathname?.startsWith(p));

  // Deduplicate concurrent refresh calls
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    // If a refresh is already in flight, reuse it
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const promise = (async () => {
      try {
        const res = await fetch("/api/auth/refresh", { method: "POST" });
        if (!res.ok) {
          setAccessToken(null);
          clearClientSession();
          return null;
        }
        const data = await res.json();
        const token = data.data?.accessToken ?? null;
        setAccessToken(token);
        return token;
      } catch {
        setAccessToken(null);
        clearClientSession();
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = promise;
    return promise;
  }, []);

  useEffect(() => {
    if (isPublicPath) {
      setLoading(false);
      return;
    }

    // If we already have a token (e.g. just logged in), don't refresh
    if (accessToken) {
      setLoading(false);
      return;
    }

    refreshAccessToken().then((token) => {
      if (!token) {
        // Keep rendering null until the redirect completes — prevents
        // client pages from mounting with no session and crashing.
        router.replace("/login");
        return;
      }
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPublicPath]);

  const value = useMemo(
    () => ({ accessToken, setAccessToken, refreshAccessToken }),
    [accessToken, refreshAccessToken]
  );

  if (loading && !isPublicPath) return null;

  return (
    <TokenContext.Provider value={value}>{children}</TokenContext.Provider>
  );
}
