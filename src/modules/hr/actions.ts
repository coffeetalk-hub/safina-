"use server";

import { z } from "zod";
import { runAction } from "@/core/action";
import { prisma } from "@/lib/prisma";
import { plain } from "@/components/data-table/types";
import { hrSettingsSchema, saveHrSettings, gosiRates, gosiRateSchema, holidays, holidaySchema, payComponents, payComponentSchema, leaveTypes, leaveTypeSchema } from "./settings";
import { contracts, contractSchema, documents, documentSchema, salarySchema, saveSalaryStructure } from "./employees";
import { attendanceSchema, saveAttendance, removeAttendance, generateMonth } from "./attendance";
import { leaveSchema, saveLeave, submitLeave, decideLeave, cancelLeave, adjustBalance } from "./leave";
import { loanSchema, saveLoan, submitLoan, disburseLoan, cancelLoan } from "./loans";
import { runSchema, createRun, calculateRun, submitRun, postRun, payRun, cancelRun, reopenRun, generateWps } from "./payroll";
import { eosSchema, previewEosb, saveEosb, approveEosb, postEosb, payEosb, cancelEosb } from "./eosb";

const idOf = (input: unknown) => (typeof input === "string" ? input : String((input as { id: string }).id));
const crud = (permRes: string, c: { save: (s: never, d: never) => Promise<unknown>; remove: (s: never, id: string) => Promise<unknown> }, schema: z.ZodTypeAny) => ({
  save: async (input: unknown) => { const e = Boolean((input as { id?: string })?.id); return runAction({ permission: `hr.${permRes}:${e ? "edit" : "create"}`, schema }, input, (d, s) => c.save(s as never, d as never)); },
  remove: async (id: string) => runAction({ permission: `hr.${permRes}:delete` }, null, (_d, s) => c.remove(s as never, id)),
});

