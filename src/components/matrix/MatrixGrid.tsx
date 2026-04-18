"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Hourglass,
  X as XIcon,
  Minus,
  Users,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Ban,
  RotateCcw,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import type { CellState } from "@/types/matrix";
import Card from "@/components/ui/Card";
import Avatar from "@/components/ui/Avatar";
import EmptyState from "@/components/ui/EmptyState";

interface MatrixMember {
  member_id: string;
  full_name: string;
  biz_category: string;
}

interface MatrixCellData {
  state: CellState;
  lastInteractionDate?: string;
  recId?: string;
  recSentAt?: string;
}

interface MatrixResponse {
  members: MatrixMember[];
  cells: MatrixCellData[][];
  windowDays: number;
}

interface CoverageData {
  totalMembers: number;
  membersMet: number;
  notCovered: number;
  coveragePct: number;
  lastInteractionDate: string | null;
  pendingRecs: number;
}

const CELL_STYLES: Record<CellState, string> = {
  GREEN:
    "bg-gradient-to-br from-bni-green-50 to-bni-green-100 border-bni-green-200 text-bni-green-600 hover:from-bni-green-100 hover:to-bni-green-100",
  AMBER:
    "bg-gradient-to-br from-bni-amber-50 to-bni-amber-100 border-bni-amber-200 text-bni-amber-600 hover:from-bni-amber-100 hover:to-bni-amber-100",
  GAP: "bg-white border-dashed border-slate-200 hover:bg-slate-50 hover:border-slate-300",
  EXCLUDED:
    "bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-150",
  SELF: "bg-slate-50 border-slate-100 cursor-default",
};

const WINDOWS = [30, 90, 180] as const;

const CELL_ICONS: Record<CellState, React.ReactNode> = {
  GREEN: <Check className="w-3.5 h-3.5" strokeWidth={3} />,
  AMBER: <Hourglass className="w-3 h-3" strokeWidth={2.5} />,
  GAP: null,
  EXCLUDED: <XIcon className="w-3 h-3" strokeWidth={3} />,
  SELF: <Minus className="w-3 h-3 text-slate-300" strokeWidth={2} />,
};

