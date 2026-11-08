import { prisma } from "@/lib/prisma";
import { can, type AppSession } from "@/core/auth/session";
import { ALLOWED_MIME, MAX_FILE_BYTES, buildStorageKey, sha256, storage } from "@/core/attachments/storage";
import { orderByFrom, skipTake, type ColumnDef, type ListParams, type PagedResult } from "@/components/data-table/types";

/** Who may open a file is decided by the record it is attached to, so an employee's scanned Iqama stays with HR. */
const ENTITY_VIEW_PERMISSION: Record<string, string> = {
  CustomerInvoice: "finance.invoice:view", Receipt: "finance.receipt:view", VendorBill: "finance.bill:view", Payment: "finance.payment:view",
  JournalEntry: "finance.journal:view", FixedAsset: "finance.asset:view", Employee: "hr.employee:view",
  PurchaseRequest: "purchasing.request:view", Rfq: "purchasing.rfq:view", PurchaseOrder: "purchasing.order:view",
  Opportunity: "sales.opportunity:view", Quotation: "sales.quotation:view", SalesOrder: "sales.order:view",
};
function mayAccessEntity(session: AppSession, entityType: string) {
  return can(session, ENTITY_VIEW_PERMISSION[entityType] ?? "foundation.attachment:view");
}

export async function uploadAttachment(session: AppSession, input: { entityType: string; entityId: string; file: File; description?: string }) {
  if (!mayAccessEntity(session, input.entityType)) throw new Error("FORBIDDEN");
  if (!ALLOWED_MIME.has(input.file.type) || input.file.size > MAX_FILE_BYTES || input.file.size === 0) throw new Error("INVALID_FILE");
  const buf = Buffer.from(await input.file.arrayBuffer());
  const key = buildStorageKey(session.companyId, input.entityType, input.file.name);
  await storage.put(key, buf, input.file.type);
  return prisma.attachment.create({
    data: {
      companyId: session.companyId,
      entityType: input.entityType,
      entityId: input.entityId,
      fileName: input.file.name.slice(0, 200),
      mimeType: input.file.type,
      size: input.file.size,
      storageKey: key,
      sha256: sha256(buf),
      description: input.description,
      uploadedById: session.userId,
    },
  });
}

export async function listForEntity(companyId: string, entityType: string, entityId: string) {
  return prisma.attachment.findMany({ where: { companyId, entityType, entityId }, orderBy: { createdAt: "desc" }, include: { } });
}

export async function getAttachment(session: AppSession, id: string) {
  const a = await prisma.attachment.findFirst({ where: { id, companyId: session.companyId } });
  if (!a || !mayAccessEntity(session, a.entityType)) throw new Error("NOT_FOUND");
  return { meta: a, data: await storage.get(a.storageKey) };
}

export async function removeAttachment(session: AppSession, id: string) {
  const a = await prisma.attachment.findFirst({ where: { id, companyId: session.companyId } });
  if (!a || !mayAccessEntity(session, a.entityType)) throw new Error("NOT_FOUND");
  return prisma.attachment.delete({ where: { id } });
}

export async function listAttachments(session: AppSession, p: ListParams): Promise<PagedResult<Record<string, unknown>>> {
  const where: Record<string, unknown> = { companyId: session.companyId };
  if (!session.permissions.has("*")) where.AND = [{ entityType: { in: Object.keys(ENTITY_VIEW_PERMISSION).filter((t) => mayAccessEntity(session, t)) } }];
  if (p.q) where.OR = [{ fileName: { contains: p.q, mode: "insensitive" } }, { entityType: { contains: p.q, mode: "insensitive" } }, { description: { contains: p.q, mode: "insensitive" } }];
  if (p.filters.entityType) where.entityType = p.filters.entityType;
  const [rows, total] = await Promise.all([
    prisma.attachment.findMany({ where, orderBy: orderByFrom(p.sort, ["createdAt", "fileName", "size", "entityType"], { createdAt: "desc" }), ...skipTake(p) }),
    prisma.attachment.count({ where }),
  ]);
  const userIds = [...new Set(rows.map((r) => r.uploadedById).filter(Boolean))] as string[];
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, nameAr: true, nameEn: true } });
  return {
    rows: rows.map((r) => ({ ...r, uploaderAr: users.find((u) => u.id === r.uploadedById)?.nameAr ?? "", uploaderEn: users.find((u) => u.id === r.uploadedById)?.nameEn ?? "", sizeKb: Math.round(r.size / 1024) })),
    total,
    page: p.page,
    pageSize: p.pageSize,
  };
}

export function attachmentColumns(tf: (k: string) => string): ColumnDef[] {
  return [
    { key: "fileName", label: tf("fileName"), type: "link", hrefTemplate: "/api/attachments/{id}", sortable: true },
    { key: "entityType", label: tf("entity"), sortable: true },
    { key: "entityId", label: "ID", hidden: true },
    { key: "description", label: tf("description") },
    { key: "sizeKb", label: tf("size") + " (KB)", type: "number", align: "end", sortable: true },
    { key: "uploader", label: tf("uploadedBy"), bilingual: "uploader" },
    { key: "createdAt", label: tf("createdAt"), type: "datetime", sortable: true },
  ];
}
