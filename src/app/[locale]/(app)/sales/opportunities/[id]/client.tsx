"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Edit, FileText, Plus, Trash2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EntityDialog } from "@/components/forms/entity-dialog";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { AttachmentsPanel, type AttachmentItem } from "@/components/attachments/attachments-panel";
import { PageHeader } from "@/components/shell/page-header";
import { deleteActivityAction, removeOpportunityAction, saveActivityAction, saveOpportunityAction, toggleActivityAction } from "@/modules/sales/actions";
import type { FinanceLookups } from "@/modules/finance/_shared/lookups";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Opt = { value: string; label: string };
type Activity = { id: string; type: string; subject: string; details: string | null; dueAt: string | null; doneAt: string | null; assigneeId: string | null; createdAt: string };
type Opp = Record<string, unknown> & { id: string; titleAr: string; titleEn: string; amount: number; currencyCode: string; probability: number; expectedClose: string | null; stageId: string; customerId: string | null; ownerId: string | null; source: string | null; notes: string | null; closedAt: string | null; stage: { nameAr: string; nameEn: string; isWon: boolean; isLost: boolean }; customer: { id: string; nameAr: string; nameEn: string } | null; activities: Activity[]; quotations: { id: string; number: string; status: string; total: number; quoteDate: string }[] };