export default function MatrixGrid({ chapterId }: { chapterId: string }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [windowDays, setWindowDays] = useState<30 | 90 | 180>(180);
  const [selectedCell, setSelectedCell] = useState<{
    ri: number;
    ci: number;
  } | null>(null);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  const { data, isLoading } = useQuery<MatrixResponse>({
    queryKey: ["matrix", chapterId, windowDays],
    queryFn: async () => {
      const res = await api.get(
        `/chapters/${chapterId}/matrix?windowDays=${windowDays}`
      );
      return res.data.data;
    },
    staleTime: 30_000,
  });

  function invalidateMatrix() {
    queryClient.invalidateQueries({ queryKey: ["matrix", chapterId] });
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-slate-100 rounded-lg w-64 animate-pulse" />
        <Card>
          <div className="h-[400px] shimmer rounded-lg m-5" />
        </Card>
      </div>
    );
  }

  const { members, cells } = data;

  // Count interactions in window for subtitle
  let interactionCount = 0;
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells[i].length; j++) {
      if (cells[i][j].state === "GREEN") interactionCount++;
    }
  }

  if (members.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Users className="w-7 h-7" />}
          title="No active members"
          description="Add members to your chapter to see the engagement matrix."
        />
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-5">
        {/* ═══════ Header ═══════ */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h1 className="text-headline text-navy">Engagement Matrix</h1>
            <p className="text-sm text-slate-500 mt-1">
              {members.length}{" "}
              {members.length === 1 ? "member" : "members"} &middot;{" "}
              {interactionCount}{" "}
              {interactionCount === 1 ? "interaction" : "interactions"} in last{" "}
              {windowDays} days
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Segmented time filter */}
            <div className="inline-flex bg-slate-100 rounded-lg p-1">
              {WINDOWS.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWindowDays(w)}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all duration-normal ${
                    windowDays === w
                      ? "bg-white text-navy shadow-soft"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {w}d
                </button>
              ))}
            </div>

            {/* Export button temporarily hidden */}
          </div>
        </div>

        {/* ═══════ Inline Legend ═══════ */}
        <div className="flex items-center gap-3 flex-wrap text-xs">
          <LegendItem
            color="bg-gradient-to-br from-bni-green-100 to-bni-green-50 border-bni-green-200 text-bni-green-600"
            icon={<Check className="w-3 h-3" strokeWidth={3} />}
            label="Met"
          />
          <LegendItem
            color="bg-gradient-to-br from-bni-amber-100 to-bni-amber-50 border-bni-amber-200 text-bni-amber-600"
            icon={<Hourglass className="w-2.5 h-2.5" strokeWidth={2.5} />}
            label="Sent"
          />
          <LegendItem
            color="bg-white border-dashed border-slate-300"
            icon={null}
            label="Gap"
          />
          <LegendItem
            color="bg-slate-100 border-slate-200 text-slate-500"
            icon={<XIcon className="w-2.5 h-2.5" strokeWidth={3} />}
            label="Excluded"
          />
        </div>

        {/* ═══════ Matrix Grid ═══════ */}
        <Card variant="default" className="overflow-hidden">
          <div className="overflow-auto scrollbar-thin max-h-[72vh]">
            <table className="border-separate border-spacing-0.5 p-2">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-20 bg-white/90 backdrop-blur-md text-navy text-[0.6875rem] uppercase tracking-wider font-bold p-2 min-w-[140px] text-left border-b border-r border-slate-100">
                    Member
                  </th>
                  {members.map((m) => (
                    <th
                      key={m.member_id}
                      className="sticky top-0 z-10 bg-white/90 backdrop-blur-md text-navy text-[0.6875rem] font-semibold p-1 min-w-[40px] max-w-[40px] cursor-pointer hover:bg-slate-100 border-b border-slate-100 transition-colors"
                      title={m.full_name}
                      onClick={() => setSelectedMember(m.member_id)}
                    >
                      <div
                        className="truncate h-[90px] flex items-end justify-center pb-1"
                        style={{
                          writingMode: "vertical-rl",
                          textOrientation: "mixed",
                        }}
                      >
                        {m.full_name.split(" ")[0]}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((m, ri) => (
                  <tr key={m.member_id}>
                    <td
                      className="sticky left-0 z-10 bg-white/90 backdrop-blur-md border-r border-slate-100 text-xs font-semibold text-navy p-2 truncate max-w-[140px] cursor-pointer hover:bg-slate-50 transition-colors"
                      title={`${m.full_name} — ${m.biz_category}`}
                      onClick={() => setSelectedMember(m.member_id)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar name={m.full_name} size="xs" />
                        <span className="truncate">{m.full_name}</span>
                      </div>
                    </td>
                    {cells[ri].map((cell, ci) => (
                      <td
                        key={ci}
                        className={`border rounded-md text-center min-w-[36px] h-[36px] transition-all duration-fast ${
                          cell.state !== "SELF"
                            ? "cursor-pointer hover:scale-[1.08] hover:shadow-soft hover:z-10 relative"
                            : ""
                        } ${CELL_STYLES[cell.state]}`}
                        onClick={() => {
                          if (cell.state !== "SELF")
                            setSelectedCell({ ri, ci });
                        }}
                        title={
                          cell.state === "GREEN"
                            ? `Met: ${
                                cell.lastInteractionDate?.slice(0, 10) ?? "?"
                              }`
                            : cell.state === "AMBER"
                            ? `Sent: ${cell.recSentAt?.slice(0, 10) ?? "?"}`
                            : cell.state
                        }
                      >
                        <div className="flex items-center justify-center h-full">
                          {CELL_ICONS[cell.state]}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Mobile hint */}
        <p className="lg:hidden text-center text-xs text-slate-400">
          Swipe horizontally to view more &rarr;
        </p>
      </div>

      {/* ═══════ Drawers ═══════ */}
      {selectedMember && (
        <CoveragePanel
          chapterId={chapterId}
          memberId={selectedMember}
          windowDays={windowDays}
          members={members}
          onClose={() => setSelectedMember(null)}
          api={api}
          onAction={invalidateMatrix}
        />
      )}

      {selectedCell && (
        <PairActionDrawer
          chapterId={chapterId}
          cell={cells[selectedCell.ri][selectedCell.ci]}
          memberA={members[selectedCell.ri]}
          memberB={members[selectedCell.ci]}
          onClose={() => setSelectedCell(null)}
          api={api}
          onAction={invalidateMatrix}
        />
      )}
    </>
  );
}

/* ─────────── Legend Item ─────────── */
function LegendItem({
  color,
  icon,
  label,
}: {
  color: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`w-5 h-5 rounded-md border flex items-center justify-center ${color}`}
      >
        {icon}
      </div>
      <span className="text-slate-600 font-medium">{label}</span>
    </div>
  );
}

/* ─────────── Coverage Panel ─────────── */

function CoveragePanel({
  chapterId,
  memberId,
  windowDays,
  members,
  onClose,
  api,
}: {
  chapterId: string;
  memberId: string;
  windowDays: number;
  members: MatrixMember[];
  onClose: () => void;
  api: ReturnType<typeof useApi>;
  onAction: () => void;
}) {
  const member = members.find((m) => m.member_id === memberId);

  const { data: coverage, isLoading } = useQuery<CoverageData>({
    queryKey: ["coverage", chapterId, memberId, windowDays],
    queryFn: async () => {
      const res = await api.get(
        `/chapters/${chapterId}/matrix/member/${memberId}?windowDays=${windowDays}`
      );
      return res.data.data;
    },
  });

  const r = 42;
  const c = 2 * Math.PI * r;
  const pct = coverage?.coveragePct ?? 0;
  const offset = c - (pct / 100) * c;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fade-in !mt-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="fixed top-0 right-0 h-full w-full max-w-sm bg-white z-50 shadow-strong overflow-y-auto scrollbar-thin !mt-0 animate-slide-in-right"
        role="dialog"
        aria-label="Member coverage"
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={member?.full_name ?? "?"} size="md" />
            <div className="min-w-0">
              <h2 className="text-base font-bold text-navy truncate">
                {member?.full_name ?? "Member"}
              </h2>
              <p className="text-xs text-slate-500 truncate">
                {member?.biz_category}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0"
            aria-label="Close"
          >
            <XIcon className="w-5 h-5" strokeWidth={2.5} />
          </button>
        </div>

        {isLoading || !coverage ? (
          <div className="p-6 space-y-3">
            <div className="h-32 shimmer rounded-lg" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-20 shimmer rounded-lg" />
              <div className="h-20 shimmer rounded-lg" />
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Coverage circle */}
            <div className="flex flex-col items-center py-4">
              <div className="relative w-32 h-32">
                <svg viewBox="0 0 100 100" className="transform -rotate-90">
                  <circle
                    cx="50"
                    cy="50"
                    r={r}
                    fill="none"
                    stroke="#E2E8F0"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r={r}
                    fill="none"
                    stroke="url(#coverage-gradient)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={c}
                    strokeDashoffset={offset}
                    className="transition-all duration-slow"
                  />
                  <defs>
                    <linearGradient
                      id="coverage-gradient"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#2E75B6" />
                      <stop offset="100%" stopColor="#1B2A4A" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-4xl font-bold text-navy leading-none">
                    {pct}%
                  </div>
                  <div className="text-[0.6875rem] text-slate-500 uppercase tracking-wider mt-1">
                    Coverage
                  </div>
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <StatBox label="Met" value={coverage.membersMet} color="green" />
              <StatBox
                label="Not Covered"
                value={coverage.notCovered}
                color="amber"
              />
              <StatBox
                label="Total Members"
                value={coverage.totalMembers}
                color="navy"
              />
              <StatBox
                label="Pending Recs"
                value={coverage.pendingRecs}
                color="blue"
              />
            </div>

            <div className="text-xs text-slate-500 text-center pt-2">
              Last 1-2-1:{" "}
              <span className="font-semibold text-slate-700">
                {coverage.lastInteractionDate
                  ? new Date(coverage.lastInteractionDate).toLocaleDateString(
                      "en-GB",
                      { day: "numeric", month: "long", year: "numeric" }
                    )
                  : "None"}
              </span>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "green" | "amber" | "navy" | "blue";
}) {
  const colorClass = {
    green: "text-bni-green-600 bg-bni-green-50",
    amber: "text-bni-amber-600 bg-bni-amber-50",
    navy: "text-navy bg-navy-50",
    blue: "text-bni-blue-600 bg-bni-blue-50",
  }[color];

  return (
    <div className="rounded-lg border border-slate-100 p-3 text-center bg-white">
      <div className={`text-2xl font-bold ${colorClass.split(" ")[0]}`}>
        {value}
      </div>
      <div className="text-[0.6875rem] text-slate-500 uppercase tracking-wider mt-0.5 font-semibold">
        {label}
      </div>
    </div>
  );
}

/* ─────────── Pair Action Drawer ─────────── */

function PairActionDrawer({
  chapterId,
  cell,
  memberA,
  memberB,
  onClose,
  api,
  onAction,
}: {
  chapterId: string;
  cell: MatrixCellData;
  memberA: MatrixMember;
  memberB: MatrixMember;
  onClose: () => void;
  api: ReturnType<typeof useApi>;
  onAction: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [completeDate, setCompleteDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [excludeReason, setExcludeReason] = useState("");

  async function handleManualPairing() {
    setLoading(true);
    try {
      await api.post(`/chapters/${chapterId}/recommendations/manual`, {
        member_a_id: memberA.member_id,
        member_b_id: memberB.member_id,
      });
      onAction();
      onClose();
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  async function handleComplete() {
    if (!cell.recId) return;
    setLoading(true);
    try {
      await api.post(
        `/chapters/${chapterId}/recommendations/${cell.recId}/complete`,
        { interaction_date: completeDate }
      );
      onAction();
      onClose();
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  async function handleReinstate() {
    if (!cell.recId) return;
    setLoading(true);
    try {
      await api.post(
        `/chapters/${chapterId}/recommendations/${cell.recId}/reinstate`,
        {}
      );
      onAction();
      onClose();
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  async function handleExcludeFromGap() {
    if (!excludeReason.trim()) return;
    setLoading(true);
    try {
      const res = await api.post(
        `/chapters/${chapterId}/recommendations/manual`,
        {
          member_a_id: memberA.member_id,
          member_b_id: memberB.member_id,
        }
      );
      const recId = res.data.data.rec_id;
      await api.post(
        `/chapters/${chapterId}/recommendations/${recId}/exclude`,
        { reason: excludeReason }
      );
      onAction();
      onClose();
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fade-in !mt-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="fixed bottom-0 left-0 right-0 md:bottom-auto md:top-0 md:right-0 md:left-auto md:h-full md:w-full md:max-w-sm bg-white z-50 shadow-strong rounded-t-2xl md:rounded-none overflow-y-auto scrollbar-thin max-h-[85vh] md:max-h-full !mt-0 animate-slide-in-right"
        role="dialog"
        aria-label="Pair actions"
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center">
              <Avatar name={memberA.full_name} size="sm" />
              <div className="-ml-2">
                <Avatar name={memberB.full_name} size="sm" />
              </div>
            </div>
            <div className="min-w-0 ml-1">
              <h2 className="text-sm font-bold text-navy truncate">
                {memberA.full_name.split(" ")[0]} &amp;{" "}
                {memberB.full_name.split(" ")[0]}
              </h2>
              <p className="text-[0.6875rem] text-slate-500 truncate">
                1-2-1 pair
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0"
            aria-label="Close"
          >
            <XIcon className="w-5 h-5" strokeWidth={2.5} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* GREEN */}
          {cell.state === "GREEN" && (
            <>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-bni-green-50 text-bni-green-600">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-soft">
                  <CheckCircle2 className="w-5 h-5" strokeWidth={2.5} />
                </div>
                <div>
                  <div className="text-sm font-semibold">1-2-1 Completed</div>
                  <div className="text-xs text-bni-green-600/80">
                    Last met:{" "}
                    {cell.lastInteractionDate
                      ? new Date(cell.lastInteractionDate).toLocaleDateString(
                          "en-GB",
                          { day: "numeric", month: "long", year: "numeric" }
                        )
                      : "Unknown"}
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-400 text-center">
                This pair is in good standing.
              </p>
            </>
          )}

          {/* AMBER */}
          {cell.state === "AMBER" && (
            <>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-bni-amber-50 text-bni-amber-600">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-soft">
                  <Hourglass className="w-5 h-5" strokeWidth={2.5} />
                </div>
                <div>
                  <div className="text-sm font-semibold">
                    Recommendation Sent
                  </div>
                  <div className="text-xs text-bni-amber-600/80">
                    Sent:{" "}
                    {cell.recSentAt
                      ? new Date(cell.recSentAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })
                      : "Unknown"}
                  </div>
                </div>
              </div>
              <div>
                <label
                  htmlFor="complete-date"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Interaction Date
                </label>
                <input
                  id="complete-date"
                  type="date"
                  value={completeDate}
                  onChange={(e) => setCompleteDate(e.target.value)}
                  className="input-field"
                />
              </div>
              <button
                type="button"
                onClick={handleComplete}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 bg-bni-green-500 text-white rounded-lg px-4 py-2.5 min-h-[44px] text-sm font-semibold hover:bg-bni-green-600 disabled:opacity-50 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" strokeWidth={2.5} />
                {loading ? "Saving..." : "Mark as Complete"}
              </button>
            </>
          )}

          {/* GAP */}
          {cell.state === "GAP" && (
            <>
              <div className="text-center py-2">
                <p className="text-sm text-slate-500">
                  No 1-2-1 yet between these members
                </p>
              </div>
              <button
                type="button"
                onClick={handleManualPairing}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 bg-navy text-white rounded-lg px-4 py-2.5 min-h-[44px] text-sm font-semibold hover:bg-navy-600 disabled:opacity-50 transition-colors shadow-soft"
              >
                <Sparkles className="w-4 h-4" strokeWidth={2.5} />
                {loading ? "Creating..." : "Recommend this pair"}
              </button>

              <div className="border-t border-slate-100 pt-4">
                <label
                  htmlFor="exclude-reason"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Or exclude with a reason
                </label>
                <input
                  id="exclude-reason"
                  type="text"
                  value={excludeReason}
                  onChange={(e) => setExcludeReason(e.target.value)}
                  placeholder="e.g. Competing businesses"
                  className="input-field mb-2"
                />
                <button
                  type="button"
                  onClick={handleExcludeFromGap}
                  disabled={loading || !excludeReason.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 bg-white text-bni-red-600 border border-slate-300 rounded-lg px-4 py-2.5 min-h-[44px] text-sm font-semibold hover:bg-bni-red-50 hover:border-bni-red-200 disabled:opacity-50 transition-colors"
                >
                  <Ban className="w-4 h-4" strokeWidth={2.5} />
                  Exclude Pair
                </button>
              </div>
            </>
          )}

          {/* EXCLUDED */}
          {cell.state === "EXCLUDED" && (
            <>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-100 text-slate-600">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-soft">
                  <XIcon className="w-5 h-5" strokeWidth={2.5} />
                </div>
                <div>
                  <div className="text-sm font-semibold">Pair Excluded</div>
                  <div className="text-xs text-slate-500">
                    This pair won&apos;t be auto-recommended.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleReinstate}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 bg-bni-blue-500 text-white rounded-lg px-4 py-2.5 min-h-[44px] text-sm font-semibold hover:bg-bni-blue-600 disabled:opacity-50 transition-colors shadow-soft"
              >
                <RotateCcw className="w-4 h-4" strokeWidth={2.5} />
                {loading ? "Reinstating..." : "Reinstate Pair"}
                <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
