"use client";

import { useQuery } from "@tanstack/react-query";
import { Sparkles, CheckCircle2, Ban, AlertCircle } from "lucide-react";
import { useSession } from "@/lib/SessionContext";
import { useApi } from "@/hooks/useApi";
import RecommendationTable from "@/components/recommendations/RecommendationTable";
import RunCycleButton from "@/components/recommendations/RunCycleButton";
import RecentRuns from "@/components/recommendations/RecentRuns";
import Card from "@/components/ui/Card";

const LT_ROLES = ["ADMIN", "PRESIDENT", "VP", "SECRETARY", "TREASURER"];

interface RecStats {
  sent: number;
  completed: number;
  expired: number;
  excluded: number;
}

export default function RecommendationsPage() {
  const { session } = useSession();
  const api = useApi();

  // Fetch stats
  const { data: stats } = useQuery<RecStats>({
    queryKey: ["recStats", session?.chapterId],
    queryFn: async () => {
      if (!session) throw new Error("no session");
      const [sentRes, completedRes, expiredRes, excludedRes] =
        await Promise.all([
          api.get(
            `/chapters/${session.chapterId}/recommendations?status=SENT&pageSize=1`
          ),
          api.get(
            `/chapters/${session.chapterId}/recommendations?status=COMPLETED&pageSize=1`
          ),
          api.get(
            `/chapters/${session.chapterId}/recommendations?status=EXPIRED&pageSize=1`
          ),
          api.get(
            `/chapters/${session.chapterId}/recommendations?status=EXCLUDED&pageSize=1`
          ),
        ]);
      return {
        sent: sentRes.data.meta?.total ?? 0,
        completed: completedRes.data.meta?.total ?? 0,
        expired: expiredRes.data.meta?.total ?? 0,
        excluded: excludedRes.data.meta?.total ?? 0,
      };
    },
    enabled: !!session,
    staleTime: 30_000,
  });

  // Fetch member names for the table
  const { data: memberNames = {} } = useQuery<Record<string, string>>({
    queryKey: ["memberNames", session?.chapterId],
    queryFn: async () => {
      if (!session) throw new Error("no session");
      const res = await api.get(
        `/chapters/${session.chapterId}/members?pageSize=200`
      );
      const members = res.data.data ?? [];
      const map: Record<string, string> = {};
      for (const m of members) {
        map[m.member_id] = m.full_name;
      }
      return map;
    },
    enabled: !!session,
    staleTime: 60_000,
  });

  if (!session) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="h-8 w-56 shimmer rounded-lg" />
        <div className="h-5 w-72 shimmer rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 shimmer rounded-xl" />
          ))}
        </div>
        <div className="h-96 shimmer rounded-xl" />
      </div>
    );
  }

  const isLT = LT_ROLES.includes(session.role);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ═══════ Header ═══════ */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-headline text-navy">
            {isLT ? "Recommendations" : "My Recommendations"}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isLT
              ? "Manage 1-2-1 pairings and WhatsApp messages"
              : "Your 1-2-1 pairings and history"}
          </p>
        </div>
        {isLT && <RunCycleButton chapterId={session.chapterId} />}
      </div>

      {/* ═══════ Stats Cards ═══════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard
          label="Sent"
          value={stats?.sent ?? 0}
          icon={<Sparkles className="w-5 h-5" strokeWidth={2.2} />}
          accent="amber"
        />
        <StatCard
          label="Completed"
          value={stats?.completed ?? 0}
          icon={<CheckCircle2 className="w-5 h-5" strokeWidth={2.2} />}
          accent="green"
        />
        <StatCard
          label="Expired"
          value={stats?.expired ?? 0}
          icon={<AlertCircle className="w-5 h-5" strokeWidth={2.2} />}
          accent="red"
        />
        <StatCard
          label="Excluded"
          value={stats?.excluded ?? 0}
          icon={<Ban className="w-5 h-5" strokeWidth={2.2} />}
          accent="blue"
        />
      </div>

      {/* ═══════ Table ═══════ */}
      <RecommendationTable
        chapterId={session.chapterId}
        memberNames={memberNames}
      />

      {/* ═══════ Recent Runs (LT only) ═══════ */}
      {isLT && <RecentRuns chapterId={session.chapterId} />}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: "amber" | "green" | "red" | "blue";
}) {
  const accentMap = {
    amber: {
      gradient: "from-bni-amber-50 to-white",
      iconBg: "bg-bni-amber-100 text-bni-amber-600",
    },
    green: {
      gradient: "from-bni-green-50 to-white",
      iconBg: "bg-bni-green-100 text-bni-green-600",
    },
    red: {
      gradient: "from-bni-red-50 to-white",
      iconBg: "bg-bni-red-100 text-bni-red-600",
    },
    blue: {
      gradient: "from-bni-blue-50 to-white",
      iconBg: "bg-bni-blue-100 text-bni-blue-600",
    },
  }[accent];

  return (
    <Card variant="default" className={`bg-gradient-to-br ${accentMap.gradient}`}>
      <div className="p-4 lg:p-5">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${accentMap.iconBg}`}
        >
          {icon}
        </div>
        <div className="text-3xl font-bold text-navy leading-none mb-1">
          {value}
        </div>
        <div className="text-xs font-medium text-slate-500">{label}</div>
      </div>
    </Card>
  );
}
