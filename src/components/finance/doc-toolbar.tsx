"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Printer, FileDown } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { STATUS_TONES } from "@/modules/finance/_shared/constants";

/** Status badge for DocStatus values. */
export function DocStatus({ status }: { status: string }) {
  const te = useTranslations("enums.DocStatus");
  return <Badge variant={STATUS_TONES[status] ?? "outline"}>{te.has(status) ? te(status) : status}</Badge>;
}

/** Print / download links for a registered document PDF. */
export function PdfButtons({ doc, id, disabled }: { doc: string; id: string; disabled?: boolean }) {
  const t = useTranslations("common");
  const locale = useLocale();
  if (disabled) return null;
  return (
    <>
      <Button variant="outline" size="sm" asChild>
        <a href={`/api/pdf/${doc}/${id}?locale=${locale}`} target="_blank" rel="noreferrer">
          <Printer /> {t("print")}
        </a>
      </Button>
      <Button variant="ghost" size="sm" asChild>
        <a href={`/api/pdf/${doc}/${id}?locale=${locale}&download=1`}>
          <FileDown /> PDF
        </a>
      </Button>
    </>
  );
}

export function JournalLink({ id, number }: { id: string | null; number?: string | null }) {
  const t = useTranslations("finance");
  if (!id) return null;
  return (
    <Link href={`/finance/journals/${id}`} className="text-primary hover:underline text-sm" dir="ltr">
      {t("journalEntry")}: {number ?? id}
    </Link>
  );
}
