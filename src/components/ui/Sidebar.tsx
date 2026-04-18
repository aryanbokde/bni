"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/SessionContext";
import {
  LayoutDashboard,
  Users,
  Grid3x3,
  Map as MapIcon,
  Sparkles,
  FileText,
  Settings,
  ChevronLeft,
  Menu as MenuIcon,
  X,
  type LucideIcon,
} from "lucide-react";
import Tooltip from "./Tooltip";
import UserMenu from "./UserMenu";

const LT_ROLES = ["ADMIN", "PRESIDENT", "VP", "SECRETARY", "TREASURER"];

interface MenuItem {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
  roles: string[] | null;
  matchExact?: boolean;
}

const MENU_ITEMS: MenuItem[] = [
  { id: "dashboard", href: "/chapter", label: "Dashboard", icon: LayoutDashboard, roles: LT_ROLES, matchExact: true },
  { id: "members", href: "/chapter/members", label: "Members", icon: Users, roles: null },
  { id: "matrix", href: "/chapter/matrix", label: "Matrix", icon: Grid3x3, roles: LT_ROLES },
  { id: "map", href: "/chapter/map", label: "Map", icon: MapIcon, roles: null },
  { id: "recommendations", href: "/chapter/recommendations", label: "Recommendations", icon: Sparkles, roles: null },
  { id: "audit", href: "/chapter/audit", label: "Audit Log", icon: FileText, roles: LT_ROLES },
  { id: "settings", href: "/chapter/settings", label: "Settings", icon: Settings, roles: LT_ROLES },
];

const COLLAPSE_KEY = "bni-sidebar-collapsed";

export default function Sidebar() {
  const pathname = usePathname();
  const { session } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);

  // Restore collapsed state
  useEffect(() => {
    try {
      const saved = localStorage.getItem(COLLAPSE_KEY);
      if (saved === "true") setCollapsed(true);
    } catch {}
  }, []);

  // Reflect collapsed state on <html> for layout margin
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.sidebar = collapsed ? "collapsed" : "expanded";
    }
  }, [collapsed]);

  // Persist collapsed state
  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, String(next));
      } catch {}
      return next;
    });
  }, []);

  // Keyboard shortcut: Ctrl/Cmd + B
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleCollapse();
      }
      if (e.key === "Escape") {
        setMobileOpen(false);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [toggleCollapse]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  if (!session) return null;

  const userRole = session.role;

  // Filter at render time — security requirement
  const visibleItems = MENU_ITEMS.filter(
    (item) => item.roles === null || item.roles.includes(userRole)
  );

  // Current page title from pathname
  const currentItem = visibleItems.find((item) =>
    item.matchExact ? pathname === item.href : pathname?.startsWith(item.href)
  );
  const pageTitle = currentItem?.label ?? "BNI Connect";

  function isActive(item: MenuItem): boolean {
    if (item.matchExact) return pathname === item.href;
    return pathname?.startsWith(item.href) ?? false;
  }

  // ─── Menu item renderer ─────────────────────────
  function renderMenuItem(item: MenuItem, showLabel: boolean) {
    const Icon = item.icon;
    const active = isActive(item);
    const content = (
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`
          group relative flex items-center gap-3 rounded-lg
          transition-all duration-normal ease-smooth
          ${showLabel ? "px-3 py-2.5" : "px-3 py-3 justify-center"}
          ${
            active
              ? "bg-white/10 text-white font-semibold"
              : "text-white/60 hover:text-white hover:bg-white/5"
          }
        `}
      >
        {active && (
          <span
            className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-bni-blue-400 rounded-r"
            aria-hidden="true"
          />
        )}
        <Icon className="w-5 h-5 flex-shrink-0" strokeWidth={2.2} />
        {showLabel && (
          <span className="text-sm truncate">{item.label}</span>
        )}
      </Link>
    );

    if (!showLabel) {
      return (
        <Tooltip key={item.id} content={item.label} side="right">
          {content}
        </Tooltip>
      );
    }
    return <div key={item.id}>{content}</div>;
  }

  // ─── Sidebar content ─────────────────────────
  const sidebarContent = (showLabels: boolean) => (
    <div className="flex flex-col h-full">
      {/* Top: Logo */}
      <div
        className={`
          flex items-center h-16 border-b border-white/10
          ${showLabels ? "px-4 justify-between" : "px-3 justify-center"}
        `}
      >
        <Link href="/chapter/members" className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-bni-blue-400 to-bni-blue-700 flex items-center justify-center font-bold text-white text-sm flex-shrink-0 shadow-soft">
            B
          </div>
          {showLabels && (
            <div className="min-w-0">
              <div className="text-sm font-bold text-white truncate leading-tight">
                BNI Connect
              </div>
              <div className="text-[0.6875rem] text-white/50 truncate">
                Ahmedabad Central
              </div>
            </div>
          )}
        </Link>
        {showLabels && (
          <button
            onClick={toggleCollapse}
            className="hidden lg:flex w-7 h-7 items-center justify-center rounded-md text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Collapse sidebar"
            title="Collapse (Ctrl+B)"
          >
            <ChevronLeft className="w-4 h-4" strokeWidth={2.5} />
          </button>
        )}
      </div>

      {/* Middle: Menu */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-4 px-2 space-y-0.5">
        {visibleItems.map((item) => renderMenuItem(item, showLabels))}
      </nav>

      {/* Collapsed expand button */}
      {!showLabels && (
        <button
          onClick={toggleCollapse}
          className="hidden lg:flex mx-auto mb-2 w-8 h-8 items-center justify-center rounded-md text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Expand sidebar"
          title="Expand (Ctrl+B)"
        >
          <MenuIcon className="w-4 h-4" strokeWidth={2.5} />
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* ─── Desktop Sidebar ─── */}
      <aside
        className={`
          hidden lg:flex fixed left-0 top-0 bottom-0 z-30
          bg-gradient-to-b from-navy-800 via-navy-700 to-navy-900
          transition-all duration-normal ease-smooth
          ${collapsed ? "w-[72px]" : "w-[260px]"}
        `}
        aria-label="Main navigation"
      >
        {sidebarContent(!collapsed)}
      </aside>

      {/* ─── Mobile Top Bar ─── */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-20 h-14 bg-white border-b border-slate-200 flex items-center justify-between px-3 shadow-soft">
        <button
          onClick={() => setMobileOpen(true)}
          className="w-11 h-11 flex items-center justify-center rounded-lg text-navy-700 hover:bg-slate-100 transition-colors"
          aria-label="Open menu"
        >
          <MenuIcon className="w-6 h-6" strokeWidth={2.2} />
        </button>

        <h1 className="text-base font-bold text-navy truncate mx-2">{pageTitle}</h1>

        <UserMenu variant="light" showDetails={false} />
      </header>

      {/* ─── Mobile Drawer Backdrop ─── */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fade-in"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ─── Mobile Drawer ─── */}
      <aside
        ref={drawerRef}
        className={`
          lg:hidden fixed left-0 top-0 bottom-0 z-50 w-[280px]
          bg-gradient-to-b from-navy-800 via-navy-700 to-navy-900
          transform transition-transform duration-normal ease-smooth
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        aria-label="Main navigation"
        aria-hidden={!mobileOpen}
      >
        <div className="absolute top-3 right-3">
          <button
            onClick={() => setMobileOpen(false)}
            className="w-9 h-9 flex items-center justify-center rounded-md text-white/60 hover:text-white hover:bg-white/10"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" strokeWidth={2.5} />
          </button>
        </div>
        {sidebarContent(true)}
      </aside>
    </>
  );
}
