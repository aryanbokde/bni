"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Ban,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Mail,
  X,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useSession } from "@/lib/SessionContext";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import EmptyState from "@/components/ui/EmptyState";

const LT_ROLES = ["ADMIN", "PRESIDENT", "VP", "SECRETARY", "TREASURER"];

interface Rec {
  rec_id: string;
  member_a_id: string;
  member_b_id: string;
  status: string;
  sent_at: string | null;
  completed_at: string | null;
  expired_at: string | null;
  excluded_at: string | null;
  excluded_reason: string | null;
}

type StatusTab = "ALL" | "SENT" | "COMPLETED" | "EXPIRED" | "EXCLUDED";

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "SENT", label: "Sent" },
  { key: "COMPLETED", label: "Completed" },
  { key: "EXPIRED", label: "Expired" },
  { key: "EXCLUDED", label: "Excluded" },
];

const STATUS_VARIANTS: Record<
  string,
  "neutral" | "amber" | "green" | "red"
> = {
  QUEUED: "neutral",
  SENT: "amber",
  COMPLETED: "green",
  EXPIRED: "red",
  EXCLUDED: "neutral",
};

export default function RecommendationTable({
  chapterId,
  memberNames,
}: {
  chapterId: string;
  memberNames: Record<string, string>;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const { session } = useSession();
  const isLT = LT_ROLES.includes(session?.role ?? "");
  const [tab, setTab] = useState<StatusTab>("ALL");
  const [page, setPage] = useState(1);

  const [completeModal, setCompleteModal] = useState<string | null>(null);
  const [completeDate, setCompleteDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [excludeModal, setExcludeModal] = useState<string | null>(null);
  const [excludeReason, setExcludeReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const statusParam = tab === "ALL" ? "" : `&status=${tab}`;
  const { data, isLoading } = useQuery({
    queryKey: ["recommendations", chapterId, tab, page],
    queryFn: async () => {
      const res = await api.get(
        `/chapters/${chapterId}/recommendations?page=${page}&pageSize=20${statusParam}`
      );
      return res.data;
    },
    staleTime: 15_000,
  });

  const recs: Rec[] = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["recommendations", chapterId] });
    queryClient.invalidateQueries({ queryKey: ["recStats", chapterId] });
  }

  async function handleComplete() {
    if (!completeModal) return;
    setActionLoading(true);
    try {
      await api.post(
        `/chapters/${chapterId}/recommendations/${completeModal}/complete`,
        { interaction_date: completeDate }
      );
      invalidate();
      setCompleteModal(null);
    } catch {
      /* ignore */
    } finally {
      setActionLoading(false);
    }
  }

  async function handleExclude() {
    if (!excludeModal || !excludeReason.trim()) return;
    setActionLoading(true);
    try {
      await api.post(
        `/chapters/${chapterId}/recommendations/${excludeModal}/exclude`,
        { reason: excludeReason }
      );
      invalidate();
      setExcludeModal(null);
      setExcludeReason("");
    } catch {
      /* ignore */
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReinstate(recId: string) {
    setActionLoading(true);
    try {
      await api.post(
        `/chapters/${chapterId}/recommendations/${recId}/reinstate`,
        {}
      );
      invalidate();
    } catch {
      /* ignore */
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <Card variant="default">
      <div className="p-4 lg:p-5">
        {/* Status segmented tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-thin pb-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setTab(t.key);
                setPage(1);
              }}
              className={`flex-shrink-0 px-4 py-2 text-xs font-semibold rounded-full transition-all duration-normal whitespace-nowrap border ${
                tab === t.key
                  ? "bg-navy text-white border-navy shadow-soft"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Loading */}
        {isLoading ? (
          <div className="space-y-3 py-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 shimmer rounded-lg" />
            ))}
          </div>
        ) : recs.length === 0 ? (
          <EmptyState
            icon={<Mail className="w-6 h-6" />}
            title="No recommendations"
            description={
              tab === "ALL"
                ? "Run a recommendation cycle to get started."
                : `No ${tab.toLowerCase()} recommendations yet.`
            }
            className="py-6"
          />
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-slate-100">
                    <th className="pb-3 pr-4 font-semibold text-[0.6875rem] uppercase tracking-wider text-slate-500">
                      Pair
                    </th>
                    <th className="pb-3 pr-4 font-semibold text-[0.6875rem] uppercase tracking-wider text-slate-500">
                      Status
                    </th>
                    <th className="pb-3 pr-4 font-semibold text-[0.6875rem] uppercase tracking-wider text-slate-500">
                      Sent
                    </th>
                    <th className="pb-3 pr-4 font-semibold text-[0.6875rem] uppercase tracking-wider text-slate-500">
                      Completed
                    </th>
                    <th className="pb-3 font-semibold text-[0.6875rem] uppercase tracking-wider text-slate-500 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recs.map((r) => {
                    const nameA =
                      memberNames[r.member_a_id] ?? r.member_a_id.slice(0, 8);
                    const nameB =
                      memberNames[r.member_b_id] ?? r.member_b_id.slice(0, 8);
                    return (
                      <tr
                        key={r.rec_id}
                        className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors duration-fast"
                      >
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="flex items-center flex-shrink-0">
                              <Avatar name={nameA} size="xs" />
                              <div className="-ml-2">
                                <Avatar name={nameB} size="xs" />
                              </div>
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-navy truncate">
                                {nameA} &amp; {nameB}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <Badge
                            variant={STATUS_VARIANTS[r.status] ?? "neutral"}
                            size="sm"
                          >
                            {r.status}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 text-xs text-slate-500">
                          {r.sent_at
                            ? new Date(r.sent_at).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                              })
                            : "—"}
                        </td>
                        <td className="py-3 pr-4 text-xs text-slate-500">
                          {r.completed_at
                            ? new Date(r.completed_at).toLocaleDateString(
                                "en-GB",
                                { day: "2-digit", month: "short" }
                              )
                            : "—"}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center justify-end gap-1">
                            {r.status === "SENT" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setCompleteModal(r.rec_id)}
                                  className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:text-bni-green-600 hover:bg-bni-green-50 transition-colors"
                                  aria-label="Mark complete"
                                  title="Mark as complete"
                                >
                                  <CheckCircle2
                                    className="w-4 h-4"
                                    strokeWidth={2.2}
                                  />
                                </button>
                                {isLT && (
                                  <button
                                    type="button"
                                    onClick={() => setExcludeModal(r.rec_id)}
                                    className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:text-bni-red-600 hover:bg-bni-red-50 transition-colors"
                                    aria-label="Exclude pair"
                                    title="Exclude"
                                  >
                                    <Ban className="w-4 h-4" strokeWidth={2.2} />
                                  </button>
                                )}
                              </>
                            )}
                            {r.status === "EXCLUDED" && isLT && (
                              <button
                                type="button"
                                onClick={() => handleReinstate(r.rec_id)}
                                disabled={actionLoading}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-bni-blue-600 hover:bg-bni-blue-50 rounded-md transition-colors disabled:opacity-50"
                              >
                                <RotateCcw
                                  className="w-3 h-3"
                                  strokeWidth={2.5}
                                />
                                Reinstate
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-2.5">
              {recs.map((r) => {
                const nameA =
                  memberNames[r.member_a_id] ?? r.member_a_id.slice(0, 8);
                const nameB =
                  memberNames[r.member_b_id] ?? r.member_b_id.slice(0, 8);
                return (
                  <div
                    key={r.rec_id}
                    className="bg-white rounded-xl border border-slate-100 shadow-soft p-3.5"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="flex items-center flex-shrink-0">
                          <Avatar name={nameA} size="sm" />
                          <div className="-ml-2">
                            <Avatar name={nameB} size="sm" />
                          </div>
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-navy truncate">
                            {nameA} &amp; {nameB}
                          </div>
                          <div className="text-[0.6875rem] text-slate-500">
                            {r.sent_at
                              ? `Sent ${new Date(
                                  r.sent_at
                                ).toLocaleDateString("en-GB", {
                                  day: "2-digit",
                                  month: "short",
                                })}`
                              : "Not sent"}
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant={STATUS_VARIANTS[r.status] ?? "neutral"}
                        size="sm"
                      >
                        {r.status}
                      </Badge>
                    </div>
                    {(r.status === "SENT" || r.status === "EXCLUDED") && (
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                        {r.status === "SENT" && (
                          <>
                            <button
                              type="button"
                              onClick={() => setCompleteModal(r.rec_id)}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-bni-green-600 hover:bg-bni-green-50 rounded-md transition-colors"
                            >
                              <CheckCircle2
                                className="w-3.5 h-3.5"
                                strokeWidth={2.5}
                              />
                              Complete
                            </button>
                            {isLT && (
                              <button
                                type="button"
                                onClick={() => setExcludeModal(r.rec_id)}
                                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-bni-red-600 hover:bg-bni-red-50 rounded-md transition-colors"
                              >
                                <Ban
                                  className="w-3.5 h-3.5"
                                  strokeWidth={2.5}
                                />
                                Exclude
                              </button>
                            )}
                          </>
                        )}
                        {r.status === "EXCLUDED" && isLT && (
                          <button
                            type="button"
                            onClick={() => handleReinstate(r.rec_id)}
                            disabled={actionLoading}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-bni-blue-600 hover:bg-bni-blue-50 rounded-md transition-colors disabled:opacity-50"
                          >
                            <RotateCcw
                              className="w-3.5 h-3.5"
                              strokeWidth={2.5}
                            />
                            Reinstate
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100">
            <span className="text-xs text-slate-500">
              {total} {total === 1 ? "result" : "results"}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-8 h-8 flex items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={2.5} />
              </button>
              <span className="text-xs font-semibold text-slate-700 px-3">
                {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Complete Modal */}
      {completeModal && (
        <Modal onClose={() => setCompleteModal(null)}>
          <h3 className="text-subtitle text-navy mb-1.5">Mark as Complete</h3>
          <p className="text-xs text-slate-500 mb-4">
            Record the date this 1-2-1 actually happened.
          </p>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Interaction Date
          </label>
          <input
            type="date"
            value={completeDate}
            onChange={(e) => setCompleteDate(e.target.value)}
            className="input-field mb-4"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleComplete}
              disabled={actionLoading}
              className="flex-1 inline-flex items-center justify-center gap-1.5 bg-bni-green-500 text-white rounded-lg px-4 py-2.5 min-h-[44px] text-sm font-semibold hover:bg-bni-green-600 disabled:opacity-50 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" strokeWidth={2.5} />
              {actionLoading ? "Saving..." : "Confirm"}
            </button>
            <button
              type="button"
              onClick={() => setCompleteModal(null)}
              className="flex-1 bg-white text-navy border border-slate-300 rounded-lg px-4 py-2.5 min-h-[44px] text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {/* Exclude Modal */}
      {excludeModal && (
        <Modal
          onClose={() => {
            setExcludeModal(null);
            setExcludeReason("");
          }}
        >
          <h3 className="text-subtitle text-navy mb-1.5">Exclude Pair</h3>
          <p className="text-xs text-slate-500 mb-4">
            This pair won&apos;t be auto-recommended again until reinstated.
          </p>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Reason
          </label>
          <input
            type="text"
            value={excludeReason}
            onChange={(e) => setExcludeReason(e.target.value)}
            className="input-field mb-4"
            placeholder="e.g. Competing businesses"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleExclude}
              disabled={actionLoading || !excludeReason.trim()}
              className="flex-1 inline-flex items-center justify-center gap-1.5 bg-bni-red-500 text-white rounded-lg px-4 py-2.5 min-h-[44px] text-sm font-semibold hover:bg-bni-red-600 disabled:opacity-50 transition-colors"
            >
              <Ban className="w-4 h-4" strokeWidth={2.5} />
              {actionLoading ? "Excluding..." : "Exclude"}
            </button>
            <button
              type="button"
              onClick={() => {
                setExcludeModal(null);
                setExcludeReason("");
              }}
              className="flex-1 bg-white text-navy border border-slate-300 rounded-lg px-4 py-2.5 min-h-[44px] text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </Card>
  );
}

function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
        <div className="bg-white rounded-xl shadow-strong p-5 w-full max-w-sm pointer-events-auto animate-slide-up relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" strokeWidth={2.5} />
          </button>
          {children}
        </div>
      </div>
    </>
  );
}
