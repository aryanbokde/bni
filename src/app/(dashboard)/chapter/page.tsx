import { redirect } from "next/navigation";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import {
  Users,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  MapPin,
  Mail,
  PlayCircle,
  Download,
  UserPlus,
  Clock,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import { getServerSession } from "@/lib/serverSession";
import { prisma } from "@/lib/db";
import * as MatrixService from "@/services/MatrixService";
import { decryptMember } from "@/services/memberHelpers";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import EmptyState from "@/components/ui/EmptyState";

const LT_ROLES = ["ADMIN", "PRESIDENT", "VP", "SECRETARY", "TREASURER"];

const TRIGGER_VARIANTS: Record<
  string,
  "blue" | "amber" | "purple" | "neutral"
> = {
  SCHEDULED: "blue",
  POST_MEETING: "amber",
  MANUAL: "purple",
};

const RUN_STATUS_VARIANTS: Record<string, "green" | "amber" | "red"> = {
  COMPLETED: "green",
  RUNNING: "amber",
  FAILED: "red",
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function weekNumber(d: Date): number {
  const copy = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  return Math.ceil(((copy.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export default async function DashboardPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!LT_ROLES.includes(session.role)) redirect("/chapter/members");

  const chapterId = session.chapterId;
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const eightWeeksAgo = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000);

  // If the database was dropped/reset while stale session cookies still exist,
  // redirect to login instead of throwing repeated Prisma table-missing errors.
  let chapter: {
    chapter_name: string;
    rec_expiry_days: number;
    meeting_day: number;
  };
  try {
    chapter = await prisma.chapters.findUniqueOrThrow({
      where: { chapter_id: chapterId },
      select: {
        chapter_name: true,
        rec_expiry_days: true,
        meeting_day: true,
      },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2021"
    ) {
      redirect("/login");
    }
    throw err;
  }

  const expiryWarningCutoff = new Date(
    Date.now() - (chapter.rec_expiry_days - 7) * 24 * 60 * 60 * 1000
  );

  // Fetch all data in parallel
  const [
    selfMember,
    totalActiveMembers,
    sentThisWeek,
    completedThisWeek,
    sentLastWeek,
    completedLastWeek,
    activeMembers,
    geocodeResolved,
    geocodePending,
    geocodeFailed,
    openSentRecs,
    expiringRecs,
    recentRuns,
    allInteractionsLast8Weeks,
  ] = await Promise.all([
    prisma.members.findUnique({
      where: { member_id: session.memberId },
    }),
    prisma.members.count({
      where: { chapter_id: chapterId, status: "ACTIVE" },
    }),
    prisma.recommendations.count({
      where: {
        chapter_id: chapterId,
        status: "SENT",
        sent_at: { gte: oneWeekAgo },
      },
    }),
    prisma.recommendations.count({
      where: {
        chapter_id: chapterId,
        status: "COMPLETED",
        completed_at: { gte: oneWeekAgo },
      },
    }),
    prisma.recommendations.count({
      where: {
        chapter_id: chapterId,
        status: "SENT",
        sent_at: { gte: twoWeeksAgo, lt: oneWeekAgo },
      },
    }),
    prisma.recommendations.count({
      where: {
        chapter_id: chapterId,
        status: "COMPLETED",
        completed_at: { gte: twoWeeksAgo, lt: oneWeekAgo },
      },
    }),
    prisma.members.findMany({
      where: { chapter_id: chapterId, status: "ACTIVE" },
      select: { member_id: true, full_name: true },
    }),
    prisma.members.count({
      where: {
        chapter_id: chapterId,
        status: "ACTIVE",
        geocode_status: "RESOLVED",
      },
    }),
    prisma.members.count({
      where: {
        chapter_id: chapterId,
        status: "ACTIVE",
        geocode_status: "PENDING",
      },
    }),
    prisma.members.count({
      where: {
        chapter_id: chapterId,
        status: "ACTIVE",
        geocode_status: "FAILED",
      },
    }),
    prisma.recommendations.count({
      where: { chapter_id: chapterId, status: "SENT" },
    }),
    prisma.recommendations.count({
      where: {
        chapter_id: chapterId,
        status: "SENT",
        sent_at: { lt: expiryWarningCutoff },
      },
    }),
    prisma.recommendation_runs.findMany({
      where: { chapter_id: chapterId },
      orderBy: { started_at: "desc" },
      take: 5,
    }),
    prisma.member_interactions.findMany({
      where: {
        chapter_id: chapterId,
        interaction_date: { gte: eightWeeksAgo },
      },
      select: { interaction_date: true },
    }),
  ]);

  const displayName = selfMember?.full_name?.split(" ")[0] ?? "there";

  // Coverage calculation
  const coverageResults = await Promise.all(
    activeMembers.map((m) =>
      MatrixService.getMemberCoverage(m.member_id, chapterId, 180).then(
        (cov) => ({
          memberId: m.member_id,
          name: m.full_name,
          pct: cov.coveragePct,
          lastDate: cov.lastInteractionDate,
        })
      )
    )
  );

  const lowCoverage = coverageResults
    .filter((c) => c.pct < 30)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 5);

  const avgCoverage =
    coverageResults.length > 0
      ? Math.round(
          coverageResults.reduce((sum, c) => sum + c.pct, 0) /
            coverageResults.length
        )
      : 0;

  // Chapter health score (0-100) — weighted blend
  const completionRate =
    sentThisWeek + completedThisWeek > 0
      ? (completedThisWeek / (sentThisWeek + completedThisWeek)) * 100
      : 0;
  const geocodeRate =
    totalActiveMembers > 0 ? (geocodeResolved / totalActiveMembers) * 100 : 0;
  const healthScore = Math.round(
    avgCoverage * 0.5 + completionRate * 0.3 + geocodeRate * 0.2
  );

  // Trends (this week vs last week)
  const sentTrend = sentThisWeek - sentLastWeek;
  const completedTrend = completedThisWeek - completedLastWeek;

  // Weekly chart — bucket interactions by ISO week
  const weekBuckets = new Array(8).fill(0);
  for (const ix of allInteractionsLast8Weeks) {
    const diffMs = now.getTime() - new Date(ix.interaction_date).getTime();
    const weekIdx = 7 - Math.min(7, Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)));
    if (weekIdx >= 0 && weekIdx < 8) weekBuckets[weekIdx]++;
  }
  const maxWeekly = Math.max(...weekBuckets, 1);

  const dateStr = now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const wkNum = weekNumber(now);

  // Decrypt self member name for Avatar (fallback to first-word)
  const fullName = selfMember
    ? decryptMember(selfMember).full_name
    : displayName;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ═══════ Row 1: Personalized Hero ═══════ */}
      <section>
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="flex items-center gap-4">
            <Avatar name={fullName} size="lg" />
            <div>
              <h1 className="text-title text-navy">
                {greeting()}, {displayName}
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {dateStr} &middot; Week {wkNum} &middot; {chapter.chapter_name}
              </p>
            </div>
          </div>

          {/* Chapter Health Score */}
          <Card variant="default" className="px-5 py-3.5 min-w-[180px]">
            <div className="flex items-center gap-3">
              <div
                className={`
                  w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg
                  ${
                    healthScore >= 70
                      ? "bg-bni-green-50 text-bni-green-600"
                      : healthScore >= 40
                      ? "bg-bni-amber-50 text-bni-amber-600"
                      : "bg-bni-red-50 text-bni-red-600"
                  }
                `}
              >
                {healthScore}
              </div>
              <div>
                <div className="text-[0.6875rem] text-slate-500 uppercase tracking-wider font-semibold">
                  Chapter Health
                </div>
                <div className="text-sm font-bold text-navy">
                  {healthScore >= 70
                    ? "Excellent"
                    : healthScore >= 40
                    ? "Good"
                    : "Needs attention"}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* ═══════ Row 2: KPI Stats (4 cards) ═══════ */}
      <section>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 overflow-x-auto lg:overflow-visible">
          <KpiCard
            href="/chapter/members"
            label="Active Members"
            value={totalActiveMembers}
            icon={<Users className="w-5 h-5" strokeWidth={2.2} />}
            accent="navy"
          />
          <KpiCard
            href="/chapter/recommendations"
            label="Sent This Week"
            value={sentThisWeek}
            trend={sentTrend}
            icon={<Sparkles className="w-5 h-5" strokeWidth={2.2} />}
            accent="blue"
          />
          <KpiCard
            href="/chapter/recommendations?status=COMPLETED"
            label="Completed"
            value={completedThisWeek}
            trend={completedTrend}
            icon={<CheckCircle2 className="w-5 h-5" strokeWidth={2.2} />}
            accent="green"
          />
          <KpiCard
            href="/chapter/matrix"
            label="Avg Coverage"
            value={`${avgCoverage}%`}
            icon={<TrendingUp className="w-5 h-5" strokeWidth={2.2} />}
            accent="amber"
          />
        </div>
      </section>

      {/* ═══════ Row 3: Activity Chart ═══════ */}
      <Card variant="default">
        <div className="p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-subtitle text-navy">1-2-1 Activity</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Completed meetings over the last 8 weeks
              </p>
            </div>
            <Badge variant="blue">Last 8 weeks</Badge>
          </div>

          {weekBuckets.every((b) => b === 0) ? (
            <div className="py-8">
              <EmptyState
                icon={<TrendingUp className="w-6 h-6" />}
                title="No activity yet"
                description="Run your first recommendation cycle to get started."
              />
            </div>
          ) : (
            <ActivityChart weekBuckets={weekBuckets} maxWeekly={maxWeekly} />
          )}
        </div>
      </Card>

      {/* ═══════ Row 4: Low Coverage + Recent Runs ═══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Members Needing Attention */}
        <Card variant="default">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-bni-amber-50 flex items-center justify-center text-bni-amber-600">
                  <AlertTriangle className="w-4 h-4" strokeWidth={2.5} />
                </div>
                <h2 className="text-subtitle text-navy">
                  Members Needing Attention
                </h2>
              </div>
              {lowCoverage.length > 0 && (
                <Badge variant="amber">{lowCoverage.length}</Badge>
              )}
            </div>

            {lowCoverage.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="w-6 h-6" />}
                title="Everyone is engaged!"
                description="All members have 30%+ coverage."
                className="py-6"
              />
            ) : (
              <div className="space-y-2">
                {lowCoverage.map((m) => (
                  <Link
                    key={m.memberId}
                    href={`/chapter/members/${m.memberId}`}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors duration-fast"
                  >
                    <Avatar name={m.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-semibold text-navy truncate">
                          {m.name}
                        </span>
                        <span
                          className={`text-xs font-bold flex-shrink-0 ${
                            m.pct === 0
                              ? "text-bni-red-600"
                              : "text-bni-amber-600"
                          }`}
                        >
                          {m.pct}%
                        </span>
                      </div>
                      <div className="relative h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-slow ${
                            m.pct === 0
                              ? "bg-bni-red-500"
                              : "bg-gradient-to-r from-bni-amber-500 to-bni-amber-600"
                          }`}
                          style={{ width: `${Math.max(m.pct, 3)}%` }}
                        />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Recent Runs Timeline */}
        <Card variant="default">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-bni-blue-50 flex items-center justify-center text-bni-blue-600">
                  <Clock className="w-4 h-4" strokeWidth={2.5} />
                </div>
                <h2 className="text-subtitle text-navy">Recent Runs</h2>
              </div>
              <Link
                href="/chapter/recommendations"
                className="text-xs font-semibold text-bni-blue hover:underline flex items-center gap-0.5"
              >
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {recentRuns.length === 0 ? (
              <EmptyState
                icon={<PlayCircle className="w-6 h-6" />}
                title="No runs yet"
                description="Trigger your first cycle from Recommendations."
                className="py-6"
              />
            ) : (
              <div className="relative pl-4">
                {/* Timeline line */}
                <div
                  className="absolute left-[9px] top-1 bottom-1 w-px bg-slate-200"
                  aria-hidden="true"
                />
                <div className="space-y-4">
                  {recentRuns.slice(0, 4).map((run) => (
                    <div key={run.run_id} className="relative">
                      {/* Dot */}
                      <div
                        className={`absolute -left-[11px] top-0.5 w-3.5 h-3.5 rounded-full ring-4 ring-white ${
                          run.status === "COMPLETED"
                            ? "bg-bni-green-500"
                            : run.status === "RUNNING"
                            ? "bg-bni-amber-500 animate-pulse"
                            : "bg-bni-red-500"
                        }`}
                        aria-hidden="true"
                      />
                      <div className="pl-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant={
                              TRIGGER_VARIANTS[run.trigger_type] ?? "neutral"
                            }
                            size="sm"
                          >
                            {run.trigger_type}
                          </Badge>
                          <Badge
                            variant={
                              RUN_STATUS_VARIANTS[run.status] ?? "neutral"
                            }
                            size="sm"
                          >
                            {run.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                          <span>
                            {new Date(run.started_at).toLocaleDateString(
                              "en-GB",
                              { day: "numeric", month: "short" }
                            )}
                          </span>
                          <span>&middot;</span>
                          <span className="font-semibold text-slate-600">
                            {run.pairs_sent} pairs sent
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ═══════ Row 5: Geocoding + Open Recs + Quick Actions ═══════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Geocoding Ring */}
        <Card variant="default">
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-bni-green-50 flex items-center justify-center text-bni-green-600">
                <MapPin className="w-4 h-4" strokeWidth={2.5} />
              </div>
              <h2 className="text-subtitle text-navy">Geocoding</h2>
            </div>

            <div className="flex items-center gap-5">
              <GeocodingRing
                resolved={geocodeResolved}
                total={totalActiveMembers}
              />
              <div className="flex-1 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <span
                      className="w-2 h-2 rounded-full bg-bni-green-500"
                      aria-hidden="true"
                    />
                    Mapped
                  </span>
                  <span className="font-bold text-navy">{geocodeResolved}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <span
                      className="w-2 h-2 rounded-full bg-bni-amber-500"
                      aria-hidden="true"
                    />
                    Pending
                  </span>
                  <span className="font-bold text-navy">{geocodePending}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <span
                      className="w-2 h-2 rounded-full bg-bni-red-500"
                      aria-hidden="true"
                    />
                    Failed
                  </span>
                  <span className="font-bold text-navy">{geocodeFailed}</span>
                </div>
              </div>
            </div>
            <Link
              href="/chapter/map"
              className="inline-flex items-center gap-1 text-xs font-semibold text-bni-blue hover:underline mt-4"
            >
              View map <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </Card>

        {/* Open Recommendations */}
        <Card variant="default">
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-bni-amber-50 flex items-center justify-center text-bni-amber-600">
                <Mail className="w-4 h-4" strokeWidth={2.5} />
              </div>
              <h2 className="text-subtitle text-navy">Open Recommendations</h2>
            </div>

            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-4xl font-bold text-navy">
                {openSentRecs}
              </span>
              <span className="text-xs text-slate-500">awaiting completion</span>
            </div>

            {expiringRecs > 0 ? (
              <div className="flex items-center gap-2 bg-bni-red-50 text-bni-red-600 px-2.5 py-1.5 rounded-md text-xs font-semibold mt-3">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{expiringRecs} expiring in 7 days</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-3">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>None expiring soon</span>
              </div>
            )}
            <Link
              href="/chapter/recommendations"
              className="inline-flex items-center gap-1 text-xs font-semibold text-bni-blue hover:underline mt-4"
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </Card>

        {/* Quick Actions */}
        <Card variant="default">
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-navy-50 flex items-center justify-center text-navy-700">
                <Calendar className="w-4 h-4" strokeWidth={2.5} />
              </div>
              <h2 className="text-subtitle text-navy">Quick Actions</h2>
            </div>

            <div className="space-y-2">
              <Link
                href="/chapter/recommendations"
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors duration-fast group"
              >
                <div className="w-8 h-8 rounded-md bg-bni-blue-100 flex items-center justify-center text-bni-blue-600">
                  <PlayCircle className="w-4 h-4" strokeWidth={2.5} />
                </div>
                <span className="text-sm font-semibold text-navy flex-1">
                  Run Cycle
                </span>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-bni-blue transition-colors" />
              </Link>
              <Link
                href="/chapter/members/new"
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors duration-fast group"
              >
                <div className="w-8 h-8 rounded-md bg-bni-green-100 flex items-center justify-center text-bni-green-600">
                  <UserPlus className="w-4 h-4" strokeWidth={2.5} />
                </div>
                <span className="text-sm font-semibold text-navy flex-1">
                  Add Member
                </span>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-bni-blue transition-colors" />
              </Link>
              <Link
                href="/chapter/recommendations"
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors duration-fast group"
              >
                <div className="w-8 h-8 rounded-md bg-bni-amber-100 flex items-center justify-center text-bni-amber-600">
                  <Download className="w-4 h-4" strokeWidth={2.5} />
                </div>
                <span className="text-sm font-semibold text-navy flex-1">
                  Export Recs
                </span>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-bni-blue transition-colors" />
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ─────────── KPI Card ─────────── */
function KpiCard({
  href,
  label,
  value,
  icon,
  accent,
  trend,
}: {
  href: string;
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accent: "navy" | "blue" | "green" | "amber";
  trend?: number;
}) {
  const accentMap = {
    navy: "from-navy-50 to-white text-navy-700",
    blue: "from-bni-blue-50 to-white text-bni-blue-700",
    green: "from-bni-green-50 to-white text-bni-green-600",
    amber: "from-bni-amber-50 to-white text-bni-amber-600",
  };

  return (
    <Link
      href={href}
      className={`
        group relative rounded-xl border border-slate-100 bg-gradient-to-br ${accentMap[accent]}
        p-4 lg:p-5 min-w-[180px] shadow-soft hover:shadow-medium
        transition-all duration-normal ease-smooth
      `}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-lg bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-soft ring-1 ring-slate-100">
          {icon}
        </div>
        {trend !== undefined && trend !== 0 && (
          <span
            className={`text-[0.6875rem] font-bold px-1.5 py-0.5 rounded-md ${
              trend > 0
                ? "bg-bni-green-100 text-bni-green-600"
                : "bg-bni-red-100 text-bni-red-600"
            }`}
          >
            {trend > 0 ? "+" : ""}
            {trend}
          </span>
        )}
      </div>
      <div className="text-3xl font-bold text-navy leading-none mb-1">
        {value}
      </div>
      <div className="text-xs font-medium text-slate-500">{label}</div>
    </Link>
  );
}

/* ─────────── Activity Chart (SVG line + area) ─────────── */
function ActivityChart({
  weekBuckets,
  maxWeekly,
}: {
  weekBuckets: number[];
  maxWeekly: number;
}) {
  const w = 800;
  const h = 180;
  const pad = { top: 20, right: 10, bottom: 30, left: 30 };
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;
  const stepX = innerW / (weekBuckets.length - 1);

  const points = weekBuckets.map((v, i) => {
    const x = pad.left + i * stepX;
    const y = pad.top + innerH - (v / maxWeekly) * innerH;
    return { x, y, v };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${
    pad.top + innerH
  } L ${points[0].x} ${pad.top + innerH} Z`;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-auto"
        preserveAspectRatio="none"
        role="img"
        aria-label="Activity chart: 1-2-1s completed per week"
      >
        <defs>
          <linearGradient id="chart-gradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#2E75B6" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#2E75B6" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={pad.left}
            x2={w - pad.right}
            y1={pad.top + innerH * f}
            y2={pad.top + innerH * f}
            stroke="#E2E8F0"
            strokeDasharray="3 3"
          />
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="url(#chart-gradient)" />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="#2E75B6"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill="white" />
            <circle
              cx={p.x}
              cy={p.y}
              r="3.5"
              fill="#2E75B6"
              stroke="white"
              strokeWidth="2"
            />
          </g>
        ))}

        {/* Week labels */}
        {points.map((p, i) => {
          const weeksAgo = 7 - i;
          const label = weeksAgo === 0 ? "Now" : `${weeksAgo}w`;
          return (
            <text
              key={i}
              x={p.x}
              y={h - 10}
              textAnchor="middle"
              fontSize="11"
              fill="#64748B"
              fontWeight="500"
            >
              {label}
            </text>
          );
        })}

        {/* Y-axis max label */}
        <text
          x={pad.left - 6}
          y={pad.top + 4}
          textAnchor="end"
          fontSize="10"
          fill="#94A3B8"
          fontWeight="500"
        >
          {maxWeekly}
        </text>
        <text
          x={pad.left - 6}
          y={pad.top + innerH + 4}
          textAnchor="end"
          fontSize="10"
          fill="#94A3B8"
          fontWeight="500"
        >
          0
        </text>
      </svg>
    </div>
  );
}

/* ─────────── Geocoding Ring (SVG) ─────────── */
function GeocodingRing({
  resolved,
  total,
}: {
  resolved: number;
  total: number;
}) {
  const pct = total > 0 ? (resolved / total) * 100 : 0;
  const r = 40;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className="relative w-24 h-24 flex-shrink-0">
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
          stroke="#2E7D32"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-all duration-slow"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-xl font-bold text-navy leading-none">
          {Math.round(pct)}%
        </div>
        <div className="text-[0.6875rem] text-slate-500 mt-0.5">mapped</div>
      </div>
    </div>
  );
}
