import { prisma } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";
import { orderByFrom, skipTake, type ColumnDef, type ListParams, type PagedResult } from "@/components/data-table/types";

function where(session: AppSession, p: ListParams) {
  const w: Record<string, unknown> = { OR: [{ companyId: session.companyId }, { companyId: null, user: { companies: { some: { companyId: session.companyId } } } }] };
  if (p.q) w.AND = [{ OR: [{ entity: { contains: p.q, mode: "insensitive" } }, { entityId: { contains: p.q } }, { user: { email: { contains: p.q, mode: "insensitive" } } }] }];
  if (p.filters.entity) w.entity = p.filters.entity;
  if (p.filters.action) w.action = p.filters.action;
  if (p.filters.userId) w.userId = p.filters.userId;
  if (p.filters.from || p.filters.to) w.at = { gte: p.filters.from ? new Date(p.filters.from) : undefined, lte: p.filters.to ? new Date(p.filters.to + "T23:59:59Z") : undefined };
  return w;
}

const include = { user: { select: { nameAr: true, nameEn: true, email: true } } };

export async function listAudit(session: AppSession, p: ListParams): Promise<PagedResult<Record<string, unknown>>> {
  const w = where(session, p);
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({ where: w, orderBy: orderByFrom(p.sort, ["at", "entity", "action"], { at: "desc" }), ...skipTake(p), include }),
    prisma.auditLog.count({ where: w }),
  ]);
  return { rows: rows.map(shape), total, page: p.page, pageSize: p.pageSize };
}

export async function allAudit(session: AppSession, p: ListParams) {
  const rows = await prisma.auditLog.findMany({ where: where(session, p), orderBy: { at: "desc" }, take: 10_000, include });
  return rows.map(shape);
}

function shape(r: { diff: unknown; user: { nameAr: string; nameEn: string; email: string } | null } & Record<string, unknown>) {
  const diff = (r.diff ?? {}) as Record<string, { from: unknown; to: unknown }>;
  return { ...r, userNameAr: r.user?.nameAr ?? "system", userNameEn: r.user?.nameEn ?? "system", changedFields: Object.keys(diff).join(", "), changes: Object.entries(diff).map(([f, v]) => `${f}: ${JSON.stringify(v.from)} → ${JSON.stringify(v.to)}`).join("\n") };
}

export async function entityNames(companyId: string) {
  const rows = await prisma.auditLog.findMany({ where: { companyId }, distinct: ["entity"], select: { entity: true }, orderBy: { entity: "asc" } });
  return rows.map((r) => r.entity);
}

/** History for one record (used by document pages). */
export async function entityHistory(companyId: string, entity: string, entityId: string) {
  return prisma.auditLog.findMany({ where: { companyId, entity, entityId }, orderBy: { at: "desc" }, include, take: 100 });
}

export function auditColumns(tf: (k: string) => string): ColumnDef[] {
  return [
    { key: "at", label: tf("at"), type: "datetime", sortable: true },
    { key: "userName", label: tf("user"), bilingual: "userName" },
    { key: "action", label: tf("action"), type: "enum", enumName: "AuditAction", tones: { CREATE: "success", UPDATE: "info", DELETE: "destructive", LOGIN: "secondary", APPROVE: "success", REJECT: "destructive", POST: "info", REVERSE: "warning" } },
    { key: "entity", label: tf("entity"), sortable: true },
    { key: "entityId", label: "ID", hidden: true },
    { key: "changedFields", label: tf("changes") },
    { key: "changes", label: tf("oldValue") + " → " + tf("newValue"), hidden: true },
    { key: "ip", label: tf("ip"), hidden: true },
  ];
}
