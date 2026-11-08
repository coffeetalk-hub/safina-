import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";
import { makeCrud, zOptStr } from "@/modules/foundation/_shared/crud";
import type { ColumnDef } from "@/components/data-table/types";

export const WEIGHTS = { quality: 30, delivery: 25, price: 20, service: 15, compliance: 10 } as const;
const score5 = z.coerce.number().int().min(1).max(5);
export const evaluationSchema = z.object({
  id: z.string().nullable().optional(),
  vendorId: z.string().min(1),
  evalDate: z.string().min(10),
  periodLabel: zOptStr(40),
  quality: score5.default(3), delivery: score5.default(3), price: score5.default(3), service: score5.default(3), compliance: score5.default(3),
  comments: zOptStr(2000),
});
export function computeScore(e: { quality: number; delivery: number; price: number; service: number; compliance: number }) {
  const total = (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).reduce((a, k) => a + (e[k] / 5) * WEIGHTS[k], 0);
  return Math.round(total * 100) / 100;
}
export const evaluations = makeCrud({
  model: "vendorEvaluation", resource: "evaluation", schema: evaluationSchema,
  searchFields: ["periodLabel", "comments"], sortFields: ["evalDate", "score"], defaultOrder: { evalDate: "desc" },
  include: { vendor: { select: { code: true, nameAr: true, nameEn: true } } },
  filterWhere: (f) => { const w: Record<string, unknown> = {}; if (f.vendorId) w.vendorId = f.vendorId; return w; },
  beforeSave: async (data, session) => ({ ...data, evalDate: new Date(data.evalDate), score: computeScore(data), evaluatorId: session.userId }) as unknown as typeof data,
});
export function evaluationColumns(tf: (k: string) => string, t: (k: string) => string): ColumnDef[] {
  return [
    { key: "evalDate", label: tf("date"), type: "date", sortable: true },
    { key: "vendor", label: t("vendor"), bilingual: "vendor.name" },
    { key: "periodLabel", label: tf("period") },
    { key: "quality", label: t("criteria.quality"), type: "number", align: "center" },
    { key: "delivery", label: t("criteria.delivery"), type: "number", align: "center" },
    { key: "price", label: t("criteria.price"), type: "number", align: "center" },
    { key: "service", label: t("criteria.service"), type: "number", align: "center" },
    { key: "compliance", label: t("criteria.compliance"), type: "number", align: "center" },
    { key: "score", label: t("score"), type: "number", align: "end", sortable: true },
  ];
}
/** Vendor scorecard: average score + spend + on-time stats. */
export async function vendorScorecard(session: AppSession) {
  const [vendors, evals, bills] = await Promise.all([
    prisma.vendor.findMany({ where: { companyId: session.companyId, isActive: true }, select: { id: true, code: true, nameAr: true, nameEn: true } }),
    prisma.vendorEvaluation.groupBy({ by: ["vendorId"], where: { companyId: session.companyId }, _avg: { score: true }, _count: { _all: true } }),
    prisma.vendorBill.groupBy({ by: ["vendorId"], where: { companyId: session.companyId, status: { in: ["POSTED", "PARTIALLY_PAID", "PAID"] } }, _sum: { baseTotal: true }, _count: { _all: true } }),
  ]);
  return vendors.map((v) => ({ ...v, avgScore: Number(evals.find((e) => e.vendorId === v.id)?._avg.score ?? 0), evaluations: evals.find((e) => e.vendorId === v.id)?._count._all ?? 0, spend: Number(bills.find((b) => b.vendorId === v.id)?._sum.baseTotal ?? 0), bills: bills.find((b) => b.vendorId === v.id)?._count._all ?? 0 })).sort((a, b) => b.spend - a.spend);
}
