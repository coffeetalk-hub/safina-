import React from "react";
import { Text, View } from "@react-pdf/renderer";
import type { PdfGenerator } from "@/core/pdf/registry";
import { PdfFrame, pdfStyles, type PdfCompany } from "@/core/pdf/base";
import { companyHeader } from "@/modules/foundation/settings/service";
import { getPayslip } from "./payroll";
import { getEosb } from "./eosb";
import { empName } from "./employees";

const money = (n: number | string | { toString(): string }, cur = "SAR") => `${Number(n.toString()).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
const date = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "");
function KV({ ar, en, value }: { ar: string; en: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
      <Text style={pdfStyles.small}>{en}</Text>
      <Text style={[pdfStyles.small, { fontWeight: 700 }]}>{value}</Text>
      <Text style={[pdfStyles.small, pdfStyles.rtl]}>{ar}</Text>
    </View>
  );
}
type Line = { code: string; nameAr: string; nameEn: string; type: string; amount: unknown };
function LinesTable({ title, lines, total }: { title: { ar: string; en: string }; lines: Line[]; total: number }) {
  return (
    <View style={[pdfStyles.table, { width: "49%" }]}>
      <View style={[pdfStyles.tr, { backgroundColor: "#1e3a5f" }]}>
        <Text style={[pdfStyles.th, { width: "60%" }]}>{title.en} / {title.ar}</Text>
        <Text style={[pdfStyles.th, { width: "40%", textAlign: "right" }]}>Amount / المبلغ</Text>
      </View>
      {lines.map((l, i) => (
        <View key={i} style={pdfStyles.tr}>
          <View style={{ width: "60%", padding: 3 }}><Text style={pdfStyles.small}>{l.nameEn}</Text><Text style={[pdfStyles.small, pdfStyles.rtl]}>{l.nameAr}</Text></View>
          <Text style={[pdfStyles.td, { width: "40%", textAlign: "right" }]}>{money(l.amount as number)}</Text>
        </View>
      ))}
      <View style={[pdfStyles.tr, { backgroundColor: "#f1f5f9" }]}>
        <Text style={[pdfStyles.td, { width: "60%", fontWeight: 700 }]}>Total / الإجمالي</Text>
        <Text style={[pdfStyles.td, { width: "40%", textAlign: "right", fontWeight: 700 }]}>{money(total)}</Text>
      </View>
    </View>
  );
}

export function PayslipPdf({ company, slip, printedBy }: { company: PdfCompany; slip: NonNullable<Awaited<ReturnType<typeof getPayslip>>>; printedBy?: string }) {
  const n = empName(slip.employee);
  const period = `${slip.run.periodYear}-${String(slip.run.periodMonth).padStart(2, "0")}`;
  const earnings = slip.lines.filter((l) => l.type === "EARNING"); const deductions = slip.lines.filter((l) => l.type === "DEDUCTION");
  return (
    <PdfFrame company={company} titleAr="قسيمة راتب" titleEn="Payslip" subtitle={`${slip.number} · ${period}`} printedBy={printedBy}>
      <View style={[pdfStyles.box, { marginBottom: 8 }]}>
        <KV ar="الموظف" en="Employee" value={`${slip.employee.code} · ${n.nameEn} / ${n.nameAr}`} />
        <KV ar="المسمى الوظيفي" en="Job title" value={`${slip.employee.jobTitleEn ?? ""} / ${slip.employee.jobTitleAr ?? ""}`} />
        <KV ar="الفترة" en="Period" value={period} />
        <KV ar="تاريخ الصرف" en="Pay date" value={date(slip.run.payDate)} />
        <KV ar="طريقة الدفع" en="Payment" value={slip.paymentMethod === "CASH" ? "Cash / نقدًا" : `Bank transfer · ${slip.bankName ?? ""} ${slip.iban ?? ""}`} />
        <KV ar="رقم التأمينات" en="GOSI no." value={slip.employee.gosiNumber ?? "—"} />
        <KV ar="أيام الغياب / إجازة غير مدفوعة" en="Absent / unpaid days" value={`${Number(slip.absentDays)} / ${Number(slip.unpaidLeaveDays)}`} />
        <KV ar="ساعات العمل الإضافي" en="Overtime hours" value={`${Number(slip.overtimeHrs)}`} />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <LinesTable title={{ ar: "الاستحقاقات", en: "Earnings" }} lines={earnings} total={Number(slip.totalEarnings)} />
        <LinesTable title={{ ar: "الاستقطاعات", en: "Deductions" }} lines={deductions} total={Number(slip.totalDeductions)} />
      </View>
      <View style={[pdfStyles.box, { marginTop: 10, backgroundColor: "#f8fafc" }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 12, fontWeight: 700 }}>Net pay / صافي الراتب</Text>
          <Text style={{ fontSize: 12, fontWeight: 700 }}>{money(slip.net)}</Text>
        </View>
        <Text style={[pdfStyles.small, { marginTop: 4 }]}>Employer GOSI contribution (not deducted) / حصة صاحب العمل في التأمينات (غير مستقطعة): {money(slip.gosiEmployer)} — GOSI wage / الأجر الخاضع: {money(slip.gosiWage)}</Text>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 36 }}>
        <Text style={pdfStyles.small}>HR / الموارد البشرية: ____________________</Text>
        <Text style={pdfStyles.small}>Employee / الموظف: ____________________</Text>
      </View>
    </PdfFrame>
  );
}

export function EosbPdf({ company, r, printedBy }: { company: PdfCompany; r: NonNullable<Awaited<ReturnType<typeof getEosb>>>; printedBy?: string }) {
  const rows: [string, string, string][] = [
    ["Full entitlement (Art. 84)", "الاستحقاق الكامل (م. 84)", money(r.fullEntitlement)],
    [`Applicable share (Art. 85) ${r.eosbPct}%`, `النسبة المستحقة (م. 85) ${r.eosbPct}%`, money(r.eosbAmount)],
    [`Leave encashment (${Number(r.leaveDays)} days, Art. 111)`, `بدل إجازة (${Number(r.leaveDays)} يوم، م. 111)`, money(r.leaveEncashment)],
    ["Other additions", "إضافات أخرى", money(r.otherAdditions)],
    ["Other deductions", "استقطاعات أخرى", `(${money(r.otherDeductions)})`],
    ["Loan balance settled", "رصيد السلف", `(${money(r.loanBalance)})`],
  ];
  return (
    <PdfFrame company={company} titleAr="تسوية نهاية الخدمة" titleEn="End-of-Service Settlement" subtitle={r.number} printedBy={printedBy}>
      <View style={[pdfStyles.box, { marginBottom: 8 }]}>
        <KV ar="الموظف" en="Employee" value={`${r.employeeCode} · ${r.employeeEn} / ${r.employeeAr}`} />
        <KV ar="تاريخ انتهاء الخدمة" en="Last working day" value={date(r.terminationDate)} />
        <KV ar="سبب انتهاء الخدمة" en="Reason" value={r.reason} />
        <KV ar="مدة الخدمة (سنوات)" en="Service (years)" value={Number(r.serviceYears).toFixed(2)} />
        <KV ar="الأجر الشهري المعتمد" en="Monthly wage basis" value={money(r.monthlyWage)} />
        <KV ar="الحالة" en="Status" value={r.status} />
      </View>
      <View style={pdfStyles.table}>
        <View style={[pdfStyles.tr, { backgroundColor: "#1e3a5f" }]}><Text style={[pdfStyles.th, { width: "45%" }]}>Item</Text><Text style={[pdfStyles.th, { width: "30%", textAlign: "right" }]}>البند</Text><Text style={[pdfStyles.th, { width: "25%", textAlign: "right" }]}>Amount / المبلغ</Text></View>
        {rows.map(([en, ar, v]) => (
          <View key={en} style={pdfStyles.tr}><Text style={[pdfStyles.td, { width: "45%" }]}>{en}</Text><Text style={[pdfStyles.td, pdfStyles.rtl, { width: "30%" }]}>{ar}</Text><Text style={[pdfStyles.td, { width: "25%", textAlign: "right" }]}>{v}</Text></View>
        ))}
        <View style={[pdfStyles.tr, { backgroundColor: "#f1f5f9" }]}><Text style={[pdfStyles.td, { width: "45%", fontWeight: 700 }]}>Net settlement</Text><Text style={[pdfStyles.td, pdfStyles.rtl, { width: "30%", fontWeight: 700 }]}>صافي التسوية</Text><Text style={[pdfStyles.td, { width: "25%", textAlign: "right", fontWeight: 700 }]}>{money(r.netAmount)}</Text></View>
      </View>
      {r.notes ? <Text style={[pdfStyles.small, { marginTop: 6 }]}>{r.notes}</Text> : null}
      <Text style={[pdfStyles.small, { marginTop: 10, color: "#64748b" }]}>Calculated per Saudi Labour Law Articles 84, 85 and 111 using the parameters configured in HR settings. / محسوبة وفق المواد 84 و85 و111 من نظام العمل السعودي حسب الإعدادات.</Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 36 }}>
        <Text style={pdfStyles.small}>HR / الموارد البشرية: ____________________</Text>
        <Text style={pdfStyles.small}>Finance / المالية: ____________________</Text>
        <Text style={pdfStyles.small}>Employee / الموظف: ____________________</Text>
      </View>
    </PdfFrame>
  );
}

const who = (s: { nameAr: string; nameEn: string }, locale: string) => (locale === "ar" ? s.nameAr : s.nameEn);
export const payslipPdf: PdfGenerator = {
  permission: ["hr.payroll:view", "hr.self:view"], // getPayslip enforces ownership for hr.self
  render: async (session, id, locale) => { const slip = await getPayslip(session, id); if (!slip) return null; const { company, logoDataUrl } = await companyHeader(session.companyId); return { element: React.createElement(PayslipPdf, { company: { ...company, logoDataUrl }, slip, printedBy: who(session, locale) }), fileName: slip.number }; },
};
export const eosbPdf: PdfGenerator = {
  permission: "hr.eosb:view",
  render: async (session, id, locale) => { const r = await getEosb(session, id); if (!r) return null; const { company, logoDataUrl } = await companyHeader(session.companyId); return { element: React.createElement(EosbPdf, { company: { ...company, logoDataUrl }, r, printedBy: who(session, locale) }), fileName: r.number }; },
};
