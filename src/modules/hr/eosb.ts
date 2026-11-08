/** End-of-service settlement: calculation preview (Art. 84/85/111), approval, GL posting and payment. */
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";
import { orderByFrom, skipTake, type ColumnDef, type ListParams, type PagedResult } from "@/components/data-table/types";
import { nextDocumentNumber } from "@/core/numbering";
import { postJournal, mappedAccount, type PostingLine } from "@/core/posting";
import { D, round } from "@/lib/money";
import { computeEosb, serviceYears, dailyWage, type EosReasonCode } from "./rules";
import { getHrSettings } from "./settings";
import { getSalaryStructure, resolveSalary, withEmployee, empName } from "./employees";
import { balancesFor } from "./leave";

import { EOS_REASONS } from "./constants";
export { EOS_REASONS };
export const eosSchema = z.object({ id: z.string().nullable().optional(), employeeId: z.string().min(1), terminationDate: z.string().min(10), reason: z.enum(EOS_REASONS).default("RESIGNATION"), leaveDays: z.coerce.number().min(0).nullable().optional(), otherAdditions: z.coerce.number().min(0).default(0), otherDeductions: z.coerce.number().min(0).default(0), notes: z.string().max(2000).nullable().optional() });

/** Pure-ish preview used by the UI before saving. */
export async function previewEosb(session: AppSession, input: { employeeId: string; terminationDate: string; reason: EosReasonCode; leaveDays?: number | null; otherAdditions?: number; otherDeductions?: number }) {
  const [emp, s, st] = await Promise.all([prisma.employee.findFirst({ where: { id: input.employeeId, companyId: session.companyId } }), getHrSettings(session.companyId), getSalaryStructure(session.companyId, input.employeeId)]);
  if (!emp) throw new Error("NOT_FOUND");
  if (!emp.hireDate) throw new Error("HIRE_DATE_REQUIRED");
  if (!st) throw new Error("NO_SALARY_STRUCTURE");
  const sal = resolveSalary(st);
  const wage = s.eosbWageBasis === "BASIC" ? sal.basic : s.eosbWageBasis === "FULL" ? sal.gross : sal.basic + sal.housing;
  const end = new Date(input.terminationDate);
  const years = serviceYears(emp.hireDate, end);
  const e = computeEosb(years, wage, input.reason);
  const annual = (await balancesFor(session.companyId, emp.id, end.getUTCFullYear())).find((b) => b.leaveType.code === "ANNUAL");
  const leaveDays = input.leaveDays ?? Math.max(0, annual?.remaining ?? 0);
  const leaveEncashment = round(D(dailyWage(wage, s.daysPerMonth)).times(leaveDays), 2); // Art. 111: accrued leave paid at last wage
  const loans = await prisma.employeeLoan.findMany({ where: { companyId: session.companyId, employeeId: emp.id, status: "ACTIVE" } });
  const loanBalance = loans.reduce((a, l) => a.plus(D(l.amount).minus(l.paidAmount)), D(0));
  const add = D(input.otherAdditions ?? 0), ded = D(input.otherDeductions ?? 0);
  const net = round(D(e.amount).plus(leaveEncashment).plus(add).minus(ded).minus(loanBalance), 2);
  return { employee: emp, hireDate: emp.hireDate, serviceYears: round(D(years), 4), monthlyWage: round(D(wage), 2), wageBasis: s.eosbWageBasis, fullEntitlement: e.fullEntitlement, pct: e.pct, eosbAmount: e.amount, leaveDays, leaveEncashment, loanBalance, otherAdditions: add, otherDeductions: ded, netAmount: net };
}
export async function saveEosb(session: AppSession, input: z.infer<typeof eosSchema>) {
  const p = await previewEosb(session, input);
  const data = { employeeId: input.employeeId, terminationDate: new Date(input.terminationDate), reason: input.reason, serviceYears: p.serviceYears, monthlyWage: p.monthlyWage, fullEntitlement: p.fullEntitlement, eosbPct: p.pct, eosbAmount: p.eosbAmount, leaveDays: p.leaveDays, leaveEncashment: p.leaveEncashment, otherAdditions: p.otherAdditions, otherDeductions: p.otherDeductions, loanBalance: p.loanBalance, netAmount: p.netAmount, notes: input.notes ?? null, updatedById: session.userId };
  return prisma.$transaction(async (tx) => {
    if (input.id) {
      const ex = await tx.endOfServiceCalc.findFirst({ where: { id: input.id, companyId: session.companyId } });
      if (!ex || ex.status !== "DRAFT") throw new Error("NOT_DRAFT");
      return tx.endOfServiceCalc.update({ where: { id: input.id }, data });
    }
    const open = await tx.endOfServiceCalc.count({ where: { companyId: session.companyId, employeeId: input.employeeId, status: { in: ["DRAFT", "APPROVED", "POSTED"] } } });
    if (open) throw new Error("EOSB_EXISTS");
    const number = await nextDocumentNumber(tx, session.companyId, "EOSB", data.terminationDate);
    return tx.endOfServiceCalc.create({ data: { ...data, companyId: session.companyId, number, createdById: session.userId } });
  });
}
export async function approveEosb(session: AppSession, id: string) {
  const r = await prisma.endOfServiceCalc.findFirst({ where: { id, companyId: session.companyId } });
  if (!r || r.status !== "DRAFT") throw new Error("INVALID_TRANSITION");
  return prisma.endOfServiceCalc.update({ where: { id }, data: { status: "APPROVED", updatedById: session.userId } });
}
/** Post: Dr EOSB expense (benefit + leave + additions − deductions) Cr Employee loans (balance) Cr Salaries payable (net); employee → TERMINATED. */
export async function postEosb(session: AppSession, id: string) {
  return prisma.$transaction(async (tx) => {
    const r = await tx.endOfServiceCalc.findFirst({ where: { id, companyId: session.companyId } });
    if (!r || r.status !== "APPROVED") throw new Error("INVALID_TRANSITION");
    const emp = await tx.employee.findUniqueOrThrow({ where: { id: r.employeeId } });
    const [exp, salPay, loans] = await Promise.all([mappedAccount(tx, session.companyId, "EOSB_EXPENSE"), mappedAccount(tx, session.companyId, "SALARIES_PAYABLE"), mappedAccount(tx, session.companyId, "EMPLOYEE_LOANS")]);
    const n = empName(emp);
    const expense = D(r.eosbAmount).plus(r.leaveEncashment).plus(r.otherAdditions).minus(r.otherDeductions);
    const lines: PostingLine[] = [{ accountId: exp, debit: expense, costCenterId: emp.costCenterId, partyType: "EMPLOYEE", partyId: emp.id, description: `EOSB ${r.number}` }];
    if (D(r.loanBalance).gt(0)) lines.push({ accountId: loans, credit: r.loanBalance, partyType: "EMPLOYEE", partyId: emp.id, description: "Loan settlement" });
    lines.push({ accountId: salPay, credit: r.netAmount, partyType: "EMPLOYEE", partyId: emp.id, description: "EOSB payable" });
    const j = await postJournal(tx, { companyId: session.companyId, branchId: emp.branchId, entryDate: r.terminationDate, description: `End of service ${r.number} — ${n.nameEn} / مكافأة نهاية خدمة ${n.nameAr}`, reference: r.number, source: "PAYROLL", sourceType: "EndOfServiceCalc", sourceId: r.id, userId: session.userId, lines });
    await tx.employeeLoan.updateMany({ where: { employeeId: emp.id, status: "ACTIVE" }, data: { status: "PAID", paidAmount: { increment: 0 } } });
    await tx.employee.update({ where: { id: emp.id }, data: { status: "TERMINATED", terminationDate: r.terminationDate, isActive: false } });
    return tx.endOfServiceCalc.update({ where: { id }, data: { status: "POSTED", journalEntryId: j.id, updatedById: session.userId } });
  });
}
export async function payEosb(session: AppSession, id: string) {
  return prisma.$transaction(async (tx) => {
    const r = await tx.endOfServiceCalc.findFirst({ where: { id, companyId: session.companyId } });
    if (!r || r.status !== "POSTED") throw new Error("INVALID_TRANSITION");
    const [salPay, bank] = await Promise.all([mappedAccount(tx, session.companyId, "SALARIES_PAYABLE"), mappedAccount(tx, session.companyId, "BANK_DEFAULT")]);
    const j = await postJournal(tx, { companyId: session.companyId, entryDate: new Date(), description: `EOSB payment ${r.number} / صرف مكافأة نهاية الخدمة`, reference: r.number, source: "PAYROLL", sourceType: "EndOfServiceCalc", sourceId: r.id, userId: session.userId, lines: [{ accountId: salPay, debit: r.netAmount }, { accountId: bank, credit: r.netAmount }] });
    return tx.endOfServiceCalc.update({ where: { id }, data: { status: "PAID", paymentEntryId: j.id, updatedById: session.userId } });
  });
}
export async function cancelEosb(session: AppSession, id: string) {
  const r = await prisma.endOfServiceCalc.findFirst({ where: { id, companyId: session.companyId } });
  if (!r || !["DRAFT", "APPROVED"].includes(r.status)) throw new Error("INVALID_TRANSITION");
  return prisma.endOfServiceCalc.update({ where: { id }, data: { status: "CANCELLED", updatedById: session.userId } });
}
export async function listEosb(session: AppSession, p: ListParams): Promise<PagedResult<Record<string, unknown>>> {
  const w: Record<string, unknown> = { companyId: session.companyId }; if (p.filters.status) w.status = p.filters.status; if (p.q) w.number = { contains: p.q, mode: "insensitive" };
  const [rows, total] = await Promise.all([prisma.endOfServiceCalc.findMany({ where: w, orderBy: orderByFrom(p.sort, ["number", "terminationDate", "netAmount", "status"], { terminationDate: "desc" }), ...skipTake(p) }), prisma.endOfServiceCalc.count({ where: w })]);
  return { rows: await withEmployee(session.companyId, rows), total, page: p.page, pageSize: p.pageSize };
}
export async function allEosb(session: AppSession, p: ListParams) { const w: Record<string, unknown> = { companyId: session.companyId }; if (p.filters.status) w.status = p.filters.status; return withEmployee(session.companyId, await prisma.endOfServiceCalc.findMany({ where: w, orderBy: { terminationDate: "desc" }, take: 5000 })); }
export async function getEosb(session: AppSession, id: string) {
  const r = await prisma.endOfServiceCalc.findFirst({ where: { id, companyId: session.companyId } });
  if (!r) return null;
  const [row] = await withEmployee(session.companyId, [r]);
  const [journal, payment] = await Promise.all([r.journalEntryId ? prisma.journalEntry.findUnique({ where: { id: r.journalEntryId }, select: { id: true, number: true } }) : null, r.paymentEntryId ? prisma.journalEntry.findUnique({ where: { id: r.paymentEntryId }, select: { id: true, number: true } }) : null]);
  return { ...row, journal, payment };
}
export function eosColumns(tf: (k: string) => string, t: (k: string) => string): ColumnDef[] {
  return [
    { key: "number", label: tf("number"), sortable: true, type: "link", hrefTemplate: "/hr/eosb/{id}" }, { key: "employee", label: t("employee"), bilingual: "employee" },
    { key: "terminationDate", label: tf("terminationDate"), type: "date", sortable: true }, { key: "reason", label: t("eos.reason"), type: "enum", enumName: "EosReason" },
    { key: "serviceYears", label: t("eos.serviceYears"), type: "number", align: "end" }, { key: "eosbAmount", label: t("eos.benefit"), type: "money", align: "end" }, { key: "leaveEncashment", label: t("eos.leaveEncashment"), type: "money", align: "end" },
    { key: "loanBalance", label: t("eos.loanBalance"), type: "money", align: "end", hidden: true }, { key: "netAmount", label: t("net"), type: "money", align: "end", sortable: true },
    { key: "status", label: tf("status"), type: "enum", enumName: "EosStatus", tones: { DRAFT: "secondary", APPROVED: "info", POSTED: "success", PAID: "success", CANCELLED: "destructive" } },
  ];
}
