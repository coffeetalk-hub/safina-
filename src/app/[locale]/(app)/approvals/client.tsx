"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Check, CheckSquare, Loader2, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { decideAction } from "@/modules/foundation/approvals/actions";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";

type Action = { step: number; user: string; decision: string; comment: string | null; at: string };
type Pending = { id: string; docType: string; docNumber: string | null; amount: number; currentStep: number; totalSteps: number; stepName: string; requester: string; createdAt: string; link: string; actions: Action[] };
type Hist = { id: string; docType: string; docNumber: string | null; amount: number; status: string; updatedAt: string; link: string; actions: Action[] };

const tone: Record<string, "success" | "destructive" | "warning" | "secondary"> = { APPROVED: "success", REJECTED: "destructive", PENDING: "warning", CANCELLED: "secondary" };

export function ApprovalsClient({ pending, history }: { pending: Pending[]; history: Hist[] }) {
  const t = useTranslations("foundation.approvals");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const ts = useTranslations("enums.ApprovalStatus");
  const locale = useLocale();
  const toast = useToast();
  const router = useRouter();
  const [comments, setComments] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState<string | null>(null);

  const act = async (id: string, decision: "APPROVED" | "REJECTED") => {
    setBusy(id);
    const res = await decideAction({ requestId: id, decision, comment: comments[id] || undefined });
    setBusy(null);
    if (res.ok) {
      toast.success(tc("done"));
      router.refresh();
    } else toast.error(te.has(res.error) ? te(res.error) : res.error);
  };

  return (
    <Tabs defaultValue="pending">
      <TabsList>
        <TabsTrigger value="pending">
          {t("pending")} {pending.length > 0 && <Badge variant="destructive">{pending.length}</Badge>}
        </TabsTrigger>
        <TabsTrigger value="history">{t("history")}</TabsTrigger>
      </TabsList>
      <TabsContent value="pending" className="space-y-3">
        {pending.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <CheckSquare className="size-8" /> {t("empty")}
          </div>
        )}
        {pending.map((r) => (
          <Card key={r.id}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono" dir="ltr">{r.docType}</Badge>
                {r.link !== "#" ? <Link href={r.link} className="text-primary hover:underline" dir="ltr">{r.docNumber}</Link> : <span dir="ltr">{r.docNumber}</span>}
                <span className="tabular-nums" dir="ltr">{formatMoney(r.amount, locale)}</span>
                <Badge variant="warning">{t("step", { current: r.currentStep, total: r.totalSteps })} · {r.stepName}</Badge>
              </CardTitle>
              <CardDescription>
                {r.requester} · <span dir="ltr">{formatDateTime(r.createdAt, locale)}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {r.actions.length > 0 && (
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  {r.actions.map((a, i) => (
                    <li key={i}>
                      #{a.step} {a.user}: <Badge variant={tone[a.decision]}>{ts(a.decision)}</Badge> {a.comment && `— ${a.comment}`}
                    </li>
                  ))}
                </ul>
              )}
              <Textarea placeholder={tc("comment")} value={comments[r.id] ?? ""} onChange={(e) => setComments({ ...comments, [r.id]: e.target.value })} className="min-h-10" />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => act(r.id, "APPROVED")} disabled={busy === r.id}>
                  {busy === r.id ? <Loader2 className="animate-spin" /> : <Check />} {tc("approve")}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => act(r.id, "REJECTED")} disabled={busy === r.id}>
                  <X /> {tc("reject")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </TabsContent>
      <TabsContent value="history">
        <ul className="divide-y rounded-md border bg-card">
          {history.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">{tc("noData")}</li>}
          {history.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
              <Badge variant="outline" className="font-mono" dir="ltr">{r.docType}</Badge>
              {r.link !== "#" ? <Link href={r.link} className="text-primary hover:underline" dir="ltr">{r.docNumber}</Link> : <span dir="ltr">{r.docNumber}</span>}
              <span className="tabular-nums" dir="ltr">{formatMoney(r.amount, locale)}</span>
              <Badge variant={tone[r.status]}>{ts(r.status)}</Badge>
              <span className="ms-auto text-xs text-muted-foreground" dir="ltr">{formatDateTime(r.updatedAt, locale)}</span>
            </li>
          ))}
        </ul>
      </TabsContent>
    </Tabs>
  );
}
