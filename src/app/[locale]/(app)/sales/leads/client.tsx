"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ArrowRightCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, PagedResult } from "@/components/data-table/types";
import { EntityDialog } from "@/components/forms/entity-dialog";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { convertLeadAction, removeLeadAction, saveLeadAction } from "@/modules/sales/actions";

type Opt = { value: string; label: string };
type Row = Record<string, unknown>;

export function LeadsClient({ data, columns, statuses, salespersons, branches, can, canConvert }: { data: PagedResult<Row>; columns: ColumnDef[]; statuses: Opt[]; salespersons: Opt[]; branches: Opt[]; can: { create: boolean; edit: boolean; delete: boolean }; canConvert: boolean }) {
  const t = useTranslations("sales");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Row | null>(null);
  const defaults = React.useMemo(() => {
    if (!editing) return { status: "NEW" };
    const d: Record<string, unknown> = { ...editing };
    for (const k of Object.keys(d)) if (d[k] === null) d[k] = "";
    return d;
  }, [editing]);
  return (
    <>
      <DataTable tableKey="leads" columns={columns} data={data} exportResource="leads" filters={[{ key: "status", label: tf("status"), type: "select", options: statuses }, { key: "ownerId", label: t("owner"), type: "select", options: salespersons }]} onRowClick={can.edit ? (r) => { setEditing(r); setOpen(true); } : undefined} toolbar={can.create && <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus /> {t("leads.new")}</Button>} />
      <EntityDialog open={open} onOpenChange={setOpen} title={editing ? t("leads.edit") : t("leads.new")} size="lg" defaultValues={defaults} action={saveLeadAction} fields={[
        { name: "nameAr", label: tf("nameAr"), required: true, dir: "rtl" },
        { name: "nameEn", label: tf("nameEn"), required: true, dir: "ltr" },
        { name: "companyName", label: t("companyName") },
        { name: "contactPerson", label: tf("contactPerson") },
        { name: "email", label: tf("email"), type: "email" },
        { name: "phone", label: tf("phone"), dir: "ltr" },
        { name: "source", label: t("source"), placeholder: "Website / Referral / Exhibition" },
        { name: "status", label: tf("status"), type: "select", options: statuses, required: true },
        { name: "ownerId", label: t("owner"), type: "select", options: salespersons },
        { name: "branchId", label: tf("branch"), type: "select", options: branches },
        { name: "notes", label: tc("notes"), type: "textarea", colSpan: 2 },
      ]}>
        {editing && (
          <div className="flex flex-wrap gap-2">
            {canConvert && editing.status !== "CONVERTED" && <ConfirmButton title={t("leads.convert")} description={t("leads.convertHint")} action={() => convertLeadAction(String(editing.id))} variant="secondary" size="sm" onSuccess={(d) => router.push(`/${locale}/sales/opportunities/${(d as { opportunityId: string }).opportunityId}`)}><ArrowRightCircle /> {t("leads.convert")}</ConfirmButton>}
            {can.delete && <ConfirmButton title={tc("deleteConfirmTitle")} action={() => removeLeadAction(String(editing.id))} variant="ghost" size="sm" onSuccess={() => setOpen(false)}><Trash2 className="text-destructive" /></ConfirmButton>}
          </div>
        )}
      </EntityDialog>
    </>
  );
}
