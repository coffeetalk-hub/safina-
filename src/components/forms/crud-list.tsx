"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, FilterDef, PagedResult } from "@/components/data-table/types";
import { EntityDialog, type FieldConfig } from "./entity-dialog";
import { ConfirmButton } from "./confirm-button";
import type { ActionResult } from "@/core/action";

type Row = Record<string, unknown>;

export type CrudListProps = {
  tableKey: string;
  columns: ColumnDef[];
  data: PagedResult<Row>;
  filters?: FilterDef[];
  exportResource?: string;
  fields: FieldConfig[];
  titleNew: string;
  titleEdit: string;
  /** Default values for a new record. Editing uses the row itself. */
  newDefaults: Record<string, unknown>;
  saveAction: (input: unknown) => Promise<ActionResult>;
  removeAction?: (id: string) => Promise<ActionResult>;
  can: { create: boolean; edit: boolean; delete: boolean };
  dialogSize?: "sm" | "md" | "lg" | "xl";
  extraToolbar?: React.ReactNode;
  rowHrefTemplate?: string;
  /** Row → form defaults mapping for date fields: list of keys to convert ISO datetime → yyyy-mm-dd */
  dateFields?: string[];
};

export function CrudList(p: CrudListProps) {
  const t = useTranslations("common");
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Row | null>(null);

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (row: Row) => {
    setEditing(row);
    setOpen(true);
  };

  const defaults = React.useMemo(() => {
    if (!editing) return p.newDefaults;
    const d: Record<string, unknown> = { ...editing };
    for (const k of p.dateFields ?? []) if (typeof d[k] === "string") d[k] = (d[k] as string).slice(0, 10);
    for (const f of p.fields) if (d[f.name] === null) d[f.name] = "";
    return d;
  }, [editing, p.newDefaults, p.dateFields, p.fields]);

  return (
    <>
      <DataTable
        tableKey={p.tableKey}
        columns={p.columns}
        data={p.data}
        filters={p.filters}
        exportResource={p.exportResource}
        onRowClick={p.rowHrefTemplate ? undefined : p.can.edit ? openEdit : undefined}
        rowHrefTemplate={p.rowHrefTemplate}
        toolbar={
          <>
            {p.extraToolbar}
            {p.can.create && (
              <Button size="sm" onClick={openNew}>
                <Plus /> {t("new")}
              </Button>
            )}
          </>
        }
      />
      <EntityDialog open={open} onOpenChange={setOpen} title={editing ? p.titleEdit : p.titleNew} fields={p.fields} defaultValues={defaults} action={p.saveAction} size={p.dialogSize}>
        {editing && p.can.delete && p.removeAction && (
          <div className="flex justify-start">
            <ConfirmButton title={t("deleteConfirmTitle")} description={t("deleteConfirmDesc")} action={() => p.removeAction!(String(editing.id))} variant="ghost" size="sm" onSuccess={() => setOpen(false)}>
              <Trash2 className="text-destructive" /> <span className="text-destructive">{t("delete")}</span>
            </ConfirmButton>
          </div>
        )}
      </EntityDialog>
    </>
  );
}
