import { redirect } from "next/navigation";
import {
  Mail,
  Phone,
  MessageCircle,
  MapPin,
  Calendar,
  Shield,
  Briefcase,
  FileText,
  Clock,
} from "lucide-react";
import { getServerSession } from "@/lib/serverSession";
import * as MemberService from "@/services/MemberService";
import MemberProfileActions from "@/components/members/MemberProfileActions";
import { prisma } from "@/lib/db";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import EmptyState from "@/components/ui/EmptyState";

interface Props {
  params: { memberId: string };
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

export default async function MemberProfilePage({ params }: Props) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  let member;
  try {
    member = await MemberService.getMemberById(
      params.memberId,
      session.chapterId
    );
  } catch {
    redirect("/chapter/members");
  }

  // Fetch last 5 interactions
  const interactions = await prisma.member_interactions.findMany({
    where: {
      OR: [
        { member_a_id: params.memberId },
        { member_b_id: params.memberId },
      ],
    },
    orderBy: { interaction_date: "desc" },
    take: 5,
  });

  // Fetch counterpart names for interaction history
  const otherIds = Array.from(
    new Set(
      interactions.map((ix) =>
        ix.member_a_id === params.memberId ? ix.member_b_id : ix.member_a_id
      )
    )
  );
  const otherMembers = otherIds.length
    ? await prisma.members.findMany({
        where: { member_id: { in: otherIds } },
        select: { member_id: true, full_name: true },
      })
    : [];
  const nameMap = new Map(otherMembers.map((m) => [m.member_id, m.full_name]));

