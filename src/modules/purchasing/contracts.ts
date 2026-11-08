import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { makeCrud, zStr, zOptStr } from "@/modules/foundation/_shared/crud";
import type { ColumnDef } from "@/components/data-table/types";
import { nextDocumentNumber } from "@/core/numbering";
import { notify } from "@/core/notifications";
import { registerCronJob } from "@/core/cron";

export const contractSchema = z.object({
  id: z.string().nullable().optional(),
  vendorId: z.string().min(1),
  number: z.string().max(30).nullable().optional(),
  titleAr: zStr(200), titleEn: zStr(200),
  startDate: z.string().min(10), endDate: z.string().min(10),
  value: z.coerce.number().min(0).default(0), currencyCode: z.string().length(3).default("SAR"),
  alertDays: z.coerce.number().int().min(0).max(365).default(30), autoRenew: z.coerce.boolean().default(false),
  status: z.enum(["DRAFT", "ACTIVE", "EXPIRED", "TERMINATED"]).default("ACTIVE"),
  ownerId: zOptStr(40), termsAr: zOptStr(2000), termsEn: zOptStr(2000),
});
export const contracts = makeCrud({
  model: "vendorContract", resource: "contract", schema: contractSchema,
  searchFields: ["number", "titleAr", "titleEn"], sortFields: ["number", "startDate", "endDate", "value", "status"], defaultOrder: { endDate: "asc" },
  include: { vendor: { select: { code: true, nameAr: true, nameEn: true } } },
  filterWhere: (f) => { const w: Record<string, unknown> = {}; if (f.status) w.status = f.status; if (f.vendorId) w.vendorId = f.vendorId; if (f.expiring === "true") w.endDate = { lte: new Date(Date.now() + 60 * 86_400_000), gte: new Date() }; return w; },
  beforeSave: async (data, session, id) => {
    if (new Date(data.endDate) <= new Date(data.startDate)) throw new Error("END_BEFORE_START");
    const d = { ...data, startDate: new Date(data.startDate), endDate: new Date(data.endDate) } as unknown as typeof data;
    if (!id && !data.number) (d as { number?: string }).number = await nextDocumentNumber(prisma as never, session.companyId, "CONTRACT", new Date(data.startDate)).catch(async () => (await import("@/core/numbering")).allocateNumber(session.companyId, "CONTRACT"));
    return d;
  },
});
export function contractColumns(tf: (k: string) => string, t: (k: string) => string): ColumnDef[] {
  return [
    { key: "number", label: tf("number"), sortable: true },
    { key: "title", label: tf("title"), bilingual: "title" },
    { key: "vendor", label: t("vendor"), bilingual: "vendor.name" },
    { key: "startDate", label: tf("startDate"), type: "date", sortable: true },
    { key: "endDate", label: tf("endDate"), type: "date", sortable: true },
    { key: "daysLeft", label: t("daysLeft"), type: "number", align: "end" },
    { key: "value", label: t("contractValue"), type: "money", align: "end", sortable: true, currencyPath: "currencyCode" },
    { key: "alertDays", label: t("alertDays"), type: "number", align: "end", hidden: true },
    { key: "status", label: tf("status"), type: "enum", enumName: "ContractStatus", tones: { DRAFT: "secondary", ACTIVE: "success", EXPIRED: "destructive", TERMINATED: "warning" } },
  ];
}
export function withDaysLeft<T extends { endDate: Date }>(rows: T[]) {
  return rows.map((r) => ({ ...r, daysLeft: Math.ceil((r.endDate.getTime() - Date.now()) / 86_400_000) }));
}
/** Cron: mark expired contracts and notify purchasing users about contracts inside their alert window (once per day). */
export async function contractExpiryAlerts() {
  const now = new Date();
  await prisma.vendorContract.updateMany({ where: { status: "ACTIVE", endDate: { lt: now }, autoRenew: false }, data: { status: "EXPIRED" } });
  const due = await prisma.vendorContract.findMany({ where: { status: "ACTIVE", OR: [{ lastAlertAt: null }, { lastAlertAt: { lt: new Date(now.getTime() - 86_400_000) } }] }, include: { vendor: { select: { nameAr: true, nameEn: true } } } });
  let sent = 0;
  for (const c of due) {
    const daysLeft = Math.ceil((c.endDate.getTime() - now.getTime()) / 86_400_000);
    if (daysLeft > c.alertDays) continue;
    const users = await prisma.userCompanyRole.findMany({ where: { userCompany: { companyId: c.companyId }, role: { permissions: { some: { permission: "purchasing.contract:edit" } } } }, select: { userCompany: { select: { userId: true } } } });
    for (const u of [...new Set(users.map((x) => x.userCompany.userId))]) {
      await notify(prisma, { companyId: c.companyId, userId: u, type: "CONTRACT_EXPIRING", titleAr: `عقد ${c.number} ينتهي خلال ${daysLeft} يومًا — ${c.vendor.nameAr}`, titleEn: `Contract ${c.number} expires in ${daysLeft} days — ${c.vendor.nameEn}`, link: `/purchasing/contracts`, entityType: "VendorContract", entityId: c.id, email: true });
      sent++;
    }
    await prisma.vendorContract.update({ where: { id: c.id }, data: { lastAlertAt: now } });
  }
  return { checked: due.length, notified: sent };
}
registerCronJob("expiry-alerts", contractExpiryAlerts);
