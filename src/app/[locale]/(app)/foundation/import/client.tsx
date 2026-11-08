"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Download, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/misc";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { importAction } from "@/modules/foundation/import/actions";
import { formatDateTime } from "@/lib/dates";

type Hist = { id: string; entityType: string; fileName: string; totalRows: number; successRows: number; errorRows: number; createdAt: string };
type Result = { total: number; ok: number; failed: number; errors: { row: number; message: string }[]; posted?: boolean; message?: string };

export function ImportClient({ entities, history }: { entities: string[]; history: Hist[] }) {
  const t = useTranslations("foundation.import");
  const tn = useTranslations("nav.items");
  const te = useTranslations("errors");
  const locale = useLocale();
  const toast = useToast();
  const router = useRouter();
  const [entity, setEntity] = React.useState(entities[0] ?? "customers");
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<Result | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const label = (e: string) => {
    const map: Record<string, string> = { customers: "customers", vendors: "vendors", items: "items", employees: "employees", accounts: "accounts" };
    return e === "opening-balances" ? t("openingBalances") : tn(map[e] ?? e);
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    const fd = new FormData();
    fd.set("entity", entity);
    fd.set("file", file);
    const res = await importAction(fd);
    setLoading(false);
    if (fileRef.current) fileRef.current.value = "";
    if (res.ok) {
      setResult(res.data as Result);
      router.refresh();
    } else toast.error(te.has(res.error) ? te(res.error) : res.error);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>{t("entity")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={entity} onValueChange={setEntity}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{entities.map((e) => <SelectItem key={e} value={e}>{label(e)}</SelectItem>)}</SelectContent>
          </Select>
          {entity === "opening-balances" && <p className="text-xs text-muted-foreground">{t("openingHint")}</p>}
          <Button variant="outline" className="w-full" asChild>
            <a href={`/api/import/template/${entity}?locale=${locale}`}>
              <Download /> {t("template")}
            </a>
          </Button>
          <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
          <Button className="w-full" disabled={loading} onClick={() => fileRef.current?.click()}>
            {loading ? <Loader2 className="animate-spin" /> : <Upload />} {t("upload")}
          </Button>
        </CardContent>
      </Card>
      <div className="lg:col-span-2 space-y-4">
        {result && (
          <Alert variant={result.failed > 0 ? "warning" : "success"}>
            <AlertTitle>{t("result", { ok: result.ok, failed: result.failed })}</AlertTitle>
            {result.message && <AlertDescription>{result.message}</AlertDescription>}
            {result.errors.length > 0 && (
              <AlertDescription>
                <ul className="mt-2 max-h-60 overflow-auto text-xs space-y-0.5 w-full">
                  {result.errors.map((e, i) => (
                    <li key={i} dir="ltr">
                      {t("row")} {e.row}: {e.message}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            )}
          </Alert>
        )}
        <Card>
          <CardHeader>
            <CardTitle>{t("history")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("entity")}</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead className="text-end">OK</TableHead>
                  <TableHead className="text-end">{t("errors")}</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>{label(h.entityType)}</TableCell>
                    <TableCell dir="ltr">{h.fileName}</TableCell>
                    <TableCell className="text-end text-emerald-700">{h.successRows}</TableCell>
                    <TableCell className="text-end text-destructive">{h.errorRows}</TableCell>
                    <TableCell dir="ltr">{formatDateTime(h.createdAt, locale)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
