import { prisma } from "@/lib/prisma";
import { can, type AppSession } from "@/core/auth/session";
import { ALLOWED_MIME, MAX_FILE_BYTES, buildStorageKey, sha256, storage } from "@/core/attachments/storage";
import { orderByFrom, skipTake, type ColumnDef, type ListParams, type PagedResult } from "@/components/data-table/types";

/**
 * A file inherits the rights of the record it hangs on: anyone who may view the record may
 * download its files, anyone who may create or edit it may attach to it. `foundation.attachment:*`
 * is an administrator superset that still needs view rights on the record.
 */
const ENTITY_RESOURCE: Record<string, string[]> = {
  CustomerInvoice: ["finance.invoice"], Receipt: ["finance.receipt"], VendorBill: ["finance.bill"], Payment: ["finance.payment"],
  JournalEntry: ["finance.journal"], FixedAsset: ["finance.asset"], PettyCashVoucher: ["finance.pettyCash"], BankStatementLine: ["finance.bank"],
  Customer: ["foundation.customer"], Vendor: ["foundation.vendor"], Item: ["foundation.item"], Employee: ["hr.employee", "foundation.employee"],
  EmployeeContract: ["hr.contract"], EmployeeDocument: ["hr.document"], LeaveRequest: ["hr.leave"], EmployeeLoan: ["hr.loan"], EndOfServiceCalc: ["hr.eosb"], PayrollRun: ["hr.payroll"],
  PurchaseRequest: ["purchasing.request"], Rfq: ["purchasing.rfq"], PurchaseOrder: ["purchasing.order"], VendorContract: ["purchasing.contract"], VendorEvaluation: ["purchasing.evaluation"],
  Lead: ["sales.lead"], Opportunity: ["sales.opportunity"], Quotation: ["sales.quotation"], SalesOrder: ["sales.order"],
};
/** Records an employee may own personally: the personal resource grants rights on their own rows only. */
const OWNED_BY_SELF: Record<string, string> = { LeaveRequest: "hr.self", EmployeeLoan: "hr.self", PurchaseRequest: "purchasing.myRequest" };

export type AttachmentAct = "view" | "upload" | "delete";
export type AttachmentRights = Record<AttachmentAct, boolean>;
const RECORD_ACTIONS: Record<AttachmentAct, string[]> = { view: ["view"], upload: ["create", "edit"], delete: ["edit", "delete"] };
const ADMIN_PERMISSION: Record<AttachmentAct, string> = { view: "foundation.attachment:view", upload: "foundation.attachment:create", delete: "foundation.attachment:delete" };

function companyWide(session: AppSession, entityType: string, act: AttachmentAct) {
  const resources = ENTITY_RESOURCE[entityType];
  if (!resources) return can(session, ADMIN_PERMISSION[act]);
  if (resources.some((r) => RECORD_ACTIONS[act].some((a) => can(session, `${r}:${a}`)))) return true;
  return can(session, ADMIN_PERMISSION[act]) && resources.some((r) => can(session, `${r}:view`));
}
function selfScoped(session: AppSession, entityType: string, act: AttachmentAct) {
  const self = OWNED_BY_SELF[entityType];
  return Boolean(self) && RECORD_ACTIONS[act].some((a) => can(session, `${self}:${a}`));
}
/** Rights for page flags, without looking at a row. Self-service roles get true; ownership is checked again on every upload, download and delete. */
export function attachmentRights(session: AppSession, entityType: string): AttachmentRights {
  const r = (act: AttachmentAct) => companyWide(session, entityType, act) || selfScoped(session, entityType, act);
  return { view: r("view"), upload: r("upload"), delete: r("delete") };
}
async function ownsRow(session: AppSession, entityType: string, entityId: string) {
  const mine = async (employeeId: string | null) => Boolean(employeeId) && (await prisma.employee.count({ where: { id: employeeId as string, userId: session.userId } })) > 0;
  if (entityType === "LeaveRequest") return mine((await prisma.leaveRequest.findFirst({ where: { id: entityId, companyId: session.companyId }, select: { employeeId: true } }))?.employeeId ?? null);
  if (entityType === "EmployeeLoan") return mine((await prisma.employeeLoan.findFirst({ where: { id: entityId, companyId: session.companyId }, select: { employeeId: true } }))?.employeeId ?? null);
  if (entityType === "PurchaseRequest") {
    const row = await prisma.purchaseRequest.findFirst({ where: { id: entityId, companyId: session.companyId }, select: { createdById: true, requesterId: true } });
    if (!row) return false;
    return row.createdById === session.userId || (await mine(row.requesterId));
  }
  return false;
}
async function assertRight(session: AppSession, entityType: string, entityId: string, act: AttachmentAct) {
  if (companyWide(session, entityType, act)) return;
  if (selfScoped(session, entityType, act) && (await ownsRow(session, entityType, entityId))) return;
  throw new Error(act === "view" ? "NOT_FOUND" : "FORBIDDEN");
}

export async function uploadAttachment(session: AppSession, input: { entityType: string; entityId: string; file: File; description?: string }) {
  await assertRight(session, input.entityType, input.entityId, "upload");
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
  return prisma.attachment.findMany({ where: { companyId, entityType, entityId }, orderBy: { createdAt: "desc" } });
}
/** Same list, checked against the caller's rights on the record (used from dialogs). */
export async function listForEntityAs(session: AppSession, entityType: string, entityId: string) {
  await assertRight(session, entityType, entityId, "view");
  return listForEntity(session.companyId, entityType, entityId);
}

export async function getAttachment(session: AppSession, id: string) {
  const a = await prisma.attachment.findFirst({ where: { id, companyId: session.companyId } });
  if (!a) throw new Error("NOT_FOUND");
  await assertRight(session, a.entityType, a.entityId, "view");
  return { meta: a, data: await storage.get(a.storageKey) };
}

export async function removeAttachment(session: AppSession, id: string) {
  const a = await prisma.attachment.findFirst({ where: { id, companyId: session.companyId } });
  if (!a) throw new Error("NOT_FOUND");
  await assertRight(session, a.entityType, a.entityId, "delete");
  await prisma.attachment.delete({ where: { id } });
  await storage.remove(a.storageKey);
  return { id };
}

export async function listAttachments(session: AppSession, p: ListParams): Promise<PagedResult<Record<string, unknown>>> {
  const where: Record<string, unknown> = { companyId: session.companyId };
  if (!session.permissions.has("*")) where.AND = [{ entityType: { in: Object.keys(ENTITY_RESOURCE).filter((t) => companyWide(session, t, "view")) } }];
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
