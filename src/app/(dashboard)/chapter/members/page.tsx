import Link from "next/link";
import { redirect } from "next/navigation";
import { UserPlus } from "lucide-react";
import { getServerSession } from "@/lib/serverSession";
import * as MemberService from "@/services/MemberService";
import MemberFilters from "@/components/members/MemberFilters";
import MemberTable from "@/components/members/MemberTable";
import Card from "@/components/ui/Card";

interface Props {
  searchParams: {
    status?: string;
    role?: string;
    search?: string;
  };
}

export default async function MembersPage({ searchParams }: Props) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const filters = {
    status: searchParams.status || "ACTIVE",
    role: searchParams.role || undefined,
    search: searchParams.search || undefined,
  };

  const members = await MemberService.getMembersByChapter(
    session.chapterId,
    filters
  );

  const isAdmin = session.role === "ADMIN";
  const currentMemberId = session.memberId;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ═══════ Header ═══════ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-headline text-navy">Members</h1>
          <p className="text-sm text-slate-500 mt-1">
            {members.length} {members.length === 1 ? "member" : "members"}{" "}
            {filters.status !== "ALL" ? `(${filters.status.toLowerCase()})` : ""}
          </p>
        </div>

        {isAdmin && (
          <Link
            href="/chapter/members/new"
            className="inline-flex items-center justify-center gap-2 bg-navy text-white rounded-lg px-4 py-2.5 min-h-[44px] text-sm font-semibold transition-all duration-normal hover:bg-navy-600 active:bg-navy-800 shadow-soft hover:shadow-medium"
          >
            <UserPlus className="w-4 h-4" strokeWidth={2.5} />
            Add Member
          </Link>
        )}
      </div>

      {/* ═══════ Filters ═══════ */}
      <Card variant="default" className="px-4 py-3">
        <MemberFilters />
      </Card>

      {/* ═══════ Table / Cards ═══════ */}
      <Card variant="default" className="overflow-hidden">
        <MemberTable
          members={JSON.parse(JSON.stringify(members))}
          isAdmin={isAdmin}
          currentMemberId={currentMemberId}
        />
      </Card>
    </div>
  );
}
