"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

interface Run {
  run_id: string;
  trigger_type: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  pairs_evaluated: number;
  pairs_sent: number;
  pairs_skipped: number;
}

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: "bg-green-100 text-green-700",
  RUNNING: "bg-amber-100 text-amber-700",
  FAILED: "bg-red-100 text-red-600",
};

export default function RecentRuns({ chapterId }: { chapterId: string }) {
  const api = useApi();
  const [open, setOpen] = useState(false);

  const { data: runs = [], isLoading } = useQuery<Run[]>({
    queryKey: ["recentRuns", chapterId],
    queryFn: async () => {
      const res = await api.get(`/chapters/${chapterId}/recommendations/runs`);
      return res.data.data;
    },
    enabled: open,
  });

  return (
    <div className="card">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full"
      >
        <h3 className="text-sm font-medium text-gray-700">Recent Runs</h3>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="mt-3">
          {isLoading ? (
            <div className="h-8 bg-gray-100 rounded animate-pulse" />
          ) : runs.length === 0 ? (
            <p className="text-sm text-gray-400">No runs yet.</p>
          ) : (
            <div className="space-y-2">
              {runs.map((r) => (
                <div key={r.run_id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">{r.trigger_type}</span>
                    <span className="text-gray-400 ml-2">
                      {new Date(r.started_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {r.pairs_sent} sent
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status] ?? "bg-gray-100"}`}>
                      {r.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
