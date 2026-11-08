"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Lock, LockOpen, Plus, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EntityDialog } from "@/components/forms/entity-dialog";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { saveFiscalYearAction, setPeriodStatusAction, setYearStatusAction } from "@/modules/foundation/fiscal/actions";
import { formatDate } from "@/lib/dates";

type Period = { id: string; number: number; name: string; startDate: string; endDate: string; status: "OPEN" | "CLOSED" | "LOCKED" };
type Year = { id: string; code: string; name: string; startDate: string; endDate: string; status: "OPEN" | "CLOSED" | "LOCKED"; periods: Period[] };

const tone = { OPEN: "success", CLOSED: "warning", LOCKED: "destructive" } as const;

export function FiscalClient({ years, can }: { years: Year[]; can: { create: boolean; edit: boolean; approve: boolean } }) {
  const t = useTranslations("foundation.fiscal");
  const tf = useTranslations("fields");
  const te = useTranslations("enums.FiscalStatus");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Year | null>(null);
  const nextYear = years.length ? Number(years[0].code) + 1 : new Date().getFullYear();

  return (
    <div className="space-y-4">
      {can.create && (
        <div className="flex justify-end">
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus /> {t("new")}
          </Button>
        </div>
      )}
      {years.map((y) => (
        <Card key={y.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {y.name} <Badge variant={tone[y.status]}>{te(y.status)}</Badge>
              <span className="text-xs font-normal text-muted-foreground" dir="ltr">
                {formatDate(y.startDate, locale)} → {formatDate(y.endDate, locale)}
              </span>
            </CardTitle>
            <CardAction className="flex gap-1">
              {can.edit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing(y);
                    setOpen(true);
                  }}
                >
                  {tc("edit")}
                </Button>
              )}
              {can.approve && y.status === "OPEN" && (
                <ConfirmButton title={t("closePeriod")} action={() => setYearStatusAction(y.id, "CLOSED")} variant="outline" size="sm">
                  <Lock /> {t("closePeriod")}
                </ConfirmButton>
              )}
              {can.approve && y.status !== "OPEN" && (
                <ConfirmButton title={t("openPeriod")} action={() => setYearStatusAction(y.id, "OPEN")} variant="outline" size="sm">
                  <Unlock /> {t("openPeriod")}
                </ConfirmButton>
              )}
            </CardAction>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>{tf("period")}</TableHead>
                  <TableHead>{tf("startDate")}</TableHead>
                  <TableHead>{tf("endDate")}</TableHead>
                  <TableHead>{tf("status")}</TableHead>
                  {can.approve && <TableHead className="text-end">{tc("actions")}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {y.periods.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.number}</TableCell>
                    <TableCell dir="ltr">{p.name}</TableCell>
                    <TableCell dir="ltr">{formatDate(p.startDate, locale)}</TableCell>
                    <TableCell dir="ltr">{formatDate(p.endDate, locale)}</TableCell>
                    <TableCell>
                      <Badge variant={tone[p.status]}>{te(p.status)}</Badge>
                    </TableCell>
                    {can.approve && (
                      <TableCell className="text-end space-x-1 rtl:space-x-reverse">
                        {p.status === "OPEN" && (
                          <Button variant="ghost" size="sm" onClick={() => setPeriodStatusAction(p.id, "CLOSED").then(() => location.reload())}>
                            <Lock /> {t("closePeriod")}
                          </Button>
                        )}
                        {p.status === "CLOSED" && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => setPeriodStatusAction(p.id, "OPEN").then(() => location.reload())}>
                              <LockOpen /> {t("openPeriod")}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setPeriodStatusAction(p.id, "LOCKED").then(() => location.reload())}>
                              <Lock className="text-destructive" /> {t("lockPeriod")}
                            </Button>
                          </>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
      <EntityDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? t("edit") : t("new")}
        size="sm"
        columns={1}
        fields={[
          { name: "code", label: tf("code"), required: true, dir: "ltr" },
          { name: "name", label: tf("name"), required: true },
          { name: "startDate", label: tf("startDate"), type: "date", required: true, disabled: !!editing },
          { name: "endDate", label: tf("endDate"), type: "date", required: true, disabled: !!editing },
        ]}
        defaultValues={
          editing
            ? { id: editing.id, code: editing.code, name: editing.name, startDate: editing.startDate.slice(0, 10), endDate: editing.endDate.slice(0, 10) }
            : { code: String(nextYear), name: `FY ${nextYear}`, startDate: `${nextYear}-01-01`, endDate: `${nextYear}-12-31` }
        }
        action={saveFiscalYearAction}
      />
    </div>
  );
}
