"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntityDialog } from "@/components/forms/entity-dialog";
import { createRunAction } from "@/modules/hr/actions";

export function NewRunButton({ branches, defaults }: { branches: { value: string; label: string }[]; defaults: { periodYear: number; periodMonth: number; payDate: string } }) {
  const t = useTranslations("hr"); const tf = useTranslations("fields");
  const locale = useLocale(); const router = useRouter();
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus /> {t("payroll.new")}</Button>
      <EntityDialog open={open} onOpenChange={setOpen} title={t("payroll.new")} size="md" fields={[
        { name: "periodYear", label: t("year"), type: "number", required: true }, { name: "periodMonth", label: t("month"), type: "select", required: true, options: Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1).padStart(2, "0") })) },
        { name: "payDate", label: t("payDate"), type: "date", required: true }, { name: "branchId", label: tf("branch"), type: "select", options: branches },
        { name: "notes", label: tf("notes"), type: "textarea", colSpan: 2 },
      ]} defaultValues={{ ...defaults, periodMonth: String(defaults.periodMonth), branchId: "", notes: "" }} action={createRunAction} onSuccess={(d) => router.push(`/${locale}/hr/payroll/${(d as { id: string }).id}`)} />
    </>
  );
}
