"use client";

import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export default function RunCycleButton({ chapterId }: { chapterId: string }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [showConfirm, setShowConfirm] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function handleRun() {
    setShowConfirm(false);
    setRunning(true);
    setProgress("Starting recommendation cycle...");

    try {
      const res = await api.post(`/chapters/${chapterId}/recommendations/run`, {});
      const run = res.data.data;

      if (run.status === "COMPLETED") {
        setProgress(`Done — ${run.pairs_sent} messages sent`);
        setTimeout(() => { setRunning(false); setProgress(""); }, 3000);
        queryClient.invalidateQueries({ queryKey: ["recommendations", chapterId] });
        queryClient.invalidateQueries({ queryKey: ["recStats", chapterId] });
        queryClient.invalidateQueries({ queryKey: ["recentRuns", chapterId] });
        return;
      }

      // Poll for completion
      setProgress(`Evaluating pairs...`);
      pollRef.current = setInterval(async () => {
        try {
          const pollRes = await api.get(
            `/chapters/${chapterId}/recommendations/runs/${run.run_id}`
          );
          const pollRun = pollRes.data.data;

          if (pollRun.status === "COMPLETED") {
            if (pollRef.current) clearInterval(pollRef.current);
            setProgress(`Done — ${pollRun.pairs_sent} messages sent`);
            setTimeout(() => { setRunning(false); setProgress(""); }, 3000);
            queryClient.invalidateQueries({ queryKey: ["recommendations", chapterId] });
            queryClient.invalidateQueries({ queryKey: ["recStats", chapterId] });
            queryClient.invalidateQueries({ queryKey: ["recentRuns", chapterId] });
          } else if (pollRun.status === "FAILED") {
            if (pollRef.current) clearInterval(pollRef.current);
            setProgress(`Failed: ${pollRun.error_detail ?? "Unknown error"}`);
            setTimeout(() => { setRunning(false); setProgress(""); }, 5000);
          } else {
            setProgress(`Evaluating ${pollRun.pairs_evaluated} pairs...`);
          }
        } catch {
          if (pollRef.current) clearInterval(pollRef.current);
          setProgress("Error checking status");
          setTimeout(() => { setRunning(false); setProgress(""); }, 3000);
        }
      }, 2000);
    } catch {
      setProgress("Failed to start cycle");
      setTimeout(() => { setRunning(false); setProgress(""); }, 3000);
    }
  }

  return (
    <div>
      {running ? (
        <div className="flex items-center gap-3">
          <div className="animate-spin h-4 w-4 border-2 border-bni-blue border-t-transparent rounded-full" />
          <span className="text-sm text-gray-600">{progress}</span>
        </div>
      ) : (
        <button
          onClick={() => setShowConfirm(true)}
          className="btn-primary"
        >
          Run Recommendation Cycle
        </button>
      )}

      {/* Confirmation modal */}
      {showConfirm && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowConfirm(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
              <h3 className="text-lg font-bold text-navy mb-2">Run Recommendation Cycle?</h3>
              <p className="text-sm text-gray-500 mb-4">
                This will evaluate all eligible pairs and send WhatsApp introduction messages. Are you sure?
              </p>
              <div className="flex gap-2">
                <button onClick={handleRun} className="btn-primary flex-1">
                  Yes, Run
                </button>
                <button onClick={() => setShowConfirm(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
