"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Calculator, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, FilterDef, PagedResult } from "@/components/data-table/types";
import { EntityDialog, type FieldConfig } from "@/components/forms/entity-dialog";
import { CrudList } from "@/components/forms/crud-list";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { useToast } from "@/components/ui/toast";
import { removeCategoryAction, runDepreciationAction, saveAssetAction, saveCategoryAction } from "@/modules/finance/actions";
import type { FinanceLookups, Opt } from "@/modules/finance/_shared/lookups";

type Row = Record<string, unknown>;
type Cat = { id: string; code: string; nameAr: string; nameEn: string; assetAccountId: string; accumDepAccountId: string; depExpenseAccountId: string; method: string; lifeMonths: number; rate: number; isActive: boolean };

export function AssetsClient({ data, columns, categories, categoryOptions, lookups, can, filters }: { data: PagedResult<Row>; columns: ColumnDef[]; categories: Cat[]; categoryOptions: Opt[]; lookups: FinanceLookups; can: { create: boolean; edit: boolean; delete: boolean; approve: boolean }; filters: FilterDef[] }) {
  const t = useTranslations("finance");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const te = useTranslations("enums");
  const locale = useLocale();
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [month, setMonth] = React.useState(() => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); });
  const methods = [{ value: "STRAIGHT_LINE", label: te("DepreciationMethod.STRAIGHT_LINE") }, { value: "DECLINING_BALANCE", label: te("DepreciationMethod.DECLINING_BALANCE") }];
  const assetAccounts = lookups.accounts.filter((a) => a.meta?.type === "ASSET");
  const expenseAccounts = lookups.accounts.filter((a) => a.meta?.type === "EXPENSE");
  const liabilityOrAsset = lookups.accounts.filter((a) => a.meta?.type === "LIABILITY" || a.meta?.type === "ASSET");

  const assetFields: FieldConfig[] = [
    { name: "categoryId", label: tf("category"), type: "select", options: categoryOptions, required: true },
    { name: "number", label: tf("number"), placeholder: "auto", dir: "ltr" },
    { name: "nameAr", label: tf("nameAr"), required: true, dir: "rtl" },
    { name: "nameEn", label: tf("nameEn"), required: true, dir: "ltr" },
    { name: "acquisitionDate", label: t("acquisitionDate"), type: "date", required: true },
    { name: "depreciationStart", label: t("depreciationStart"), type: "date", required: true },
    { name: "cost", label: t("cost"), type: "number", required: true },
    { name: "salvage", label: t("salvage"), type: "number" },
    { name: "method", label: t("depMethod"), type: "select", options: methods, required: true },
    { name: "lifeMonths", label: t("lifeMonths"), type: "number", required: true },
    { name: "rate", label: t("dbRate"), type: "number", visibleWhen: { field: "method", equals: "DECLINING_BALANCE" } },
    { name: "serial", label: t("serial"), dir: "ltr" },
    { name: "location", label: t("location") },
    { name: "branchId", label: tf("branch"), type: "select", options: lookups.branches },
    { name: "costCenterId", label: tf("costCenter"), type: "select", options: lookups.costCenters },
    { name: "vendorId", label: t("vendor"), type: "select", options: lookups.vendors },
    { name: "postAcquisition", label: t("postAcquisition"), type: "switch", description: t("postAcquisitionHint") },
    { name: "creditAccountId", label: t("creditAccount"), type: "select", options: liabilityOrAsset, visibleWhen: { field: "postAcquisition", equals: "true" } },
    { name: "notes", label: tc("notes"), type: "textarea", colSpan: 2 },
  ];
  const defaultCat = categories[0];

  return (
    <Tabs defaultValue="register">
      <TabsList>
        <TabsTrigger value="register">{t("assets.register")}</TabsTrigger>
        <TabsTrigger value="categories">{t("assets.categories")}</TabsTrigger>
      </TabsList>
      <TabsContent value="register">
        <DataTable
          tableKey="assets"
          columns={columns}
          data={data}
          filters={filters}
          exportResource="assets"
          rowHrefTemplate="/finance/assets/{id}"
          toolbar={
            <>
              {can.approve && (
                <div className="flex items-center gap-1">
                  <Input type="month" dir="ltr" value={month} onChange={(e) => setMonth(e.target.value)} className="h-8 w-40" />
                  <ConfirmButton title={t("runDepreciation")} description={`${t("runDepreciation")} ${month}`} action={() => runDepreciationAction(month)} variant="secondary" size="sm" onSuccess={(d) => { const r = d as { posted: number; amount: number; entryNumber?: string }; toast.info(`${r.posted} · ${r.amount.toFixed(2)} ${r.entryNumber ?? ""}`); router.refresh(); }}>
                    <Calculator /> {t("runDepreciation")}
                  </ConfirmButton>
                </div>
              )}
              {can.create && categories.length > 0 && <Button size="sm" onClick={() => setOpen(true)}><Plus /> {t("assets.new")}</Button>}
            </>
          }
        />
        <EntityDialog open={open} onOpenChange={setOpen} title={t("assets.new")} fields={assetFields} size="xl" defaultValues={{ categoryId: defaultCat?.id ?? "", acquisitionDate: new Date().toISOString().slice(0, 10), depreciationStart: new Date().toISOString().slice(0, 10), cost: "", salvage: 0, method: defaultCat?.method ?? "STRAIGHT_LINE", lifeMonths: defaultCat?.lifeMonths ?? 60, rate: defaultCat?.rate ?? 20, postAcquisition: false }} action={saveAssetAction} onSuccess={(d) => router.push(`/${locale}/finance/assets/${(d as { id: string }).id}`)} />
      </TabsContent>
      <TabsContent value="categories">
        <CrudList
          tableKey="asset-categories"
          columns={[
            { key: "code", label: tf("code") },
            { key: "name", label: tf("name"), bilingual: "name" },
            { key: "method", label: t("depMethod"), type: "enum", enumName: "DepreciationMethod" },
            { key: "lifeMonths", label: t("lifeMonths"), type: "number", align: "end" },
            { key: "rate", label: t("dbRate"), type: "number", align: "end" },
            { key: "isActive", label: tf("isActive"), type: "boolean", align: "center" },
          ]}
          data={{ rows: categories as unknown as Row[], total: categories.length, page: 1, pageSize: 100 }}
          fields={[
            { name: "code", label: tf("code"), required: true, dir: "ltr" },
            { name: "method", label: t("depMethod"), type: "select", options: methods, required: true },
            { name: "nameAr", label: tf("nameAr"), required: true, dir: "rtl" },
            { name: "nameEn", label: tf("nameEn"), required: true, dir: "ltr" },
            { name: "lifeMonths", label: t("lifeMonths"), type: "number", required: true },
            { name: "rate", label: t("dbRate"), type: "number" },
            { name: "assetAccountId", label: t("assetAccount"), type: "select", options: assetAccounts, required: true },
            { name: "accumDepAccountId", label: t("accumDepAccount"), type: "select", options: assetAccounts, required: true },
            { name: "depExpenseAccountId", label: t("depExpenseAccount"), type: "select", options: expenseAccounts, required: true, colSpan: 2 },
            { name: "isActive", label: tf("isActive"), type: "switch" },
          ]}
          titleNew={t("assets.newCategory")}
          titleEdit={t("assets.editCategory")}
          newDefaults={{ method: "STRAIGHT_LINE", lifeMonths: 60, rate: 20, isActive: true }}
          saveAction={saveCategoryAction}
          removeAction={removeCategoryAction}
          can={can}
          dialogSize="lg"
        />
        <span className="hidden"><Trash2 /></span>
      </TabsContent>
    </Tabs>
  );
}
