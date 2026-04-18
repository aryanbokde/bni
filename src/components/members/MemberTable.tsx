"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  Pencil,
  Users as UsersIcon,
} from "lucide-react";
import type { MemberDecrypted } from "@/types/member";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";

type SortField = "full_name" | "biz_category" | "chapter_role" | "joining_date";
type SortDir = "asc" | "desc";

interface Props {
  members: MemberDecrypted[];
  isAdmin: boolean;
  currentMemberId: string;
}

const ROLE_VARIANTS: Record<string, "red" | "blue" | "navy" | "neutral"> = {
  ADMIN: "red",
  PRESIDENT: "blue",
  VP: "blue",
  SECRETARY: "navy",
  TREASURER: "navy",
  MEMBER: "neutral",
};

const STATUS_VARIANTS: Record<string, "green" | "amber" | "neutral"> = {
  ACTIVE: "green",
  INACTIVE: "amber",
  ARCHIVED: "neutral",
};

export default function MemberTable({
  members,
  isAdmin,
  currentMemberId,
}: Props) {
  const [sortField, setSortField] = useState<SortField>("full_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const sorted = [...members].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    const aStr = aVal instanceof Date ? aVal.getTime() : String(aVal ?? "");
    const bStr = bVal instanceof Date ? bVal.getTime() : String(bVal ?? "");
    if (aStr < bStr) return sortDir === "asc" ? -1 : 1;
    if (aStr > bStr) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-300" strokeWidth={2.5} />;
    }
    return sortDir === "asc" ? (
      <ArrowUp className="w-3 h-3 text-bni-blue" strokeWidth={2.5} />
    ) : (
      <ArrowDown className="w-3 h-3 text-bni-blue" strokeWidth={2.5} />
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="py-4">
        <EmptyState
          icon={<UsersIcon className="w-7 h-7" />}
          title="No members found"
          description="Try adjusting your filters or search terms."
        />
      </div>
    );
  }

  return (
    <>
      {/* ═══════ Desktop: Table ═══════ */}
      <div className="hidden md:block overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-slate-100 bg-slate-50/50">
              <th className="py-3 px-5 font-semibold text-[0.6875rem] uppercase tracking-wider text-slate-500">
                <button
                  type="button"
                  onClick={() => handleSort("full_name")}
                  className="flex items-center gap-1.5 hover:text-navy transition-colors"
                >
                  Name
                  <SortIcon field="full_name" />
                </button>
              </th>
              <th className="py-3 px-3 font-semibold text-[0.6875rem] uppercase tracking-wider text-slate-500">
                <button
                  type="button"
                  onClick={() => handleSort("biz_category")}
                  className="flex items-center gap-1.5 hover:text-navy transition-colors"
                >
                  Category
                  <SortIcon field="biz_category" />
                </button>
              </th>
              <th className="py-3 px-3 font-semibold text-[0.6875rem] uppercase tracking-wider text-slate-500">
                Role
              </th>
              <th className="py-3 px-3 font-semibold text-[0.6875rem] uppercase tracking-wider text-slate-500">
                Status
              </th>
              <th className="py-3 px-3 font-semibold text-[0.6875rem] uppercase tracking-wider text-slate-500">
                <button
                  type="button"
                  onClick={() => handleSort("joining_date")}
                  className="flex items-center gap-1.5 hover:text-navy transition-colors"
                >
                  Joined
                  <SortIcon field="joining_date" />
                </button>
              </th>
              <th className="py-3 px-5 font-semibold text-[0.6875rem] uppercase tracking-wider text-slate-500 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => {
              const canEdit = isAdmin || m.member_id === currentMemberId;
              return (
                <tr
                  key={m.member_id}
                  className="group border-b border-slate-50 hover:bg-slate-50/60 transition-colors duration-fast"
                >
                  <td className="py-3 px-5">
                    <Link
                      href={`/chapter/members/${m.member_id}`}
                      className="flex items-center gap-3 min-w-0"
                    >
                      <Avatar name={m.full_name} size="sm" />
                      <div className="min-w-0">
                        <div className="font-semibold text-navy truncate group-hover:text-bni-blue transition-colors">
                          {m.full_name}
                        </div>
                        {m.one_line_summary && (
                          <div className="text-xs text-slate-500 truncate">
                            {m.one_line_summary}
                          </div>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="py-3 px-3 text-slate-600 text-xs">
                    {m.biz_category}
                  </td>
                  <td className="py-3 px-3">
                    <Badge
                      variant={ROLE_VARIANTS[m.chapter_role] ?? "neutral"}
                      size="sm"
                    >
                      {m.chapter_role}
                    </Badge>
                  </td>
                  <td className="py-3 px-3">
                    <Badge
                      variant={STATUS_VARIANTS[m.status] ?? "neutral"}
                      size="sm"
                    >
                      {m.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-3 text-slate-500 text-xs">
                    {new Date(m.joining_date).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="py-3 px-5">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/chapter/members/${m.member_id}`}
                        className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:text-bni-blue hover:bg-bni-blue-50 transition-colors"
                        aria-label="View profile"
                      >
                        <Eye className="w-4 h-4" strokeWidth={2.2} />
                      </Link>
                      {canEdit && (
                        <Link
                          href={`/chapter/members/${m.member_id}`}
                          className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:text-bni-blue hover:bg-bni-blue-50 transition-colors"
                          aria-label="Edit profile"
                        >
                          <Pencil className="w-4 h-4" strokeWidth={2.2} />
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ═══════ Mobile: Card Grid ═══════ */}
      <div className="md:hidden space-y-2.5 p-3">
        {sorted.map((m) => (
          <Link
            key={m.member_id}
            href={`/chapter/members/${m.member_id}`}
            className="block bg-white rounded-xl border border-slate-100 shadow-soft p-3.5 active:scale-[0.98] transition-transform duration-fast"
          >
            <div className="flex items-start gap-3">
              <Avatar name={m.full_name} size="md" />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-semibold text-navy truncate text-sm">
                    {m.full_name}
                  </h3>
                  <Badge
                    variant={STATUS_VARIANTS[m.status] ?? "neutral"}
                    size="sm"
                  >
                    {m.status}
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 truncate mb-2">
                  {m.biz_category}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant={ROLE_VARIANTS[m.chapter_role] ?? "neutral"}
                    size="sm"
                  >
                    {m.chapter_role}
                  </Badge>
                  <span className="text-[0.6875rem] text-slate-400">
                    Joined{" "}
                    {new Date(m.joining_date).toLocaleDateString("en-GB", {
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