export function OpportunityDetail({ opp, lookups, stages, users, can, canQuote, attachments, canAttach }: { opp: Opp; lookups: FinanceLookups; stages: Opt[]; users: Opt[]; can: { edit: boolean; delete: boolean }; canQuote: boolean; attachments: AttachmentItem[]; canAttach: { upload: boolean; delete: boolean } }) {
  const t = useTranslations("sales");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const te = useTranslations("enums");
  const locale = useLocale();
  const router = useRouter();
  const [edit, setEdit] = React.useState(false);
  const [actOpen, setActOpen] = React.useState(false);
  const [act, setAct] = React.useState<Activity | null>(null);
  const types = ["CALL", "MEETING", "EMAIL", "TASK", "NOTE"].map((v) => ({ value: v, label: te(`ActivityType.${v}`) }));
  return (
    <>
      <PageHeader title={locale === "ar" ? opp.titleAr : opp.titleEn} description={opp.customer ? (locale === "ar" ? opp.customer.nameAr : opp.customer.nameEn) : undefined} actions={<><Button variant="ghost" size="sm" asChild><Link href="/sales/pipeline"><ArrowLeft className="rtl:rotate-180" /> {t("pipeline.title")}</Link></Button><Badge variant={opp.stage.isWon ? "success" : opp.stage.isLost ? "destructive" : "info"}>{locale === "ar" ? opp.stage.nameAr : opp.stage.nameEn} · {opp.probability}%</Badge></>} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-base flex items-center justify-between">{tc("details")} {can.edit && <Button size="sm" variant="outline" onClick={() => setEdit(true)}><Edit /> {tc("edit")}</Button>}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-y-1 text-sm">
            <span className="text-muted-foreground">{tf("amount")}</span><span className="font-semibold tabular-nums" dir="ltr">{formatMoney(opp.amount, locale, opp.currencyCode)}</span>
            <span className="text-muted-foreground">{t("expectedClose")}</span><span dir="ltr">{formatDate(opp.expectedClose, locale) || "—"}</span>
            <span className="text-muted-foreground">{t("owner")}</span><span>{lookups.salespersons.find((s) => s.value === opp.ownerId)?.label ?? "—"}</span>
            <span className="text-muted-foreground">{t("source")}</span><span>{opp.source ?? "—"}</span>
            {opp.closedAt && <><span className="text-muted-foreground">{t("closedAt")}</span><span dir="ltr">{formatDate(opp.closedAt, locale)}</span></>}
            {opp.notes && <div className="col-span-2 mt-2 text-muted-foreground whitespace-pre-wrap">{opp.notes}</div>}
            <div className="col-span-2 mt-3 flex flex-wrap gap-2">
              {canQuote && opp.customerId && <Button size="sm" asChild><Link href={`/sales/quotations/new?customerId=${opp.customerId}&opportunityId=${opp.id}`}><FileText /> {t("quotations.new")}</Link></Button>}
              {can.delete && <ConfirmButton title={tc("deleteConfirmTitle")} action={() => removeOpportunityAction(opp.id)} variant="ghost" size="sm" onSuccess={() => router.push(`/${locale}/sales/pipeline`)}><Trash2 className="text-destructive" /></ConfirmButton>}
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base flex items-center justify-between">{t("activities")} {can.edit && <Button size="sm" variant="outline" onClick={() => { setAct(null); setActOpen(true); }}><Plus /> {t("newActivity")}</Button>}</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y">
              {opp.activities.length === 0 && <li className="py-4 text-sm text-muted-foreground">{tc("noData")}</li>}
              {opp.activities.map((a) => (
                <li key={a.id} className={cn("flex items-start gap-3 py-2 text-sm", a.doneAt && "opacity-60")}>
                  <button className={cn("mt-0.5 size-5 rounded border flex items-center justify-center shrink-0", a.doneAt && "bg-emerald-500 border-emerald-500 text-white")} onClick={() => toggleActivityAction(a.id).then(() => router.refresh())} title={t("markDone")}>{a.doneAt && <Check className="size-3" />}</button>
                  <div className="min-w-0 flex-1 cursor-pointer" onClick={() => { setAct(a); setActOpen(true); }}>
                    <div className="flex items-center gap-2"><Badge variant="outline">{te(`ActivityType.${a.type}`)}</Badge><span className={cn("font-medium", a.doneAt && "line-through")}>{a.subject}</span></div>
                    {a.details && <div className="text-muted-foreground text-xs whitespace-pre-wrap">{a.details}</div>}
                    <div className="text-xs text-muted-foreground" dir="ltr">{a.dueAt ? `${t("due")}: ${formatDateTime(a.dueAt, locale)}` : formatDateTime(a.createdAt, locale)} {a.assigneeId ? `· ${users.find((u) => u.value === a.assigneeId)?.label ?? ""}` : ""}</div>
                  </div>
                  {can.delete && <ConfirmButton title={tc("deleteConfirmTitle")} action={() => deleteActivityAction(a.id)} variant="ghost" size="icon-sm"><Trash2 className="size-3.5 text-destructive" /></ConfirmButton>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader><CardTitle className="text-base">{t("quotations.title")}</CardTitle></CardHeader>
          <CardContent>
            {opp.quotations.length === 0 ? <p className="text-sm text-muted-foreground">{tc("noData")}</p> : (
              <ul className="text-sm divide-y">{opp.quotations.map((q) => <li key={q.id} className="flex items-center justify-between py-2"><Link href={`/sales/quotations/${q.id}`} className="text-primary hover:underline" dir="ltr">{q.number}</Link><span dir="ltr">{formatDate(q.quoteDate, locale)}</span><span className="tabular-nums" dir="ltr">{formatMoney(q.total, locale)}</span><Badge variant="outline">{te(`QuoteStatus.${q.status}`)}</Badge></li>)}</ul>
            )}
          </CardContent>
        </Card>
        <div className="lg:col-span-3"><AttachmentsPanel entityType="Opportunity" entityId={opp.id} items={attachments} canUpload={canAttach.upload} canDelete={canAttach.delete} /></div>
      </div>
      <EntityDialog open={edit} onOpenChange={setEdit} title={tc("edit")} size="lg" defaultValues={{ id: opp.id, titleAr: opp.titleAr, titleEn: opp.titleEn, customerId: opp.customerId ?? "", stageId: opp.stageId, amount: opp.amount, currencyCode: opp.currencyCode, expectedClose: opp.expectedClose?.slice(0, 10) ?? "", ownerId: opp.ownerId ?? "", source: opp.source ?? "", notes: opp.notes ?? "", lostReason: String(opp.lostReason ?? "") }} action={saveOpportunityAction} fields={[
        { name: "titleAr", label: t("titleAr"), required: true, dir: "rtl" },
        { name: "titleEn", label: t("titleEn"), required: true, dir: "ltr" },
        { name: "customerId", label: t("customer"), type: "select", options: lookups.customers },
        { name: "stageId", label: t("stage"), type: "select", options: stages, required: true },
        { name: "amount", label: tf("amount"), type: "number" },
        { name: "currencyCode", label: tf("currency"), type: "select", options: lookups.currencies, required: true },
        { name: "expectedClose", label: t("expectedClose"), type: "date" },
        { name: "ownerId", label: t("owner"), type: "select", options: lookups.salespersons },
        { name: "source", label: t("source") },
        { name: "lostReason", label: t("lostReason") },
        { name: "notes", label: tc("notes"), type: "textarea", colSpan: 2 },
      ]} />
      <EntityDialog open={actOpen} onOpenChange={setActOpen} title={act ? tc("edit") : t("newActivity")} size="md" defaultValues={act ? { id: act.id, opportunityId: opp.id, type: act.type, subject: act.subject, details: act.details ?? "", dueAt: act.dueAt?.slice(0, 16) ?? "", assigneeId: act.assigneeId ?? "", done: !!act.doneAt } : { opportunityId: opp.id, type: "TASK", done: false }} action={saveActivityAction} fields={[
        { name: "type", label: tf("type"), type: "select", options: types, required: true },
        { name: "assigneeId", label: t("assignee"), type: "select", options: users },
        { name: "subject", label: t("subject"), required: true, colSpan: 2 },
        { name: "details", label: tc("details"), type: "textarea", colSpan: 2 },
        { name: "dueAt", label: t("due"), type: "date" },
        { name: "done", label: t("done"), type: "switch" },
      ]} />
    </>
  );
}
