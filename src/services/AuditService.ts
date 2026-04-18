import { prisma } from "@/lib/db";
import type { audit_logs } from "@prisma/client";

export type AuditOperation =
  | "CREATE"
  | "UPDATE"
  | "ARCHIVE"
  | "RESTORE"
  | "EXCLUDE"
  | "COMPLETE"
  | "LOGIN";

export type AuditSource = "UI" | "API" | "SCHEDULER" | "WEBHOOK";

export interface AuditEntry {
  entityType: string;
  entityId: string;
  operation: AuditOperation;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  actorId: string;
  actorRole: string;
  source: AuditSource;
}

export interface AuditLogFilters {
  entityType?: string;
  entityId?: string;
  actorId?: string;
  fromDate?: Date;
  toDate?: Date;
  page?: number;
  pageSize?: number;
}

export class AuditService {
  static async log(entry: AuditEntry): Promise<void> {
    try {
      await prisma.audit_logs.create({
        data: {
          entity_type: entry.entityType,
          entity_id: entry.entityId,
          operation: entry.operation,
          field_name: entry.fieldName ?? null,
          old_value: entry.oldValue ?? null,
          new_value: entry.newValue ?? null,
          actor_id: entry.actorId,
          actor_role: entry.actorRole,
          source: entry.source,
        },
      });
    } catch (err) {
      console.error("AuditService.log failed:", err);
    }
  }

  static async getAuditLogs(
    filters: AuditLogFilters = {}
  ): Promise<{ logs: audit_logs[]; total: number }> {
    const { page = 1, pageSize = 50 } = filters;

    const where: Record<string, unknown> = {};

    if (filters.entityType) where.entity_type = filters.entityType;
    if (filters.entityId) where.entity_id = filters.entityId;
    if (filters.actorId) where.actor_id = filters.actorId;

    if (filters.fromDate || filters.toDate) {
      where.occurred_at = {
        ...(filters.fromDate && { gte: filters.fromDate }),
        ...(filters.toDate && { lte: filters.toDate }),
      };
    }

    const [logs, total] = await Promise.all([
      prisma.audit_logs.findMany({
        where,
        orderBy: { occurred_at: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.audit_logs.count({ where }),
    ]);

    return { logs, total };
  }
}