  const serializedMember = JSON.parse(JSON.stringify(member));

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-fade-in">
      {/* ═══════ Hero Section ═══════ */}
      <Card variant="default">
        <div className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            {/* Left: Avatar + name + badges */}
            <div className="flex items-start gap-4 min-w-0 flex-1">
              <Avatar name={member.full_name} size="xl" />
              <div className="min-w-0 flex-1 pt-1">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <h1 className="text-2xl font-bold text-navy truncate">
                    {member.full_name}
                  </h1>
                  <Badge
                    variant={STATUS_VARIANTS[member.status] ?? "neutral"}
                    size="sm"
                  >
                    {member.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant={ROLE_VARIANTS[member.chapter_role] ?? "neutral"}
                    size="sm"
                  >
                    {member.chapter_role}
                  </Badge>
                  <span className="text-sm text-slate-500">
                    {member.biz_category}
                  </span>
                </div>
                {member.one_line_summary && (
                  <p className="text-sm text-slate-600 mt-2 max-w-2xl">
                    {member.one_line_summary}
                  </p>
                )}
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex-shrink-0 sm:pt-1">
              <MemberProfileActions member={serializedMember} />
            </div>
          </div>
        </div>
      </Card>

      {/* ═══════ Content Grid ═══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column — Profile details */}
        <div className="lg:col-span-2 space-y-5">
          {/* Contact Info */}
          <Card variant="default">
            <div className="p-5">
              <h2 className="text-subtitle text-navy mb-4 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-bni-blue-50 flex items-center justify-center text-bni-blue-600">
                  <Phone className="w-4 h-4" strokeWidth={2.5} />
                </div>
                Contact Information
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoField
                  icon={<Mail className="w-4 h-4" />}
                  label="Email"
                  value={member.email}
                />
                <InfoField
                  icon={<Phone className="w-4 h-4" />}
                  label="Mobile"
                  value={member.mobile}
                />
                <InfoField
                  icon={<MessageCircle className="w-4 h-4" />}
                  label="WhatsApp"
                  value={member.whatsapp}
                />
                <InfoField
                  icon={<Calendar className="w-4 h-4" />}
                  label="Joining Date"
                  value={new Date(member.joining_date).toLocaleDateString(
                    "en-GB",
                    { day: "numeric", month: "long", year: "numeric" }
                  )}
                />
              </div>
            </div>
          </Card>

          {/* Business Info */}
          <Card variant="default">
            <div className="p-5">
              <h2 className="text-subtitle text-navy mb-4 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-bni-green-50 flex items-center justify-center text-bni-green-600">
                  <Briefcase className="w-4 h-4" strokeWidth={2.5} />
                </div>
                Business Details
              </h2>
              <div className="space-y-4">
                <InfoField
                  icon={<Briefcase className="w-4 h-4" />}
                  label="Category"
                  value={member.biz_category}
                />
                {member.intro_text && (
                  <InfoField
                    icon={<FileText className="w-4 h-4" />}
                    label="Introduction"
                    value={member.intro_text}
                  />
                )}
                <InfoField
                  icon={<MapPin className="w-4 h-4" />}
                  label="Office Address"
                  value={member.office_address}
                />
              </div>
            </div>
          </Card>

          {/* Interaction History */}
          <Card variant="default">
            <div className="p-5">
              <h2 className="text-subtitle text-navy mb-4 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-bni-amber-50 flex items-center justify-center text-bni-amber-600">
                  <Clock className="w-4 h-4" strokeWidth={2.5} />
                </div>
                Recent 1-2-1 History
              </h2>
              {interactions.length === 0 ? (
                <EmptyState
                  icon={<Clock className="w-6 h-6" />}
                  title="No interactions yet"
                  description="1-2-1 meetings will appear here once recorded."
                  className="py-6"
                />
              ) : (
                <div className="relative pl-4">
                  <div
                    className="absolute left-[9px] top-1 bottom-1 w-px bg-slate-200"
                    aria-hidden="true"
                  />
                  <div className="space-y-4">
                    {interactions.map((ix) => {
                      const otherId =
                        ix.member_a_id === params.memberId
                          ? ix.member_b_id
                          : ix.member_a_id;
                      const otherName =
                        nameMap.get(otherId) ?? `${otherId.slice(0, 8)}...`;
                      return (
                        <div key={ix.interaction_id} className="relative">
                          <div
                            className="absolute -left-[11px] top-0.5 w-3.5 h-3.5 rounded-full bg-bni-green-500 ring-4 ring-white"
                            aria-hidden="true"
                          />
                          <div className="pl-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-navy">
                                with {otherName}
                              </span>
                              <Badge variant="neutral" size="sm">
                                {ix.source}
                              </Badge>
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {new Date(ix.interaction_date).toLocaleDateString(
                                "en-GB",
                                { day: "numeric", month: "long", year: "numeric" }
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right column — Eligibility */}
        <div className="space-y-5">
          <Card variant="default">
            <div className="p-5">
              <h2 className="text-subtitle text-navy mb-4 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-navy-50 flex items-center justify-center text-navy-700">
                  <Shield className="w-4 h-4" strokeWidth={2.5} />
                </div>
                Eligibility
              </h2>
              <div className="space-y-3">
                <EligibilityRow
                  label="Communication Enabled"
                  active={member.comm_eligible}
                />
                <EligibilityRow
                  label="Recommendation Active"
                  active={member.rec_active}
                />
                <div className="pt-3 border-t border-slate-100">
                  <div className="text-xs text-slate-500 mb-1">
                    Geocode Status
                  </div>
                  <Badge
                    variant={
                      member.geocode_status === "RESOLVED"
                        ? "green"
                        : member.geocode_status === "PENDING"
                        ? "amber"
                        : "red"
                    }
                    size="sm"
                  >
                    {member.geocode_status}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoField({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[0.6875rem] uppercase tracking-wider text-slate-400 font-semibold mb-1">
        <span className="text-slate-300">{icon}</span>
        {label}
      </div>
      <div className="text-sm text-navy font-medium break-words">{value}</div>
    </div>
  );
}

function EligibilityRow({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-600">{label}</span>
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${
            active ? "bg-bni-green-500" : "bg-slate-300"
          }`}
          aria-hidden="true"
        />
        <span
          className={`text-xs font-semibold ${
            active ? "text-bni-green-600" : "text-slate-400"
          }`}
        >
          {active ? "Yes" : "No"}
        </span>
      </div>
    </div>
  );
}
