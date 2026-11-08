"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ArrowLeft, Edit, PackageX, Trash2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EntityDialog } from "@/components/forms/entity-dialog";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { AttachmentsPanel, type AttachmentItem } from "@/components/attachments/attachments-panel";
import { disposeAssetAction, removeAssetAction, saveAssetAction } from "@/modules/finance/actions";
import type { FinanceLookups } from "@/modules/finance/_shared/lookups";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";

type Asset = Record<string, unknown> & { id: string; number: string; status: string; cost: number; salvage: number; accumulated: number; method: string; lifeMonths: number; rate: number; acquisitionDate: string; depreciationStart: string; disposalDate: string | null; disposalAmount: number | null; acquisitionEntryId: string | null; disposalEntryId: string | null; depreciation: { id: string; periodDate: string; amount: number; accumulatedAfter: number; journalEntryId: string | null }[] };

export function AssetDetail({ asset, schedule, lookups, can, attachments, canAttach, labels }: { asset: Asset; schedule: { period: string; amount: number; accumulated: number; netBook: number }[]; lookups: FinanceLookups; can: { edit: boolean; delete: boolean; approve: boolean }; attachments: AttachmentItem[]; canAttach: { upload: boolean; delete: boolean }; labels: { title: string } }) {
  const t = useTranslations("finance");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const te = useTranslations("enums");
  const locale = useLocale();
  const router = useRouter();
  const [edit, setEdit] = React.useState(false);
  const [dispose, setDispose] = React.useState(false);
  const nbv = asset.cost - asset.accumulated;
  const locked = asset.accumulated > 0 || asset.status === "DISPOSED";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" asChild><Link href="/finance/assets"><ArrowLeft className="rtl:rotate-180" /> {labels.title}</Link></Button>
        <Badge variant={asset.status === "ACTIVE" ? "success" : asset.status === "DISPOSED" ? "secondary" : "info"}>{te(`AssetStatus.${asset.status}`)}</Badge>
        <div className="ms-auto flex gap-2">
          {can.edit && asset.status !== "DISPOSED" && <Button size="sm" variant="outline" onClick={() => setEdit(true)}><Edit /> {tc("edit")}</Button>}
          {can.approve && asset.status !== "DISPOSED" && <Button size="sm" variant="secondary" onClick={() => setDispose(true)}><PackageX /> {t("dispose")}</Button>}
          {can.delete && !locked && <ConfirmButton title={tc("deleteConfirmTitle")} action={() => removeAssetAction(asset.id)} variant="ghost" size="sm" onSuccess={() => router.push(`/${locale}/finance/assets`)}><Trash2 className="text-destructive" /></ConfirmButton>}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">{t("cost")}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold tabular-nums" dir="ltr">{formatMoney(asset.cost, locale)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">{t("accumulated")}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold tabular-nums" dir="ltr">{formatMoney(asset.accumulated, locale)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">{t("netBook")}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold tabular-nums" dir="ltr">{formatMoney(nbv, locale)}</CardContent></Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">{tc("details")}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-y-1 text-sm">
            <span className="text-muted-foreground">{t("acquisitionDate")}</span><span dir="ltr">{formatDate(asset.acquisitionDate, locale)}</span>
            <span className="text-muted-foreground">{t("depreciationStart")}</span><span dir="ltr">{formatDate(asset.depreciationStart, locale)}</span>
            <span className="text-muted-foreground">{t("depMethod")}</span><span>{te(`DepreciationMethod.${asset.method}`)}</span>
            <span className="text-muted-foreground">{t("lifeMonths")}</span><span dir="ltr">{asset.lifeMonths}</span>
            {asset.method === "DECLINING_BALANCE" && <><span className="text-muted-foreground">{t("dbRate")}</span><span dir="ltr">{asset.rate}%</span></>}
            <span className="text-muted-foreground">{t("salvage")}</span><span dir="ltr">{formatMoney(asset.salvage, locale)}</span>
            <span className="text-muted-foreground">{t("serial")}</span><span dir="ltr">{String(asset.serial ?? "—")}</span>
            <span className="text-muted-foreground">{t("location")}</span><span>{String(asset.location ?? "—")}</span>
            {asset.disposalDate && <><span className="text-muted-foreground">{t("disposalDate")}</span><span dir="ltr">{formatDate(asset.disposalDate, locale)} · {formatMoney(asset.disposalAmount ?? 0, locale)}</span></>}
            {asset.acquisitionEntryId && <><span className="text-muted-foreground">{t("journalEntry")}</span><Link href={`/finance/journals/${asset.acquisitionEntryId}`} className="text-primary hover:underline">{t("acquisitionEntry")}</Link></>}
            {asset.disposalEntryId && <><span className="text-muted-foreground">{t("journalEntry")}</span><Link href={`/finance/journals/${asset.disposalEntryId}`} className="text-primary hover:underline">{t("disposalEntry")}</Link></>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">{t("depreciationHistory")}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>{tf("period")}</TableHead><TableHead className="text-end">{tf("amount")}</TableHead><TableHead className="text-end">{t("accumulated")}</TableHead><TableHead>{t("journalEntry")}</TableHead></TableRow></TableHeader>
              <TableBody>
                {asset.depreciation.length === 0 && <TableRow><TableCell colSpan={4} className="h-12 text-center text-muted-foreground">—</TableCell></TableRow>}
                {asset.depreciation.map((d) => (
                  <TableRow key={d.id}><TableCell dir="ltr">{d.periodDate.slice(0, 7)}</TableCell><TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(d.amount, locale)}</TableCell><TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(d.accumulatedAfter, locale)}</TableCell><TableCell>{d.journalEntryId && <Link href={`/finance/journals/${d.journalEntryId}`} className="text-primary hover:underline">→</Link>}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("depreciationSchedule")}</CardTitle></CardHeader>
        <CardContent className="max-h-80 overflow-auto">
          <Table>
            <TableHeader><TableRow><TableHead>{tf("period")}</TableHead><TableHead className="text-end">{tf("amount")}</TableHead><TableHead className="text-end">{t("accumulated")}</TableHead><TableHead className="text-end">{t("netBook")}</TableHead></TableRow></TableHeader>
            <TableBody>{schedule.map((s) => <TableRow key={s.period}><TableCell dir="ltr">{s.period}</TableCell><TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(s.amount, locale)}</TableCell><TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(s.accumulated, locale)}</TableCell><TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(s.netBook, locale)}</TableCell></TableRow>)}</TableBody>
          </Table>
        </CardContent>
      </Card>
      <AttachmentsPanel entityType="FixedAsset" entityId={asset.id} items={attachments} canUpload={canAttach.upload} canDelete={canAttach.delete} />

      <EntityDialog open={edit} onOpenChange={setEdit} title={tc("edit")} size="lg" fields={[
        { name: "nameAr", label: tf("nameAr"), required: true, dir: "rtl" },
        { name: "nameEn", label: tf("nameEn"), required: true, dir: "ltr" },
        { name: "serial", label: t("serial"), dir: "ltr" },
        { name: "location", label: t("location") },
        { name: "branchId", label: tf("branch"), type: "select", options: lookups.branches },
        { name: "costCenterId", label: tf("costCenter"), type: "select", options: lookups.costCenters },
        ...(locked ? [] : [
          { name: "acquisitionDate", label: t("acquisitionDate"), type: "date" as const, required: true },
          { name: "depreciationStart", label: t("depreciationStart"), type: "date" as const, required: true },
          { name: "cost", label: t("cost"), type: "number" as const, required: true },
          { name: "salvage", label: t("salvage"), type: "number" as const },
          { name: "lifeMonths", label: t("lifeMonths"), type: "number" as const, required: true },
          { name: "rate", label: t("dbRate"), type: "number" as const },
        ]),
        { name: "notes", label: tc("notes"), type: "textarea", colSpan: 2 },
      ]} defaultValues={{ ...asset, acquisitionDate: asset.acquisitionDate.slice(0, 10), depreciationStart: asset.depreciationStart.slice(0, 10), categoryId: asset.categoryId, method: asset.method, depreciation: undefined, category: undefined }} action={saveAssetAction} />

      <EntityDialog open={dispose} onOpenChange={setDispose} title={t("dispose")} size="sm" columns={1} fields={[
        { name: "disposalDate", label: t("disposalDate"), type: "date", required: true },
        { name: "disposalAmount", label: t("disposalProceeds"), type: "number", required: true },
        { name: "proceedsAccountId", label: t("proceedsAccount"), type: "select", options: lookups.accounts.filter((a) => a.meta?.type === "ASSET") },
      ]} defaultValues={{ id: asset.id, disposalDate: new Date().toISOString().slice(0, 10), disposalAmount: 0 }} action={disposeAssetAction} />
    </div>
  );
}
