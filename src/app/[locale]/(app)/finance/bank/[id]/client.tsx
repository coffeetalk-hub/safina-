"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CheckCircle2, Download, Link2, Loader2, Trash2, Unlink, Upload, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { autoMatchAction, completeReconciliationAction, deleteStatementLineAction, importStatementAction, matchLineAction } from "@/modules/finance/actions";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { Link } from "@/i18n/navigation";

type Stmt = { id: string; lineDate: string; description: string | null; reference: string | null; amount: number; balance: number | null; matchedEntryId: string | null };
type Gl = { id: string; number: string; date: string; description: string | null; reference: string | null; source: string; amount: number };
type Rec = { id: string; statementDate: string; statementBalance: number; glBalance: number; status: string };

export function ReconciliationClient({ bankAccountId, asOf, data, can }: { bankAccountId: string; asOf: string; data: { statement: Stmt[]; gl: Gl[]; glBalance: number; reconciliations: Rec[]; currency: string }; can: { edit: boolean; create: boolean; approve: boolean; delete: boolean } }) {
  const t = useTranslations("finance");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const locale = useLocale();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [stmtBalance, setStmtBalance] = React.useState("");
  const cur = data.currency;

  const matchedIds = new Set(data.statement.filter((s) => s.matchedEntryId).map((s) => s.matchedEntryId!));
  const unmatchedStmt = data.statement.filter((s) => !s.matchedEntryId);
  const unmatchedGl = data.gl.filter((g) => !matchedIds.has(g.id));
  const matchedTotal = data.statement.filter((s) => s.matchedEntryId).reduce((a, s) => a + s.amount, 0);
  const unmatchedStmtTotal = unmatchedStmt.reduce((a, s) => a + s.amount, 0);
  const unmatchedGlTotal = unmatchedGl.reduce((a, g) => a + g.amount, 0);
  const setAsOf = (v: string) => {
    const n = new URLSearchParams(sp.toString());
    n.set("f.asOf", v);
    router.push(`${pathname}?${n.toString()}`);
  };
  const fail = (e: string) => toast.error(te.has(e) ? te(e) : e);
  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.set("bankAccountId", bankAccountId);
    fd.set("file", file);
    const res = await importStatementAction(fd);
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    if (res.ok) {
      const d = res.data as { imported: number; skipped: number };
      toast.success(`${d.imported} ✓ · ${d.skipped} ✗`);
      router.refresh();
    } else fail(res.error);
  };
  const match = async (stmtId: string, entryId: string | null) => {
    const res = await matchLineAction(stmtId, entryId);
    if (res.ok) router.refresh();
    else fail(res.error);
  };
  const difference = Number(stmtBalance || 0) - data.glBalance;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1"><Label>{t("asOf")}</Label><Input type="date" dir="ltr" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="w-44" /></div>
          <div className="space-y-1"><Label>{t("glBalance")}</Label><div className="h-9 flex items-center font-semibold tabular-nums" dir="ltr">{formatMoney(data.glBalance, locale, cur)}</div></div>
          <div className="space-y-1"><Label>{t("statementBalance")}</Label><Input type="number" step="0.01" dir="ltr" value={stmtBalance} onChange={(e) => setStmtBalance(e.target.value)} className="w-44" /></div>
          <div className="space-y-1"><Label>{t("difference")}</Label><div className={`h-9 flex items-center font-semibold tabular-nums ${Math.abs(difference) < 0.005 ? "text-emerald-600" : "text-destructive"}`} dir="ltr">{formatMoney(difference, locale, cur)}</div></div>
          <div className="ms-auto flex flex-wrap gap-2">
            {can.create && (
              <>
                <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
                <Button variant="outline" size="sm" asChild><a href={`/api/bank/statement-template?locale=${locale}`}><Download /> {t("statementTemplate")}</a></Button>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? <Loader2 className="animate-spin" /> : <Upload />} {t("importStatement")}</Button>
              </>
            )}
            {can.edit && <ConfirmButton title={t("autoMatch")} action={() => autoMatchAction(bankAccountId, asOf)} variant="secondary" size="sm" onSuccess={(n) => toast.info(`${n}`)}><Wand2 /> {t("autoMatch")}</ConfirmButton>}
            {can.approve && (
              <ConfirmButton title={t("completeReconciliation")} description={t("completeHint")} action={() => completeReconciliationAction({ bankAccountId, statementDate: asOf, statementBalance: Number(stmtBalance || 0) })} variant="default" size="sm" disabled={!stmtBalance}>
                <CheckCircle2 /> {t("completeReconciliation")}
              </ConfirmButton>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("statementLines")} <Badge variant="outline">{unmatchedStmt.length}</Badge> <span className="text-xs text-muted-foreground font-normal" dir="ltr">{formatMoney(unmatchedStmtTotal, locale, cur)}</span></CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>{tc("date")}</TableHead><TableHead>{t("description")}</TableHead><TableHead className="text-end">{t("amount")}</TableHead><TableHead className="w-44">{t("matchTo")}</TableHead></TableRow></TableHeader>
              <TableBody>
                {unmatchedStmt.length === 0 && <TableRow><TableCell colSpan={4} className="h-16 text-center text-muted-foreground">—</TableCell></TableRow>}
                {unmatchedStmt.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell dir="ltr" className="text-xs">{formatDate(s.lineDate, locale)}</TableCell>
                    <TableCell className="text-xs"><div>{s.description}</div><div className="text-muted-foreground" dir="ltr">{s.reference}</div></TableCell>
                    <TableCell className={`text-end tabular-nums ${s.amount < 0 ? "text-destructive" : "text-emerald-700"}`} dir="ltr">{formatMoney(s.amount, locale, cur)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Select onValueChange={(v) => match(s.id, v)} disabled={!can.edit}>
                          <SelectTrigger size="sm"><SelectValue placeholder="…" /></SelectTrigger>
                          <SelectContent>
                            {unmatchedGl.filter((g) => Math.abs(g.amount - s.amount) < 0.005).map((g) => <SelectItem key={g.id} value={g.id}>{g.number} · {formatDate(g.date, locale)}</SelectItem>)}
                            {unmatchedGl.filter((g) => Math.abs(g.amount - s.amount) >= 0.005).slice(0, 30).map((g) => <SelectItem key={g.id} value={g.id}>{g.number} · {formatMoney(g.amount, locale, cur)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        {can.delete && <ConfirmButton title={tc("deleteConfirmTitle")} action={() => deleteStatementLineAction(s.id)} variant="ghost" size="icon-sm"><Trash2 className="size-3.5 text-destructive" /></ConfirmButton>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">{t("glLines")} <Badge variant="outline">{unmatchedGl.length}</Badge> <span className="text-xs text-muted-foreground font-normal" dir="ltr">{formatMoney(unmatchedGlTotal, locale, cur)}</span></CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>{tc("date")}</TableHead><TableHead>{tc("details")}</TableHead><TableHead className="text-end">{t("amount")}</TableHead></TableRow></TableHeader>
              <TableBody>
                {unmatchedGl.length === 0 && <TableRow><TableCell colSpan={3} className="h-16 text-center text-muted-foreground">—</TableCell></TableRow>}
                {unmatchedGl.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell dir="ltr" className="text-xs">{formatDate(g.date, locale)}</TableCell>
                    <TableCell className="text-xs"><Link href={`/finance/journals/${g.id}`} className="text-primary hover:underline" dir="ltr">{g.number}</Link> <Badge variant="outline" className="text-[10px]">{g.source}</Badge><div className="text-muted-foreground">{g.description}</div></TableCell>
                    <TableCell className={`text-end tabular-nums ${g.amount < 0 ? "text-destructive" : "text-emerald-700"}`} dir="ltr">{formatMoney(g.amount, locale, cur)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("matched")} <Badge variant="success">{data.statement.length - unmatchedStmt.length}</Badge> <span className="text-xs text-muted-foreground font-normal" dir="ltr">{formatMoney(matchedTotal, locale, cur)}</span></CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>{tc("date")}</TableHead><TableHead>{t("description")}</TableHead><TableHead className="text-end">{t("amount")}</TableHead><TableHead>{t("journalEntry")}</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
            <TableBody>
              {data.statement.filter((s) => s.matchedEntryId).map((s) => {
                const g = data.gl.find((x) => x.id === s.matchedEntryId);
                return (
                  <TableRow key={s.id}>
                    <TableCell dir="ltr" className="text-xs">{formatDate(s.lineDate, locale)}</TableCell>
                    <TableCell className="text-xs">{s.description}</TableCell>
                    <TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(s.amount, locale, cur)}</TableCell>
                    <TableCell className="text-xs"><Link2 className="inline size-3 me-1" />{g ? <Link href={`/finance/journals/${g.id}`} className="text-primary hover:underline" dir="ltr">{g.number}</Link> : s.matchedEntryId}</TableCell>
                    <TableCell>{can.edit && <Button variant="ghost" size="icon-sm" onClick={() => match(s.id, null)} title={t("unmatch")}><Unlink className="size-3.5" /></Button>}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {data.reconciliations.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">{t("reconciliation.history")}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>{t("statementDate")}</TableHead><TableHead className="text-end">{t("statementBalance")}</TableHead><TableHead className="text-end">{t("glBalance")}</TableHead><TableHead className="text-end">{t("difference")}</TableHead><TableHead>{tc("status")}</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.reconciliations.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell dir="ltr">{formatDate(r.statementDate, locale)}</TableCell>
                    <TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(r.statementBalance, locale, cur)}</TableCell>
                    <TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(r.glBalance, locale, cur)}</TableCell>
                    <TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(r.statementBalance - r.glBalance, locale, cur)}</TableCell>
                    <TableCell><Badge variant="success">{r.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
