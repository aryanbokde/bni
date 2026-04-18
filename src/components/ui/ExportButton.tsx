"use client";

import { useSearchParams } from "next/navigation";
import { useSession } from "@/lib/SessionContext";
import { useAccessToken } from "@/lib/TokenProvider";

export default function ExportButton() {
  const searchParams = useSearchParams();
  const { session } = useSession();
  const accessToken = useAccessToken();

  async function handleExport() {
    if (!session || !accessToken) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set("format", "csv");

    const res = await fetch(
      `/api/chapters/${session.chapterId}/audit-logs?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) return;

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button onClick={handleExport} className="btn-secondary text-sm">
      Export CSV
    </button>
  );
}