// settings
export async function saveHrSettingsAction(input: unknown) { return runAction({ permission: "hr.payroll:edit", schema: hrSettingsSchema }, input, (d, s) => saveHrSettings(s, d)); }
const g = crud("payroll", gosiRates, gosiRateSchema); export async function saveGosiRateAction(i: unknown) { return g.save(i); } export async function removeGosiRateAction(id: string) { return g.remove(id); }
const h = crud("attendance", holidays, holidaySchema); export async function saveHolidayAction(i: unknown) { return h.save(i); } export async function removeHolidayAction(id: string) { return h.remove(id); }
const pc = crud("payroll", payComponents, payComponentSchema); export async function savePayComponentAction(i: unknown) { return pc.save(i); } export async function removePayComponentAction(id: string) { return pc.remove(id); }
const lt = crud("leave", leaveTypes, leaveTypeSchema); export async function saveLeaveTypeAction(i: unknown) { return lt.save(i); } export async function removeLeaveTypeAction(id: string) { return lt.remove(id); }
// employee file
const ct = crud("contract", contracts, contractSchema); export async function saveContractAction(i: unknown) { return ct.save(i); } export async function removeContractAction(id: string) { return ct.remove(id); }
const dc = crud("document", documents, documentSchema); export async function saveDocumentAction(i: unknown) { return dc.save(i); } export async function removeDocumentAction(id: string) { return dc.remove(id); }
export async function saveSalaryAction(input: unknown) { return runAction({ permission: "hr.payroll:edit", schema: salarySchema }, input, (d, s) => saveSalaryStructure(s, d)); }
// attendance
export async function saveAttendanceAction(input: unknown) { return runAction({ permission: "hr.attendance:create", schema: attendanceSchema }, input, (d, s) => saveAttendance(s, d)); }
export async function removeAttendanceAction(id: string) { return runAction({ permission: "hr.attendance:delete" }, null, (_d, s) => removeAttendance(s, id)); }
export async function generateMonthAction(input: unknown) { return runAction({ permission: "hr.attendance:create", schema: z.object({ year: z.coerce.number().int(), month: z.coerce.number().int().min(1).max(12) }) }, input, (d, s) => generateMonth(s, d.year, d.month)); }
// leave
export async function saveLeaveAction(input: unknown) { const e = Boolean((input as { id?: string })?.id); return runAction({ permission: `hr.leave:${e ? "edit" : "create"}`, schema: leaveSchema }, input, async (d, s) => { const r = await saveLeave(s, d); return { id: r.id, number: r.number }; }); }
export async function submitLeaveAction(id: string) { return runAction({ permission: "hr.leave:create" }, null, (_d, s) => submitLeave(s, id)); }
export async function decideLeaveAction(input: unknown) { return runAction({ permission: "hr.leave:approve", schema: z.object({ id: z.string(), decision: z.enum(["APPROVED", "REJECTED"]) }) }, input, (d, s) => decideLeave(s, d.id, d.decision)); }
export async function cancelLeaveAction(id: string) { return runAction({ permission: "hr.leave:create" }, null, (_d, s) => cancelLeave(s, id)); }
export async function adjustBalanceAction(input: unknown) { return runAction({ permission: "hr.leave:edit", schema: z.object({ employeeId: z.string(), leaveTypeId: z.string(), year: z.coerce.number().int(), adjusted: z.coerce.number(), carried: z.coerce.number() }) }, input, (d, s) => adjustBalance(s, d)); }
export async function deleteLeaveAction(id: string) { return runAction({ permission: "hr.leave:delete" }, null, async (_d, s) => { const r = await prisma.leaveRequest.findFirst({ where: { id, companyId: s.companyId } }); if (!r || r.status !== "DRAFT") throw new Error("NOT_DRAFT"); return prisma.leaveRequest.delete({ where: { id } }); }); }
// loans
export async function saveLoanAction(input: unknown) { const e = Boolean((input as { id?: string })?.id); return runAction({ permission: `hr.loan:${e ? "edit" : "create"}`, schema: loanSchema }, input, async (d, s) => { const r = await saveLoan(s, d); return { id: r.id, number: r.number }; }); }
export async function submitLoanAction(id: string) { return runAction({ permission: "hr.loan:create" }, null, (_d, s) => submitLoan(s, id)); }
export async function disburseLoanAction(input: unknown) { return runAction({ permission: "hr.loan:approve", schema: z.object({ id: z.string(), method: z.enum(["BANK_DEFAULT", "CASH"]).default("BANK_DEFAULT") }) }, input, (d, s) => disburseLoan(s, d.id, d.method)); }
export async function cancelLoanAction(id: string) { return runAction({ permission: "hr.loan:edit" }, null, (_d, s) => cancelLoan(s, id)); }
// payroll
export async function createRunAction(input: unknown) { return runAction({ permission: "hr.payroll:create", schema: runSchema }, input, async (d, s) => { const r = await createRun(s, d); return { id: r.id, number: r.number }; }); }
export async function calculateRunAction(input: unknown) { return runAction({ permission: "hr.payroll:edit" }, null, (_d, s) => calculateRun(s, idOf(input))); }
export async function submitRunAction(input: unknown) { return runAction({ permission: "hr.payroll:edit" }, null, (_d, s) => submitRun(s, idOf(input))); }
export async function postRunAction(input: unknown) { return runAction({ permission: "hr.payroll:approve" }, null, (_d, s) => postRun(s, idOf(input))); }
export async function payRunAction(input: unknown) { return runAction({ permission: "hr.payroll:approve" }, null, (_d, s) => payRun(s, idOf(input))); }
export async function cancelRunAction(input: unknown) { return runAction({ permission: "hr.payroll:edit" }, null, (_d, s) => cancelRun(s, idOf(input))); }
export async function reopenRunAction(input: unknown) { return runAction({ permission: "hr.payroll:edit" }, null, (_d, s) => reopenRun(s, idOf(input))); }
export async function generateWpsAction(input: unknown) { return runAction({ permission: "hr.wps:create" }, null, async (_d, s) => { const w = await generateWps(s, idOf(input)); return { id: w.id, fileName: w.fileName, records: w.records }; }); }
// EOSB
export async function previewEosbAction(input: unknown) { return runAction({ permission: "hr.eosb:view", schema: eosSchema }, input, async (d, s) => { const p = await previewEosb(s, d); return plain({ ...p, employee: undefined }); }); }
export async function saveEosbAction(input: unknown) { const e = Boolean((input as { id?: string })?.id); return runAction({ permission: `hr.eosb:${e ? "edit" : "create"}`, schema: eosSchema }, input, async (d, s) => { const r = await saveEosb(s, d); return { id: r.id, number: r.number }; }); }
export async function approveEosbAction(input: unknown) { return runAction({ permission: "hr.eosb:approve" }, null, (_d, s) => approveEosb(s, idOf(input))); }
export async function postEosbAction(input: unknown) { return runAction({ permission: "hr.eosb:approve" }, null, (_d, s) => postEosb(s, idOf(input))); }
export async function payEosbAction(input: unknown) { return runAction({ permission: "hr.eosb:approve" }, null, (_d, s) => payEosb(s, idOf(input))); }
export async function cancelEosbAction(input: unknown) { return runAction({ permission: "hr.eosb:edit" }, null, (_d, s) => cancelEosb(s, idOf(input))); }
