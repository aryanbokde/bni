"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { LogOut, User, ChevronDown } from "lucide-react";
import { useSession } from "@/lib/SessionContext";
import { useApi } from "@/hooks/useApi";
import Avatar from "./Avatar";

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  ADMIN: { label: "Admin", color: "bg-bni-red-500" },
  PRESIDENT: { label: "President", color: "bg-bni-blue-600" },
  VP: { label: "Vice President", color: "bg-bni-blue-500" },
  SECRETARY: { label: "Secretary", color: "bg-navy-500" },
  TREASURER: { label: "Treasurer", color: "bg-teal" },
  MEMBER: { label: "Member", color: "bg-slate-500" },
};

interface UserMenuProps {
  variant?: "light" | "dark";
  showDetails?: boolean;
}

export default function UserMenu({
  variant = "light",
  showDetails = true,
}: UserMenuProps) {
  const pathname = usePathname();
  const { session, logout } = useSession();
  const api = useApi();
  const [open, setOpen] = useState(false);

  const { data: me } = useQuery<{ full_name: string }>({
    queryKey: ["me", session?.memberId],
    queryFn: async () => {
      if (!session) throw new Error("no session");
      const res = await api.get(
        `/chapters/${session.chapterId}/members/${session.memberId}`
      );
      return res.data.data;
    },
    enabled: !!session,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (target && !target.closest("[data-topbar-user-menu]")) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  if (!session) return null;

  const displayName = me?.full_name ?? "User";
  const roleInfo = ROLE_LABELS[session.role] ?? ROLE_LABELS.MEMBER;
  const isDark = variant === "dark";

  return (
    <div className="relative" data-topbar-user-menu>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`
          flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors
          ${
            isDark
              ? "hover:bg-white/10"
              : "hover:bg-slate-100"
          }
        `}
        aria-label="User menu"
        aria-expanded={open}
      >
        <Avatar name={displayName} size="sm" />
        {showDetails && (
          <div className="hidden sm:block text-left min-w-0">
            <div
              className={`text-sm font-semibold truncate leading-tight ${
                isDark ? "text-white" : "text-navy"
              }`}
            >
              {displayName}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${roleInfo.color}`}
                aria-hidden="true"
              />
              <span
                className={`text-[0.6875rem] truncate ${
                  isDark ? "text-white/60" : "text-slate-500"
                }`}
              >
                {roleInfo.label}
              </span>
            </div>
          </div>
        )}
        <ChevronDown
          className={`w-4 h-4 flex-shrink-0 transition-transform duration-normal ${
            open ? "rotate-180" : ""
          } ${isDark ? "text-white/60" : "text-slate-400"}`}
          strokeWidth={2.5}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-strong py-1 z-50 animate-slide-up border border-slate-100">
          <div className="px-3 py-2 border-b border-slate-100">
            <div className="text-sm font-semibold text-navy truncate">
              {displayName}
            </div>
            <div className="text-xs text-slate-500 truncate">
              {roleInfo.label}
            </div>
          </div>
          <Link
            href={`/chapter/members/${session.memberId}`}
            onMouseDown={(e) => e.stopPropagation()}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <User className="w-4 h-4 text-slate-400" />
            My Profile
          </Link>
          <div className="h-px bg-slate-100 my-1" />
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={async (e) => {
              e.stopPropagation();
              e.preventDefault();
              try {
                await logout();
              } catch (err) {
                console.error("[UserMenu] logout error:", err);
              }
              window.location.href = "/login";
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-bni-red-600 hover:bg-bni-red-50 text-left font-medium"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
