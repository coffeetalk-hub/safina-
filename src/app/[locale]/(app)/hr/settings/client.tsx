"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CrudList } from "@/components/forms/crud-list";
import type { ColumnDef, PagedResult } from "@/components/data-table/types";
import { useToast } from "@/components/ui/toast";
import { saveHrSettingsAction, saveGosiRateAction, removeGosiRateAction, savePayComponentAction, removePayComponentAction, saveHolidayAction, removeHolidayAction } from "@/modules/hr/actions";

type Row = Record<string, unknown>;
type Opt = { value: string; label: string };

export function HrSettingsClient({ tab, settings, rates, comps, hols, columns, accounts, can }: { tab: string; settings: Row; rates: PagedResult<Row>; comps: PagedResult<Row>; hols: PagedResult<Row>; columns: { rates: ColumnDef[]; comps: ColumnDef[]; hols: ColumnDef[] }; accounts: Opt[]; can: { create: boolean; edit: boolean; delete: boolean } }) {
  const t = useTranslations("hr"); const tf = useTranslations("fields"); const tc = useTranslations("common"); const te = useTranslations("errors"); const tk = useTranslations("enums");
  const toast = useToast(); const router = useRouter();
  const [s, setS] = React.useState<Record<string, string>>(Object.fromEntries(Object.entries(settings).map(([k, v]) => [k, v == null ? "" : String(v)])));
  const [busy, setBusy] = React.useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setS({ ...s, [k]: e.target.value });
  const save = async () => { setBusy(true); const r = await saveHrSettingsAction(s); setBusy(false); if (r.ok) { toast.success(tc("saved")); router.refresh(); } else toast.error(r.fieldErrors ? Object.entries(r.fieldErrors).map(([k, v]) => `${k}: ${v[0]}`).join("; ") : te.has(r.error) ? te(r.error) : r.error); };
  const num = (k: string, label: string, step = "1", hint?: string) => <div className="space-y-1"><Label>{label}</Label><Input type="number" step={step} dir="ltr" value={s[k] ?? ""} disabled={!can.edit} onChange={set(k)} />{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>;
  const basisSel = (k: string, label: string) => <div className="space-y-1"><Label>{label}</Label><Select value={s[k]} disabled={!can.edit} onValueChange={(v) => setS({ ...s, [k]: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["BASIC", "BASIC_HOUSING", "FULL"].map((b) => <SelectItem key={b} value={b}>{t(`eos.basis.${b}`)}</SelectItem>)}</SelectContent></Select></div>;
  const pct = (name: string, label: string) => ({ name, label, type: "number" as const, step: "0.01" });
  return (
    <Tabs defaultValue={["rules", "gosi", "components", "holidays"].includes(tab) ? tab : "rules"}>
      <TabsList className="flex-wrap h-auto"><TabsTrigger value="rules">{t("settings.rules")}</TabsTrigger><TabsTrigger value="gosi">{t("settings.gosi")}</TabsTrigger><TabsTrigger value="components">{t("settings.components")}</TabsTrigger><TabsTrigger value="holidays">{t("holidays.title")}</TabsTrigger></TabsList>
      <TabsContent value="rules">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card><CardHeader><CardTitle className="text-base">{t("settings.workTime")}</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label>{t("settings.workStart")}</Label><Input type="time" dir="ltr" value={s.workStart} disabled={!can.edit} onChange={set("workStart")} /></div>
            <div className="space-y-1"><Label>{t("settings.workEnd")}</Label><Input type="time" dir="ltr" value={s.workEnd} disabled={!can.edit} onChange={set("workEnd")} /></div>
            {num("dailyHours", t("settings.dailyHours"), "0.5")}{num("graceMinutes", t("settings.graceMinutes"))}
            <div className="space-y-1"><Label>{t("settings.weekendDays")}</Label><Input dir="ltr" value={s.weekendDays} disabled={!can.edit} onChange={set("weekendDays")} placeholder="FRI,SAT" /></div>
            {num("overtimeMultiplier", t("settings.overtimeMultiplier"), "0.05", t("settings.overtimeHint"))}{num("daysPerMonth", t("settings.daysPerMonth"), "1", t("settings.daysPerMonthHint"))}{num("payDay", t("settings.payDay"))}
          </CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">{t("settings.leaveRules")}</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">
            {num("annualLeaveDays", t("settings.annualLeaveDays"), "1", t("settings.art109"))}{num("annualLeaveDaysAfter5y", t("settings.annualLeaveDaysAfter5y"))}
            {num("sickFullPayDays", t("settings.sickFullPayDays"), "1", t("settings.art117"))}{num("sickPartialPayDays", t("settings.sickPartialPayDays"))}{num("sickPartialPayPct", t("settings.sickPartialPayPct"))}{num("sickUnpaidDays", t("settings.sickUnpaidDays"))}
          </CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">{t("settings.payrollRules")}</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">
            {basisSel("gosiWageBasis", t("settings.gosiWageBasis"))}{basisSel("eosbWageBasis", t("settings.eosbWageBasis"))}
            {num("gosiMinWage", t("settings.gosiMinWage"), "1")}{num("gosiMaxWage", t("settings.gosiMaxWage"), "1")}
          </CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">WPS</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label>{t("settings.wpsEstablishmentId")}</Label><Input dir="ltr" value={s.wpsEstablishmentId ?? ""} disabled={!can.edit} onChange={set("wpsEstablishmentId")} /></div>
            <div className="space-y-1"><Label>{t("settings.wpsBankCode")}</Label><Input dir="ltr" value={s.wpsBankCode ?? ""} disabled={!can.edit} onChange={set("wpsBankCode")} /></div>
            <p className="text-xs text-muted-foreground sm:col-span-2">{t("settings.wpsHint")}</p>
          </CardContent></Card>
        </div>
        {can.edit && <div className="mt-4 flex items-center gap-3"><Button onClick={save} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Save />} {tc("save")}</Button><span className="text-xs text-muted-foreground">{t("settings.verifyNote")}</span></div>}
      </TabsContent>
      <TabsContent value="gosi">
        <p className="text-sm text-muted-foreground mb-3">{t("settings.gosiHint")}</p>
        <CrudList tableKey="hr-gosi-rates" columns={columns.rates} data={rates} exportResource="hr-gosi-rates" dialogSize="lg" dateFields={["effectiveFrom"]} titleNew={t("settings.newRate")} titleEdit={t("settings.editRate")}
          newDefaults={{ nationality: "SAUDI", effectiveFrom: new Date().toISOString().slice(0, 10), employeePension: 9, employerPension: 9, employeeSaned: 0.75, employerSaned: 0.75, employerHazard: 2 }}
          fields={[{ name: "nationality", label: t("nationality"), type: "select", required: true, options: ["SAUDI", "NON_SAUDI"].map((v) => ({ value: v, label: tk(`GosiNationality.${v}`) })) }, { name: "effectiveFrom", label: t("effectiveFrom"), type: "date", required: true }, pct("employeePension", t("gosi.employeePension")), pct("employerPension", t("gosi.employerPension")), pct("employeeSaned", t("gosi.employeeSaned")), pct("employerSaned", t("gosi.employerSaned")), pct("employerHazard", t("gosi.employerHazard"))]}
          saveAction={saveGosiRateAction} removeAction={removeGosiRateAction} can={can} />
      </TabsContent>
      <TabsContent value="components">
        <CrudList tableKey="hr-pay-components" columns={columns.comps} data={comps} exportResource="hr-pay-components" dialogSize="lg" titleNew={t("settings.newComponent")} titleEdit={t("settings.editComponent")}
          newDefaults={{ code: "", nameAr: "", nameEn: "", type: "EARNING", calc: "FIXED", defaultValue: 0, isHousing: false, accountId: "", sortOrder: 10, isActive: true }}
          fields={[{ name: "code", label: tf("code"), required: true, dir: "ltr" }, { name: "sortOrder", label: t("sortOrder"), type: "number" }, { name: "nameAr", label: tf("nameAr"), required: true, dir: "rtl" }, { name: "nameEn", label: tf("nameEn"), required: true, dir: "ltr" },
            { name: "type", label: tf("type"), type: "select", required: true, options: ["EARNING", "DEDUCTION"].map((v) => ({ value: v, label: tk(`PayComponentType.${v}`) })) }, { name: "calc", label: t("calc"), type: "select", required: true, options: ["FIXED", "PERCENT_OF_BASIC"].map((v) => ({ value: v, label: tk(`PayComponentCalc.${v}`) })) },
            { name: "defaultValue", label: t("defaultValue"), type: "number", step: "0.01" }, { name: "accountId", label: tf("accountType") === "" ? "" : t("settings.componentAccount"), type: "select", options: accounts, description: t("settings.componentAccountHint") },
            { name: "isHousing", label: t("isHousing"), type: "switch", description: t("settings.housingHint") }, { name: "isActive", label: tf("isActive"), type: "switch" }]}
          saveAction={savePayComponentAction} removeAction={removePayComponentAction} can={can} />
      </TabsContent>
      <TabsContent value="holidays">
        <CrudList tableKey="hr-holidays" columns={columns.hols} data={hols} exportResource="hr-holidays" dialogSize="md" dateFields={["date"]} titleNew={t("holidays.new")} titleEdit={t("holidays.edit")}
          newDefaults={{ date: new Date().toISOString().slice(0, 10), nameAr: "", nameEn: "" }}
          fields={[{ name: "date", label: tf("date"), type: "date", required: true, colSpan: 2 }, { name: "nameAr", label: tf("nameAr"), required: true, dir: "rtl" }, { name: "nameEn", label: tf("nameEn"), required: true, dir: "ltr" }]}
          saveAction={saveHolidayAction} removeAction={removeHolidayAction} can={can} />
      </TabsContent>
    </Tabs>
  );
}
