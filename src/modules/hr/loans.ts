/** Employee loans & advances: schedule, approval, disbursement journal, payroll deduction. */
import { z } from "zod";
import { prisma, type Tx } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";
import { orderByFrom, skipTake, type ColumnDef, type ListParams, type PagedResult } from "@/components/data-table/types";
import { nextDocumentNumber } from "@/core/numbering";
import { submitForApproval } from "@/core/approvals/engine";
import { registerApprovalHooks, DOC_LINKS } from "@/modules/foundation/approvals/hooks";
import { postJournal, mappedAccount } from "@/core/posting";
import { D, round } from "@/lib/money";
import { allowedEmployeeIds, scopeEmployee, withEmployee, empName } from "./employees";

export const loanSchema = z.object({ id: z.string().nullable().optional(), employeeId: z.string().nullable().optional(), loanDate: z.string().min(10), amount: z.coerce.number().positive(), installments: z.coerce.number().int().min(1).max(60), firstMonth: z.string().min(7), reason: z.string().max(1000).nullable().optional() });

async function where(session: AppSession, p: ListParams) {
  const w: Record<string, unknown> = { companyId: session.companyId };
  const allowed = await allowedEmployeeIds(session);
  if (allowed) w.employeeId = { in: allowed };
  if (p.filters.employeeId && !allowed) w.employeeId = p.filters.employeeId;
  if (p.filters.status) w.status = p.filters.status;
  if (p.q) w.OR = [{ number: { contains: p.q, mode: "insensitive" } }, { reason: { contains: p.q, mode: "insensitive" } }];
  return w;
}
export async function listLoans(session: AppSession, p: ListParams): Promise<PagedResult<Record<string, unknown>>> {
  const w = await where(session, p);
  const [rows, total] = await Promise.all([prisma.employeeLoan.findMany({ where: w, orderBy: orderByFrom(p.sort, ["number", "loanDate", "amount", "status", "paidAmount"], { loanDate: "desc" }), ...skipTake(p) }), prisma.employeeLoan.count({ where: w })]);
  return { rows: (await withEmployee(session.companyId, rows)).map((r) => ({ ...r, balance: Number(r.amount) - Number(r.paidAmount) })), total, page: p.page, pageSize: p.pageSize };
}
export async function allLoans(session: AppSession, p: ListParams) { return (await withEmployee(session.companyId, await prisma.employeeLoan.findMany({ where: await where(session, p), orderBy: { loanDate: "desc" }, take: 10_000 }))).map((r) => ({ ...r, balance: Number(r.amount) - Number(r.paidAmount) })); }
export async function getLoan(session: AppSession, id: string) {
  const l = await prisma.employeeLoan.findFirst({ where: { id, companyId: session.companyId }, include: { schedule: { orderBy: { dueMonth: "asc" } } } });
  if (!l) return null;
  const allowed = await allowedEmployeeIds(session);
  if (allowed && !allowed.includes(l.employeeId)) return null;
  const [e] = await withEmployee(session.companyId, [l]);
  return e;
}
export async function saveLoan(session: AppSession, input: z.infer<typeof loanSchema>) {
  const employeeId = await scopeEmployee(session, input.employeeId);
  const first = new Date(`${input.firstMonth.slice(0, 7)}-01`);
  const inst = round(D(input.amount).div(input.installments), 2);
  const schedule = Array.from({ length: input.installments }, (_, i) => { const d = new Date(first); d.setUTCMonth(d.getUTCMonth() + i); return { dueMonth: d, amount: i === input.installments - 1 ? round(D(input.amount).minus(inst.times(input.installments - 1)), 2) : inst }; });
  const data = { employeeId, loanDate: new Date(input.loanDate), amount: input.amount, installments: input.installments, installmentAmount: inst, firstMonth: first, reason: input.reason ?? null, updatedById: session.userId };
  return prisma.$transaction(async (tx) => {
    if (input.id) {
      const ex = await tx.employeeLoan.findFirst({ where: { id: input.id, companyId: session.companyId } });
      if (!ex || !["DRAFT"].includes(ex.status)) throw new Error("NOT_DRAFT");
      await tx.loanInstallment.deleteMany({ where: { loanId: input.id } });
      return tx.employeeLoan.update({ where: { id: input.id }, data: { ...data, schedule: { create: schedule } } });
    }
    const number = await nextDocumentNumber(tx, session.companyId, "LOAN", data.loanDate);
    return tx.employeeLoan.create({ data: { ...data, companyId: session.companyId, number, createdById: session.userId, schedule: { create: schedule } } });
  });
}
export async function submitLoan(session: AppSession, id: string) {
  return prisma.$transaction(async (tx) => {
    const l = await tx.employeeLoan.findFirst({ where: { id, companyId: session.companyId } });
    if (!l || l.status !== "DRAFT") throw new Error("NOT_DRAFT");
    await scopeEmployee(session, l.employeeId);
    const req = await submitForApproval(tx, { companyId: session.companyId, docType: "LOAN", docId: l.id, docNumber: l.number, amount: l.amount, requestedById: session.userId, link: `/hr/loans/${l.id}` });
    await tx.employeeLoan.update({ where: { id }, data: { status: req ? "PENDING_APPROVAL" : "APPROVED", updatedById: session.userId } });
    return { status: req ? "PENDING_APPROVAL" : "APPROVED" };
  });
}
/** Disburse: Dr Employee loans Cr Bank/Cash → ACTIVE (deductions start from firstMonth). */
export async function disburseLoan(session: AppSession, id: string, method: "BANK_DEFAULT" | "CASH" = "BANK_DEFAULT") {
  return prisma.$transaction(async (tx) => {
    const l = await tx.employeeLoan.findFirst({ where: { id, companyId: session.companyId } });
    if (!l || l.status !== "APPROVED") throw new Error("INVALID_TRANSITION");
    const emp = await tx.employee.findUniqueOrThrow({ where: { id: l.employeeId } });
    const [loans, bank] = await Promise.all([mappedAccount(tx, session.companyId, "EMPLOYEE_LOANS"), mappedAccount(tx, session.companyId, method)]);
    const n = empName(emp);
    const j = await postJournal(tx, { companyId: session.companyId, branchId: emp.branchId, entryDate: new Date(), description: `Employee loan ${l.number} — ${n.nameEn} / سلفة موظف ${n.nameAr}`, reference: l.number, source: "PAYROLL", sourceType: "EmployeeLoan", sourceId: l.id, userId: session.userId, lines: [
      { accountId: loans, debit: l.amount, partyType: "EMPLOYEE", partyId: emp.id, costCenterId: emp.costCenterId },
      { accountId: bank, credit: l.amount },
    ] });
    return tx.employeeLoan.update({ where: { id }, data: { status: "ACTIVE", journalEntryId: j.id, updatedById: session.userId } });
  });
}
export async function cancelLoan(session: AppSession, id: string) {
  const l = await prisma.employeeLoan.findFirst({ where: { id, companyId: session.companyId } });
  if (!l || !["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(l.status)) throw new Error("INVALID_TRANSITION");
  await prisma.approvalRequest.updateMany({ where: { docType: "LOAN", docId: id, status: "PENDING" }, data: { status: "CANCELLED" } });
  return prisma.employeeLoan.update({ where: { id }, data: { status: "CANCELLED", updatedById: session.userId } });
}
/** Installments due in a month for an employee (ACTIVE loans, unpaid). */
export async function dueInstallments(tx: Tx | typeof prisma, companyId: string, employeeId: string, year: number, month: number) {
  const due = new Date(Date.UTC(year, month - 1, 1));
  return tx.loanInstallment.findMany({ where: { paidAt: null, dueMonth: { lte: due }, loan: { companyId, employeeId, status: "ACTIVE" } }, include: { loan: true } });
}
/** Mark installments paid through a payslip and close loans that are settled. */
export async function settleInstallments(tx: Tx, ids: string[], payslipId: string) {
  if (!ids.length) return;
  const insts = await tx.loanInstallment.findMany({ where: { id: { in: ids } } });
  await tx.loanInstallment.updateMany({ where: { id: { in: ids } }, data: { paidAt: new Date(), payslipId } });
  for (const loanId of new Set(insts.map((i) => i.loanId))) {
    const paid = insts.filter((i) => i.loanId === loanId).reduce((a, i) => a.plus(i.amount), D(0));
    const l = await tx.employeeLoan.update({ where: { id: loanId }, data: { paidAmount: { increment: paid } } });
    if (D(l.paidAmount).gte(l.amount)) await tx.employeeLoan.update({ where: { id: loanId }, data: { status: "PAID" } });
  }
}
export function loanColumns(tf: (k: string) => string, t: (k: string) => string): ColumnDef[] {
  return [
    { key: "number", label: tf("number"), sortable: true, type: "link", hrefTemplate: "/hr/loans/{id}" }, { key: "employee", label: t("employee"), bilingual: "employee" },
    { key: "loanDate", label: tf("date"), type: "date", sortable: true }, { key: "amount", label: tf("amount"), type: "money", align: "end", sortable: true },
    { key: "installments", label: t("installments"), type: "number", align: "center" }, { key: "installmentAmount", label: t("installmentAmount"), type: "money", align: "end" },
    { key: "firstMonth", label: t("firstMonth"), type: "date" }, { key: "paidAmount", label: t("repaid"), type: "money", align: "end" }, { key: "balance", label: t("balance"), type: "money", align: "end" },
    { key: "status", label: tf("status"), type: "enum", enumName: "LoanStatus", tones: { DRAFT: "secondary", PENDING_APPROVAL: "warning", APPROVED: "info", ACTIVE: "success", PAID: "success", CANCELLED: "destructive" } },
  ];
}
registerApprovalHooks("LOAN", {
  onApproved: async (tx, req) => { await tx.employeeLoan.update({ where: { id: req.docId }, data: { status: "APPROVED" } }); },
  onRejected: async (tx, req) => { await tx.employeeLoan.update({ where: { id: req.docId }, data: { status: "DRAFT" } }); },
});
DOC_LINKS.LOAN = (id) => `/hr/loans/${id}`;
