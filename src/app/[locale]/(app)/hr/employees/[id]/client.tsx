"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Save, Loader2, Printer } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EntityDialog, type FieldConfig } from "@/components/forms/entity-dialog";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { AttachmentsPanel, type AttachmentItem } from "@/components/attachments/attachments-panel";
import { PageHeader } from "@/components/shell/page-header";
import { DocStatus } from "@/components/finance/doc-toolbar";
import { useToast } from "@/components/ui/toast";
import { saveContractAction, removeContractAction, saveDocumentAction, removeDocumentAction, saveSalaryAction, adjustBalanceAction } from "@/modules/hr/actions";
import { HR_DOC_TYPES } from "@/modules/hr/constants";
import { formatMoney, formatNumber } from "@/lib/money";
import { formatDate } from "@/lib/dates";

type Opt = { value: string; label: string };
type Row = Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type File = any;

export function EmployeeFile({ file, perms, attachments }: { file: File; lookups?: { currencies: Opt[]; employees: Opt[] }; perms: Record<string, boolean>; attachments: AttachmentItem[] }) {
  const t = useTranslations("hr"); const tf = useTranslations("fields"); const tc = useTranslations("common"); const tk = useTranslations("enums"); const te = useTranslations("errors");
  const locale = useLocale(); const ar = locale === "ar"; const router = useRouter(); const toast = useToast();
  const e = file.employee;
  const name = ar ? `${e.firstNameAr} ${e.lastNameAr}` : `${e.firstNameEn} ${e.lastNameEn}`;
  const [dlg, setDlg] = React.useState<null | { kind: "contract" | "document" | "balance"; row: Row | null }>(null);
  const bi = (r: Row, k: string) => String(ar ? r[`${k}Ar`] : r[`${k}En`]);

  // salary editor state
  const res = file.resolved;
  const [basic, setBasic] = React.useState<string>(String(file.salary?.basic ?? ""));
  const [method, setMethod] = React.useState<string>(file.salary?.paymentMethod ?? "BANK_TRANSFER");
  const [eff, setEff] = React.useState<string>(file.salary?.effectiveFrom?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [vals, setVals] = React.useState<Record<string, string>>(Object.fromEntries((file.components as Row[]).map((c) => [String(c.id), String((file.salary?.lines as Row[] | undefined)?.find((l) => l.componentId === c.id)?.value ?? "")])));
  const [busy, setBusy] = React.useState(false);
  const comp = (c: Row) => { const v = Number(vals[String(c.id)] || 0); return c.calc === "PERCENT_OF_BASIC" ? Math.round(Number(basic || 0) * v) / 100 : v; };
  const earn = (file.components as Row[]).filter((c) => c.type === "EARNING"); const ded = (file.components as Row[]).filter((c) => c.type === "DEDUCTION");
  const gross = Number(basic || 0) + earn.reduce((a, c) => a + comp(c), 0); const fixedDed = ded.reduce((a, c) => a + comp(c), 0);
  const saveSalary = async () => {
    setBusy(true);
    const r = await saveSalaryAction({ employeeId: e.id, basic: Number(basic || 0), currencyCode: "SAR", paymentMethod: method, effectiveFrom: eff, notes: null, lines: (file.components as Row[]).map((c) => ({ componentId: c.id, value: Number(vals[String(c.id)] || 0) })) });
    setBusy(false);
    if (r.ok) { toast.success(tc("saved")); router.refresh(); } else toast.error(te.has(r.error) ? te(r.error) : r.error);
  };

  const contractFields: FieldConfig[] = [
    { name: "type", label: tf("type"), type: "select", options: ["UNLIMITED", "LIMITED", "PART_TIME"].map((v) => ({ value: v, label: tk(`ContractType.${v}`) })), required: true },
    { name: "status", label: tf("status"), type: "select", options: ["ACTIVE", "ENDED", "TERMINATED"].map((v) => ({ value: v, label: tk(`EmployeeContractStatus.${v}`) })), required: true },
    { name: "startDate", label: tf("startDate"), type: "date", required: true }, { name: "endDate", label: tf("endDate"), type: "date", description: t("contracts.endHint") },
    { name: "probationEndDate", label: t("probationEnd"), type: "date" }, { name: "number", label: tf("number"), dir: "ltr", description: t("contracts.numberHint") },
    { name: "workingHoursWeek", label: t("hoursPerWeek"), type: "number" }, { name: "noticeDays", label: t("noticeDays"), type: "number" },
    { name: "jobTitleAr", label: tf("jobTitleAr"), dir: "rtl" }, { name: "jobTitleEn", label: tf("jobTitleEn"), dir: "ltr" },
    { name: "notes", label: tf("notes"), type: "textarea", colSpan: 2 },
  ];
  const docFields: FieldConfig[] = [
    { name: "type", label: tf("type"), type: "select", options: HR_DOC_TYPES.map((v) => ({ value: v, label: tk(`HrDocumentType.${v}`) })), required: true }, { name: "number", label: tf("number"), dir: "ltr" },
    { name: "issueDate", label: t("issueDate"), type: "date" }, { name: "expiryDate", label: t("expiryDate"), type: "date" },
    { name: "alertDays", label: t("alertDays"), type: "number" }, { name: "notes", label: tf("notes"), type: "textarea", colSpan: 2 },
  ];
  const dd = (r: Row | null, keys: string[]) => { if (!r) return {}; const o: Row = { ...r }; for (const k of keys) if (typeof o[k] === "string") o[k] = (o[k] as string).slice(0, 10); for (const k of Object.keys(o)) if (o[k] === null) o[k] = ""; return o; };
  const left = (d: number | null) => d == null ? null : <Badge variant={d < 0 ? "destructive" : d <= 30 ? "warning" : "secondary"}>{d}</Badge>;

  return (
    <>
      <PageHeader title={`${e.code} · ${name}`} description={`${ar ? e.jobTitleAr ?? "" : e.jobTitleEn ?? ""}${e.department ? ` · ${e.department}` : ""}`} actions={<><Button variant="ghost" size="sm" asChild><Link href="/hr/employees"><ArrowLeft className="rtl:rotate-180" /> {tc("back")}</Link></Button><DocStatus status={e.status} /></>} />
      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">{t("tabs.overview")}</TabsTrigger><TabsTrigger value="contracts">{t("tabs.contracts")} ({file.contracts.length})</TabsTrigger><TabsTrigger value="documents">{t("tabs.documents")} ({file.documents.length})</TabsTrigger>
          <TabsTrigger value="salary">{t("tabs.salary")}</TabsTrigger><TabsTrigger value="leave">{t("tabs.leave")}</TabsTrigger><TabsTrigger value="loans">{t("tabs.loans")} ({file.loans.length})</TabsTrigger><TabsTrigger value="payslips">{t("tabs.payslips")} ({file.payslips.length})</TabsTrigger><TabsTrigger value="eos">{t("tabs.eos")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card><CardContent className="text-sm space-y-1">
              {[[tf("nationality"), e.nationality + (e.isSaudi ? ` · ${t("reports.saudi")}` : "")], [tf("nationalId"), e.nationalId], [tf("gender"), tk(`Gender.${e.gender}`)], [tf("dateOfBirth"), formatDate(e.dateOfBirth, locale)], [tf("hireDate"), formatDate(e.hireDate, locale)], [tf("branch"), e.branch ? (ar ? e.branch.nameAr : e.branch.nameEn) : "—"], [tf("costCenter"), e.costCenter ? `${e.costCenter.code} ${ar ? e.costCenter.nameAr : e.costCenter.nameEn}` : "—"], [tf("manager"), e.manager ? (ar ? `${e.manager.firstNameAr} ${e.manager.lastNameAr}` : `${e.manager.firstNameEn} ${e.manager.lastNameEn}`) : "—"], [tf("email"), e.email], [tf("phone"), e.phone], [tf("gosiNumber"), e.gosiNumber], [tf("bankName"), e.bankName], [tf("iban"), e.iban]].map(([k, v]) => <div key={String(k)} className="flex justify-between gap-3"><span className="text-muted-foreground">{k}</span><span dir="auto">{v || "—"}</span></div>)}
              <div className="pt-2"><Button size="sm" variant="outline" asChild><Link href={`/foundation/employees?q=${e.code}`}>{t("employees.editMaster")}</Link></Button></div>
            </CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">{t("tabs.salary")}</CardTitle></CardHeader><CardContent className="text-sm space-y-1">
              {res ? <>{[[t("basic"), res.basic], [t("housing"), res.housing], [t("grossFixed"), res.gross], [t("fixedDeductions"), res.fixedDeductions]].map(([k, v]) => <div key={String(k)} className="flex justify-between"><span className="text-muted-foreground">{k}</span><span dir="ltr" className="tabular-nums">{formatMoney(Number(v), locale)}</span></div>)}</> : <span className="text-muted-foreground">{t("salary.none")}</span>}
            </CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">{t("balances.title")} {new Date().getUTCFullYear()}</CardTitle></CardHeader><CardContent className="text-sm space-y-1">
              {(file.balances as Row[]).map((b) => <div key={String(b.id)} className="flex justify-between"><span className="text-muted-foreground">{bi(b.leaveType as Row, "name")}</span><span dir="ltr" className="tabular-nums">{formatNumber(Number(b.remaining), locale, 1)} / {formatNumber(Number(b.entitled) + Number(b.carried) + Number(b.adjusted), locale, 1)}</span></div>)}
            </CardContent></Card>
          </div>
          <div className="mt-4"><AttachmentsPanel entityType="Employee" entityId={e.id} items={attachments} canUpload={perms.attach} canDelete={perms.attachDelete} /></div>
        </TabsContent>

        <TabsContent value="contracts">
          <Card><CardContent>
            {perms.contract && <Button size="sm" className="mb-3" onClick={() => setDlg({ kind: "contract", row: null })}><Plus /> {t("contracts.new")}</Button>}
            <Table><TableHeader><TableRow><TableHead>{tf("number")}</TableHead><TableHead>{tf("type")}</TableHead><TableHead>{tf("startDate")}</TableHead><TableHead>{tf("endDate")}</TableHead><TableHead>{t("probationEnd")}</TableHead><TableHead>{t("jobTitle")}</TableHead><TableHead>{tf("status")}</TableHead></TableRow></TableHeader>
              <TableBody>{(file.contracts as Row[]).map((c) => <TableRow key={String(c.id)} className={perms.contract ? "cursor-pointer" : ""} onClick={() => perms.contract && setDlg({ kind: "contract", row: c })}><TableCell dir="ltr">{String(c.number)}</TableCell><TableCell>{tk(`ContractType.${c.type}`)}</TableCell><TableCell dir="ltr">{formatDate(c.startDate as string, locale)}</TableCell><TableCell dir="ltr">{formatDate(c.endDate as string, locale)}</TableCell><TableCell dir="ltr">{formatDate(c.probationEndDate as string, locale)}</TableCell><TableCell>{bi(c, "jobTitle") === "null" ? "" : bi(c, "jobTitle")}</TableCell><TableCell><DocStatus status={String(c.status)} /></TableCell></TableRow>)}
              {file.contracts.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground h-16">{tc("noData")}</TableCell></TableRow>}</TableBody></Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card><CardContent>
            {perms.document && <Button size="sm" className="mb-3" onClick={() => setDlg({ kind: "document", row: null })}><Plus /> {t("documents.new")}</Button>}
            <Table><TableHeader><TableRow><TableHead>{tf("type")}</TableHead><TableHead>{tf("number")}</TableHead><TableHead>{t("issueDate")}</TableHead><TableHead>{t("expiryDate")}</TableHead><TableHead>{t("daysLeft")}</TableHead><TableHead>{tf("notes")}</TableHead></TableRow></TableHeader>
              <TableBody>{(file.documents as Row[]).map((d) => <TableRow key={String(d.id)} className={perms.document ? "cursor-pointer" : ""} onClick={() => perms.document && setDlg({ kind: "document", row: d })}><TableCell>{tk(`HrDocumentType.${d.type}`)}</TableCell><TableCell dir="ltr">{String(d.number ?? "")}</TableCell><TableCell dir="ltr">{formatDate(d.issueDate as string, locale)}</TableCell><TableCell dir="ltr">{formatDate(d.expiryDate as string, locale)}</TableCell><TableCell>{left(d.daysLeft as number | null)}</TableCell><TableCell>{String(d.notes ?? "")}</TableCell></TableRow>)}
              {file.documents.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground h-16">{tc("noData")}</TableCell></TableRow>}</TableBody></Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="salary">
          <Card><CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1"><Label>{t("basic")} *</Label><Input type="number" step="0.01" dir="ltr" value={basic} disabled={!perms.salary} onChange={(ev) => setBasic(ev.target.value)} /></div>
              <div className="space-y-1"><Label>{t("paymentMethod")}</Label><Select value={method} disabled={!perms.salary} onValueChange={setMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="BANK_TRANSFER">{tk("PaymentMethod.BANK_TRANSFER")}</SelectItem><SelectItem value="CASH">{tk("PaymentMethod.CASH")}</SelectItem></SelectContent></Select></div>
              <div className="space-y-1"><Label>{t("effectiveFrom")}</Label><Input type="date" dir="ltr" value={eff} disabled={!perms.salary} onChange={(ev) => setEff(ev.target.value)} /></div>
            </div>
            <Table><TableHeader><TableRow><TableHead>{t("component")}</TableHead><TableHead>{tf("type")}</TableHead><TableHead>{t("calc")}</TableHead><TableHead className="w-40 text-end">{t("value")}</TableHead><TableHead className="w-40 text-end">{t("monthlyAmount")}</TableHead></TableRow></TableHeader>
              <TableBody>{(file.components as Row[]).map((c) => <TableRow key={String(c.id)}><TableCell>{bi(c, "name")}{c.isHousing ? <Badge variant="outline" className="ms-2">{t("isHousing")}</Badge> : null}</TableCell><TableCell><Badge variant={c.type === "EARNING" ? "success" : "destructive"}>{tk(`PayComponentType.${c.type}`)}</Badge></TableCell><TableCell>{tk(`PayComponentCalc.${c.calc}`)}</TableCell><TableCell><Input className="h-8 text-end" type="number" step="0.01" dir="ltr" value={vals[String(c.id)] ?? ""} disabled={!perms.salary} placeholder={String(c.defaultValue)} onChange={(ev) => setVals({ ...vals, [String(c.id)]: ev.target.value })} /></TableCell><TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(comp(c), locale)}</TableCell></TableRow>)}</TableBody></Table>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="space-x-4 rtl:space-x-reverse"><span>{t("grossFixed")}: <b dir="ltr">{formatMoney(gross, locale)}</b></span><span>{t("fixedDeductions")}: <b dir="ltr">{formatMoney(fixedDed, locale)}</b></span><span>{t("netFixed")}: <b dir="ltr">{formatMoney(gross - fixedDed, locale)}</b></span></div>
              {perms.salary && <Button onClick={saveSalary} disabled={busy || !basic}>{busy ? <Loader2 className="animate-spin" /> : <Save />} {tc("save")}</Button>}
            </div>
            <p className="text-xs text-muted-foreground">{t("salary.hint")}</p>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="leave">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card><CardHeader><CardTitle className="text-base">{t("balances.title")} {new Date().getUTCFullYear()}</CardTitle></CardHeader><CardContent>
              <Table><TableHeader><TableRow><TableHead>{t("leaveType")}</TableHead><TableHead className="text-end">{t("balances.entitled")}</TableHead><TableHead className="text-end">{t("balances.carried")}</TableHead><TableHead className="text-end">{t("balances.adjusted")}</TableHead><TableHead className="text-end">{t("balances.taken")}</TableHead><TableHead className="text-end">{t("balances.remaining")}</TableHead></TableRow></TableHeader>
                <TableBody>{(file.balances as Row[]).map((b) => <TableRow key={String(b.id)} className={perms.leave ? "cursor-pointer" : ""} onClick={() => perms.leave && setDlg({ kind: "balance", row: b })}><TableCell>{bi(b.leaveType as Row, "name")}</TableCell><TableCell className="text-end" dir="ltr">{formatNumber(Number(b.entitled), locale, 1)}</TableCell><TableCell className="text-end" dir="ltr">{formatNumber(Number(b.carried), locale, 1)}</TableCell><TableCell className="text-end" dir="ltr">{formatNumber(Number(b.adjusted), locale, 1)}</TableCell><TableCell className="text-end" dir="ltr">{formatNumber(Number(b.taken), locale, 1)}</TableCell><TableCell className="text-end font-semibold" dir="ltr">{formatNumber(Number(b.remaining), locale, 1)}</TableCell></TableRow>)}</TableBody></Table>
              {perms.leave && <p className="text-xs text-muted-foreground mt-2">{t("balances.adjustHint")}</p>}
            </CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base flex items-center justify-between">{t("leave.title")}<Button size="sm" variant="outline" asChild><Link href={`/hr/leave/new?employeeId=${e.id}`}><Plus /> {t("leave.new")}</Link></Button></CardTitle></CardHeader><CardContent>
              <Table><TableHeader><TableRow><TableHead>{tf("number")}</TableHead><TableHead>{t("leaveType")}</TableHead><TableHead>{tf("from")}</TableHead><TableHead>{tf("to")}</TableHead><TableHead className="text-end">{t("days")}</TableHead><TableHead>{tf("status")}</TableHead></TableRow></TableHeader>
                <TableBody>{(file.leaves as Row[]).map((l) => <TableRow key={String(l.id)}><TableCell><Link href={`/hr/leave/${l.id}`} className="text-primary hover:underline" dir="ltr">{String(l.number)}</Link></TableCell><TableCell>{bi(l.leaveType as Row, "name")}</TableCell><TableCell dir="ltr">{formatDate(l.startDate as string, locale)}</TableCell><TableCell dir="ltr">{formatDate(l.endDate as string, locale)}</TableCell><TableCell className="text-end" dir="ltr">{Number(l.days)}</TableCell><TableCell><DocStatus status={String(l.status)} /></TableCell></TableRow>)}
                {file.leaves.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground h-16">{tc("noData")}</TableCell></TableRow>}</TableBody></Table>
            </CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="loans">
          <Card><CardContent>
            {perms.loan && <Button size="sm" className="mb-3" variant="outline" asChild><Link href={`/hr/loans/new?employeeId=${e.id}`}><Plus /> {t("loans.new")}</Link></Button>}
            <Table><TableHeader><TableRow><TableHead>{tf("number")}</TableHead><TableHead>{tf("date")}</TableHead><TableHead className="text-end">{tf("amount")}</TableHead><TableHead className="text-end">{t("installments")}</TableHead><TableHead className="text-end">{t("repaid")}</TableHead><TableHead className="text-end">{t("balance")}</TableHead><TableHead>{tf("status")}</TableHead></TableRow></TableHeader>
              <TableBody>{(file.loans as Row[]).map((l) => <TableRow key={String(l.id)}><TableCell><Link href={`/hr/loans/${l.id}`} className="text-primary hover:underline" dir="ltr">{String(l.number)}</Link></TableCell><TableCell dir="ltr">{formatDate(l.loanDate as string, locale)}</TableCell><TableCell className="text-end" dir="ltr">{formatMoney(Number(l.amount), locale)}</TableCell><TableCell className="text-end" dir="ltr">{String(l.installments)}</TableCell><TableCell className="text-end" dir="ltr">{formatMoney(Number(l.paidAmount), locale)}</TableCell><TableCell className="text-end" dir="ltr">{formatMoney(Number(l.amount) - Number(l.paidAmount), locale)}</TableCell><TableCell><DocStatus status={String(l.status)} /></TableCell></TableRow>)}
              {file.loans.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground h-16">{tc("noData")}</TableCell></TableRow>}</TableBody></Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="payslips">
          <Card><CardContent>
            <Table><TableHeader><TableRow><TableHead>{tf("number")}</TableHead><TableHead>{tf("period")}</TableHead><TableHead>{t("payDate")}</TableHead><TableHead className="text-end">{t("earnings")}</TableHead><TableHead className="text-end">{t("deductions")}</TableHead><TableHead className="text-end">{t("net")}</TableHead><TableHead>{tf("status")}</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>{(file.payslips as Row[]).map((p) => { const run = p.run as Row; return <TableRow key={String(p.id)}><TableCell><Link href={`/hr/payroll/payslip/${p.id}`} className="text-primary hover:underline" dir="ltr">{String(p.number)}</Link></TableCell><TableCell dir="ltr">{String(run.periodYear)}-{String(run.periodMonth).padStart(2, "0")}</TableCell><TableCell dir="ltr">{formatDate(run.payDate as string, locale)}</TableCell><TableCell className="text-end" dir="ltr">{formatMoney(Number(p.totalEarnings), locale)}</TableCell><TableCell className="text-end" dir="ltr">{formatMoney(Number(p.totalDeductions), locale)}</TableCell><TableCell className="text-end font-semibold" dir="ltr">{formatMoney(Number(p.net), locale)}</TableCell><TableCell><DocStatus status={String(run.status)} /></TableCell><TableCell><Button size="icon-sm" variant="ghost" asChild><a href={`/api/pdf/payslip/${p.id}?locale=${locale}`} target="_blank" rel="noreferrer"><Printer className="size-4" /></a></Button></TableCell></TableRow>; })}
              {file.payslips.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground h-16">{tc("noData")}</TableCell></TableRow>}</TableBody></Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="eos">
          <Card><CardContent>
            {perms.eosb && e.status !== "TERMINATED" && <Button size="sm" className="mb-3" variant="outline" asChild><Link href={`/hr/eosb/new?employeeId=${e.id}`}><Plus /> {t("eos.new")}</Link></Button>}
            <Table><TableHeader><TableRow><TableHead>{tf("number")}</TableHead><TableHead>{tf("terminationDate")}</TableHead><TableHead>{t("eos.reason")}</TableHead><TableHead className="text-end">{t("eos.serviceYears")}</TableHead><TableHead className="text-end">{t("eos.benefit")}</TableHead><TableHead className="text-end">{t("net")}</TableHead><TableHead>{tf("status")}</TableHead></TableRow></TableHeader>
              <TableBody>{(file.eos as Row[]).map((r) => <TableRow key={String(r.id)}><TableCell><Link href={`/hr/eosb/${r.id}`} className="text-primary hover:underline" dir="ltr">{String(r.number)}</Link></TableCell><TableCell dir="ltr">{formatDate(r.terminationDate as string, locale)}</TableCell><TableCell>{tk(`EosReason.${r.reason}`)}</TableCell><TableCell className="text-end" dir="ltr">{formatNumber(Number(r.serviceYears), locale, 2)}</TableCell><TableCell className="text-end" dir="ltr">{formatMoney(Number(r.eosbAmount), locale)}</TableCell><TableCell className="text-end font-semibold" dir="ltr">{formatMoney(Number(r.netAmount), locale)}</TableCell><TableCell><DocStatus status={String(r.status)} /></TableCell></TableRow>)}
              {file.eos.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground h-16">{tc("noData")}</TableCell></TableRow>}</TableBody></Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <EntityDialog open={dlg?.kind === "contract"} onOpenChange={(o) => !o && setDlg(null)} title={dlg?.row ? t("contracts.edit") : t("contracts.new")} size="lg" fields={contractFields} defaultValues={{ employeeId: e.id, type: "UNLIMITED", status: "ACTIVE", startDate: e.hireDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10), endDate: "", probationEndDate: "", number: "", workingHoursWeek: 48, noticeDays: 60, jobTitleAr: e.jobTitleAr ?? "", jobTitleEn: e.jobTitleEn ?? "", notes: "", ...dd(dlg?.row ?? null, ["startDate", "endDate", "probationEndDate"]) }} action={saveContractAction} onSuccess={() => { setDlg(null); router.refresh(); }}>
        {dlg?.row && perms.deleteContract && <ConfirmButton title={tc("deleteConfirmTitle")} description={tc("deleteConfirmDesc")} action={() => removeContractAction(String(dlg.row!.id))} onSuccess={() => { setDlg(null); router.refresh(); }}>{tc("delete")}</ConfirmButton>}
      </EntityDialog>
      <EntityDialog open={dlg?.kind === "document"} onOpenChange={(o) => !o && setDlg(null)} title={dlg?.row ? t("documents.edit") : t("documents.new")} size="lg" fields={docFields} defaultValues={{ employeeId: e.id, type: "IQAMA", number: "", issueDate: "", expiryDate: "", alertDays: 30, notes: "", ...dd(dlg?.row ?? null, ["issueDate", "expiryDate"]) }} action={saveDocumentAction} onSuccess={() => { setDlg(null); router.refresh(); }}>
        {dlg?.row && perms.deleteDoc && <ConfirmButton title={tc("deleteConfirmTitle")} description={tc("deleteConfirmDesc")} action={() => removeDocumentAction(String(dlg.row!.id))} onSuccess={() => { setDlg(null); router.refresh(); }}>{tc("delete")}</ConfirmButton>}
      </EntityDialog>
      <EntityDialog open={dlg?.kind === "balance"} onOpenChange={(o) => !o && setDlg(null)} title={t("balances.adjust")} size="sm" columns={1} fields={[{ name: "carried", label: t("balances.carried"), type: "number", step: "0.5" }, { name: "adjusted", label: t("balances.adjusted"), type: "number", step: "0.5", description: t("balances.adjustDesc") }]} defaultValues={{ employeeId: e.id, leaveTypeId: dlg?.row?.leaveTypeId ?? "", year: dlg?.row?.year ?? new Date().getUTCFullYear(), carried: Number(dlg?.row?.carried ?? 0), adjusted: Number(dlg?.row?.adjusted ?? 0) }} action={adjustBalanceAction} onSuccess={() => { setDlg(null); router.refresh(); }} />
    </>
  );
}
