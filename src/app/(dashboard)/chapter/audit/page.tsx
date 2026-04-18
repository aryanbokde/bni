import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { getServerSession } from "@/lib/serverSession";
import { AuditService } from "@/services/AuditService";
import AuditFilters from "@/components/ui/AuditFilters";
import AuditPagination from "@/components/ui/AuditPagination";
import ExportButton from "@/components/ui/ExportButton";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";

const PAGE_SIZE = 20;

interface Props {
  searchParams: {
    entityType?: string;
    fromDate?: string;
    toDate?: string;
    page?: string;
  };
}

function truncate(value: string | null, max: number): string {
  if (!value) return "—";
  return value.length > max ? value.slice(0, max) + "..." : value;
}

const OP_VARIANTS: Record<
  string,
  "green" | "blue" | "red" | "amber" | "neutral"
> = {
  CREATE: "green",
  UPDATE: "blue",
  ARCHIVE: "red",
  RESTORE: "green",
  EXCLUDE: "amber",
  COMPLETE: "green",
};

export default async function AuditPage({ searchParams }: Props) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const page = Number(searchParams.page) || 1;

  const { logs, total } = await AuditService.getAuditLogs({
    entityType: searchParams.entityType || undefined,
    fromDate: searchParams.fromDate
      ? new Date(searchParams.fromDate)
      : undefined,
    toDate: searchParams.toDate
      ? new Date(searchParams.toDate + "T23:59:59")
      : undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ═══════ Header ═══════ */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-headline text-navy">Audit Log</h1>
          <p className="text-sm text-slate-500 mt-1">
            {total} {total === 1 ? "entry" : "entries"} &middot; All changes
            are tracked and immutable
          </p>
        </div>
        <ExportButton />
      </div>

      {/* ═══════ Filters ═══════ */}
      <Card variant="default">
        <div className="p-4">
          <AuditFilters />
        </div>
      </Card>

      {/* ═══════ Table ═══════ */}
      <Card variant="default" className="overflow-hidden">
        {logs.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-6 h-6" />}
            title="No audit entries"
            description="Try adjusting your filters or date range."
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="py-3 px-4 text-left font-semibold text-[0.6875rem] uppercase tracking-wider text-slate-500">
                      When
                    </th>
                    <th className="py-3 px-3 text-left font-semibold text-[0.6875rem] uppercase tracking-wider text-slate-500">
                      Entity
                    </th>
                    <th className="py-3 px-3 text-left font-semibold text-[0.6875rem] uppercase tracking-wider text-slate-500">
                      Operation
                    </th>
                    <th className="py-3 px-3 text-left font-semibold text-[0.6875rem] uppercase tracking-wider text-slate-500">
                      Field
                    </th>
                    <th className="py-3 px-3 text-left font-semibold text-[0.6875rem] uppercase tracking-wider text-slate-500">
                      Old Value
                    </th>
                    <th className="py-3 px-3 text-left font-semibold text-[0.6875rem] uppercase tracking-wider text-slate-500">
                      New Value
                    </th>
                    <th className="py-3 px-3 text-left font-semibold text-[0.6875rem] uppercase tracking-wider text-slate-500">
                      Actor
                    </th>
                    <th className="py-3 px-4 text-left font-semibold text-[0.6875rem] uppercase tracking-wider text-slate-500">
                      Source
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr
                      key={log.log_id.toString()}
                      className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                        {new Date(log.occurred_at).toLocaleString("en-IN", {
                          timeZone: "Asia/Kolkata",
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-xs font-semibold text-navy capitalize">
                          {log.entity_type.replace(/_/g, " ")}
                        </div>
                        <div className="text-[0.6875rem] text-slate-400 font-mono">
                          {log.entity_id.slice(0, 8)}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <Badge
                          variant={OP_VARIANTS[log.operation] ?? "neutral"}
                          size="sm"
                        >
                          {log.operation}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-600">
                        {log.field_name ?? "—"}
                      </td>
                      <td
                        className="py-3 px-3 text-xs text-slate-500 max-w-[160px]"
                        title={log.old_value ?? ""}
                      >
                        {truncate(log.old_value, 40)}
                      </td>
                      <td
                        className="py-3 px-3 text-xs text-slate-500 max-w-[160px]"
                        title={log.new_value ?? ""}
                      >
                        {truncate(log.new_value, 40)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-[0.6875rem] text-slate-400 font-mono">
                          {log.actor_id.slice(0, 8)}
                        </div>
                        <div className="text-xs text-slate-600 font-medium">
                          {log.actor_role}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="neutral" size="sm">
                          {log.source}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2.5 p-3">
              {logs.map((log) => (
                <div
                  key={log.log_id.toString()}
                  className="bg-white rounded-xl border border-slate-100 shadow-soft p-3.5"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge
                          variant={OP_VARIANTS[log.operation] ?? "neutral"}
                          size="sm"
                        >
                          {log.operation}
                        </Badge>
                        <span className="text-xs font-semibold text-navy capitalize">
                          {log.entity_type.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="text-[0.6875rem] text-slate-400 mt-1">
                        {new Date(log.occurred_at).toLocaleString("en-IN", {
                          timeZone: "Asia/Kolkata",
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {" · "}
                        {log.actor_role}
                      </div>
                    </div>
                    <Badge variant="neutral" size="sm">
                      {log.source}
                    </Badge>
                  </div>
                  {log.field_name && (
                    <div className="text-xs text-slate-600 pt-2 border-t border-slate-100 space-y-0.5">
                      <div>
                        <span className="text-slate-400">Field: </span>
                        <span className="font-semibold">{log.field_name}</span>
                      </div>
                      {log.old_value && (
                        <div className="truncate">
                          <span className="text-slate-400">Old: </span>
                          <span>{truncate(log.old_value, 40)}</span>
                        </div>
                      )}
                      {log.new_value && (
                        <div className="truncate">
                          <span className="text-slate-400">New: </span>
                          <span>{truncate(log.new_value, 40)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* ═══════ Pagination ═══════ */}
      {totalPages > 1 && (
        <AuditPagination currentPage={page} totalPages={totalPages} />
      )}
    </div>
  );
}
