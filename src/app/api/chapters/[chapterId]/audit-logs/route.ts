import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth";
import { withErrorHandling, ok } from "@/lib/apiResponse";
import { AppError } from "@/lib/AppError";
import { AuditService } from "@/services/AuditService";

const LT_ROLES = ["ADMIN", "PRESIDENT", "VP", "SECRETARY", "TREASURER"];

function buildFilters(url: URL) {
  return {
    entityType: url.searchParams.get("entityType") ?? undefined,
    entityId: url.searchParams.get("entityId") ?? undefined,
    actorId: url.searchParams.get("actorId") ?? undefined,
    fromDate: url.searchParams.get("fromDate")
      ? new Date(url.searchParams.get("fromDate")!)
      : undefined,
    toDate: url.searchParams.get("toDate")
      ? new Date(url.searchParams.get("toDate")!)
      : undefined,
    page: url.searchParams.get("page")
      ? Number(url.searchParams.get("page"))
      : undefined,
    pageSize: url.searchParams.get("pageSize")
      ? Number(url.searchParams.get("pageSize"))
      : undefined,
  };
}

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// GET /api/chapters/[chapterId]/audit-logs
export const GET = withErrorHandling(
  async (req: Request, { params }: { params: Record<string, string> }) => {
    const actor = await requireAuth(req);
    requireRole(actor, LT_ROLES);
    if (actor.chapterId !== params.chapterId) {
      throw new AppError("FORBIDDEN", 403);
    }

    const url = new URL(req.url);
    const format = url.searchParams.get("format");
    const filters = buildFilters(url);

    // CSV export: fetch all matching records (no pagination)
    if (format === "csv") {
      const { logs } = await AuditService.getAuditLogs({
        ...filters,
        page: 1,
        pageSize: 10000,
      });

      const header = "Date/Time,Entity Type,Entity ID,Operation,Field,Old Value,New Value,Actor ID,Actor Role,Source";
      const rows = logs.map((l) =>
        [
          l.occurred_at.toISOString(),
          l.entity_type,
          l.entity_id,
          l.operation,
          l.field_name ?? "",
          l.old_value ?? "",
          l.new_value ?? "",
          l.actor_id,
          l.actor_role,
          l.source,
        ]
          .map((v) => escapeCsvField(String(v)))
          .join(",")
      );

      const csv = [header, ...rows].join("\n");

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="audit-log.csv"`,
        },
      });
    }

    // JSON response with pagination
    const result = await AuditService.getAuditLogs(filters);
    return ok(result.logs, { total: result.total, page: filters.page ?? 1 });
  }
);
