"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EntityDialog } from "@/components/forms/entity-dialog";
import { addRateAction, enableCurrencyAction, toggleCurrencyAction } from "@/modules/foundation/currencies/actions";
import { formatDate } from "@/lib/dates";
import { formatNumber } from "@/lib/money";

type Cur = { code: string; nameAr: string; nameEn: string; symbol: string | null; decimals: number; isActive: boolean; latestRate: { rate: number; rateDate: string } | null };
type Rate = { id: string; currencyCode: string; rateDate: string; rate: number };

export function CurrenciesClient({ currencies, rates, can }: { currencies: Cur[]; rates: Rate[]; can: { create: boolean; edit: boolean } }) {
  const t = useTranslations("foundation.currencies");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [openCur, setOpenCur] = React.useState(false);
  const [openRate, setOpenRate] = React.useState(false);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardAction>
            {can.create && (
              <Button size="sm" onClick={() => setOpenCur(true)}>
                <Plus /> {t("new")}
              </Button>
            )}
          </CardAction>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tf("code")}</TableHead>
                <TableHead>{tf("name")}</TableHead>
                <TableHead>{tf("symbol")}</TableHead>
                <TableHead className="text-end">{tf("rate")}</TableHead>
                <TableHead className="text-center">{tf("isActive")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currencies.map((c) => (
                <TableRow key={c.code}>
                  <TableCell dir="ltr" className="font-medium">
                    {c.code} {c.code === "SAR" && <Badge variant="secondary">{tf("baseCurrency")}</Badge>}
                  </TableCell>
                  <TableCell>{locale === "ar" ? c.nameAr : c.nameEn}</TableCell>
                  <TableCell>{c.symbol}</TableCell>
                  <TableCell className="text-end tabular-nums" dir="ltr">
                    {c.code === "SAR" ? "1" : c.latestRate ? `${formatNumber(c.latestRate.rate, locale, 4)} (${formatDate(c.latestRate.rateDate, locale)})` : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch checked={c.isActive} disabled={!can.edit || c.code === "SAR"} onCheckedChange={(v) => toggleCurrencyAction(c.code, v).then(() => router.refresh())} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("rates")}</CardTitle>
          <CardAction>
            {can.edit && (
              <Button size="sm" variant="outline" onClick={() => setOpenRate(true)}>
                <Plus /> {t("newRate")}
              </Button>
            )}
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="mb-2 text-xs text-muted-foreground">{t("rateHint")}</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tf("currency")}</TableHead>
                <TableHead>{tf("rateDate")}</TableHead>
                <TableHead className="text-end">{tf("rate")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground h-16">
                    {tc("noData")}
                  </TableCell>
                </TableRow>
              )}
              {rates.map((r) => (
                <TableRow key={r.id}>
                  <TableCell dir="ltr">{r.currencyCode}</TableCell>
                  <TableCell dir="ltr">{formatDate(r.rateDate, locale)}</TableCell>
                  <TableCell className="text-end tabular-nums" dir="ltr">
                    {formatNumber(r.rate, locale, 6)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <EntityDialog
        open={openCur}
        onOpenChange={setOpenCur}
        title={t("new")}
        size="sm"
        columns={1}
        fields={[
          { name: "code", label: tf("code"), required: true, dir: "ltr", placeholder: "USD" },
          { name: "nameAr", label: tf("nameAr"), required: true, dir: "rtl" },
          { name: "nameEn", label: tf("nameEn"), required: true, dir: "ltr" },
          { name: "symbol", label: tf("symbol") },
          { name: "decimals", label: tf("decimals"), type: "number", required: true },
        ]}
        defaultValues={{ code: "", nameAr: "", nameEn: "", symbol: "", decimals: 2 }}
        action={enableCurrencyAction}
      />
      <EntityDialog
        open={openRate}
        onOpenChange={setOpenRate}
        title={t("newRate")}
        size="sm"
        columns={1}
        fields={[
          { name: "currencyCode", label: tf("currency"), type: "select", required: true, options: currencies.filter((c) => c.code !== "SAR").map((c) => ({ value: c.code, label: c.code })) },
          { name: "rateDate", label: tf("rateDate"), type: "date", required: true },
          { name: "rate", label: tf("rate"), type: "number", required: true, step: "0.000001" },
        ]}
        defaultValues={{ currencyCode: "", rateDate: new Date().toISOString().slice(0, 10), rate: "" }}
        action={addRateAction}
      />
    </div>
  );
}
