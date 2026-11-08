import { getLocale } from "next-intl/server";
import { purchasingPage, type SP } from "@/modules/purchasing/page-helpers";
import { financeLookups } from "@/modules/finance/_shared/lookups";
import { evaluations, evaluationColumns, vendorScorecard, WEIGHTS } from "@/modules/purchasing/evaluations";
import { saveEvaluationAction, removeEvaluationAction } from "@/modules/purchasing/actions";
import { PageHeader } from "@/components/shell/page-header";
import { CrudList } from "@/components/forms/crud-list";
import { plain } from "@/components/data-table/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, formatNumber } from "@/lib/money";

export default async function EvaluationsPage({ searchParams }: { searchParams: SP }) {
  const { session, params, t, tf, perms } = await purchasingPage("evaluation", searchParams);
  const locale = await getLocale();
  const [data, lk, scorecard] = await Promise.all([evaluations.list(session, params), financeLookups(session.companyId, locale), vendorScorecard(session)]);
  const score = (v: number) => (v >= 80 ? "text-emerald-600" : v >= 60 ? "text-amber-600" : v > 0 ? "text-red-600" : "text-muted-foreground");
  const opts = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} — ${t(`scale.${n}`)}` }));
  return (
    <>
      <PageHeader title={t("evaluations.title")} description={t("evaluations.hint", { q: WEIGHTS.quality, d: WEIGHTS.delivery, p: WEIGHTS.price, s: WEIGHTS.service, c: WEIGHTS.compliance })} />
      <div className="space-y-6">
        <CrudList tableKey="vendor-evaluations" columns={evaluationColumns(tf, t)} data={plain(data)} exportResource="vendor-evaluations" dialogSize="lg" dateFields={["evalDate"]}
          filters={[{ key: "vendorId", label: t("vendor"), type: "select", options: lk.vendors }]}
          titleNew={t("evaluations.new")} titleEdit={t("evaluations.edit")}
          newDefaults={{ vendorId: "", evalDate: new Date().toISOString().slice(0, 10), periodLabel: `${new Date().getUTCFullYear()}-Q${Math.floor(new Date().getUTCMonth() / 3) + 1}`, quality: "3", delivery: "3", price: "3", service: "3", compliance: "3", comments: "" }}
          fields={[
            { name: "vendorId", label: t("vendor"), type: "select", options: lk.vendors, required: true },
            { name: "evalDate", label: tf("date"), type: "date", required: true },
            { name: "periodLabel", label: tf("period"), dir: "ltr" },
            { name: "quality", label: `${t("criteria.quality")} (${WEIGHTS.quality}%)`, type: "select", options: opts },
            { name: "delivery", label: `${t("criteria.delivery")} (${WEIGHTS.delivery}%)`, type: "select", options: opts },
            { name: "price", label: `${t("criteria.price")} (${WEIGHTS.price}%)`, type: "select", options: opts },
            { name: "service", label: `${t("criteria.service")} (${WEIGHTS.service}%)`, type: "select", options: opts },
            { name: "compliance", label: `${t("criteria.compliance")} (${WEIGHTS.compliance}%)`, type: "select", options: opts },
            { name: "comments", label: t("comments"), type: "textarea", colSpan: 2 },
          ]}
          saveAction={saveEvaluationAction} removeAction={removeEvaluationAction} can={perms} />
        <Card>
          <CardHeader><CardTitle className="text-base">{t("evaluations.scorecard")}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>{tf("code")}</TableHead><TableHead>{t("vendor")}</TableHead><TableHead className="text-end">{t("evaluations.count")}</TableHead><TableHead className="text-end">{t("evaluations.avgScore")}</TableHead><TableHead className="text-end">{t("reports.bills")}</TableHead><TableHead className="text-end">{t("evaluations.spend")}</TableHead></TableRow></TableHeader>
              <TableBody>
                {scorecard.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell dir="ltr">{v.code}</TableCell><TableCell>{locale === "ar" ? v.nameAr : v.nameEn}</TableCell>
                    <TableCell className="text-end" dir="ltr">{v.evaluations}</TableCell>
                    <TableCell className={`text-end font-semibold tabular-nums ${score(v.avgScore)}`} dir="ltr">{v.avgScore ? formatNumber(v.avgScore, locale, 1) : "—"}</TableCell>
                    <TableCell className="text-end" dir="ltr">{v.bills}</TableCell>
                    <TableCell className="text-end tabular-nums" dir="ltr">{formatMoney(v.spend, locale)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
