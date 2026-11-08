import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";
import { orderByFrom, skipTake, type ColumnDef, type ListParams, type PagedResult } from "@/components/data-table/types";
import { makeCrud, zStr, zOptStr } from "@/modules/foundation/_shared/crud";
import { nextDocumentNumber } from "@/core/numbering";
import { postJournal, mappedAccount, type PostingLine } from "@/core/posting";
import { D, round, ZERO } from "@/lib/money";
import { registerCronJob } from "@/core/cron";

export const categorySchema = z.object({
  id: z.string().nullable().optional(),
  code: zStr(20),
  nameAr: zStr(),
  nameEn: zStr(),
  assetAccountId: z.string().min(1),
  accumDepAccountId: z.string().min(1),
  depExpenseAccountId: z.string().min(1),
  method: z.enum(["STRAIGHT_LINE", "DECLINING_BALANCE"]).default("STRAIGHT_LINE"),
  lifeMonths: z.coerce.number().int().min(1).max(600).default(60),
  rate: z.coerce.number().min(0).max(100).default(20),
  isActive: z.coerce.boolean().default(true),
});
export const categories = makeCrud({ model: "fixedAssetCategory", resource: "asset", schema: categorySchema, searchFields: ["code", "nameAr", "nameEn"], sortFields: ["code"], defaultOrder: { code: "asc" } });

export const assetSchema = z.object({
  id: z.string().nullable().optional(),
  categoryId: z.string().min(1),
  number: z.string().max(30).nullable().optional(),
  nameAr: zStr(),
  nameEn: zStr(),
  serial: zOptStr(80),
  location: zOptStr(120),
  branchId: z.string().nullable().optional(),
  vendorId: z.string().nullable().optional(),
  costCenterId: z.string().nullable().optional(),
  acquisitionDate: z.string().min(10),
  depreciationStart: z.string().min(10),
  cost: z.coerce.number().positive(),
  salvage: z.coerce.number().min(0).default(0),
  lifeMonths: z.coerce.number().int().min(1).max(600),
  method: z.enum(["STRAIGHT_LINE", "DECLINING_BALANCE"]),
  rate: z.coerce.number().min(0).max(100).default(0),
  notes: zOptStr(1000),
  /** Post acquisition journal: Dr asset account, Cr credit account (AP/bank/other) */
  postAcquisition: z.coerce.boolean().default(false),
  creditAccountId: z.string().nullable().optional(),
});
export type AssetInput = z.infer<typeof assetSchema>;

function where(session: AppSession, p: ListParams) {
  const w: Record<string, unknown> = { companyId: session.companyId };
  if (p.q) w.OR = [{ number: { contains: p.q, mode: "insensitive" } }, { nameAr: { contains: p.q, mode: "insensitive" } }, { nameEn: { contains: p.q, mode: "insensitive" } }, { serial: { contains: p.q, mode: "insensitive" } }];
  if (p.filters.categoryId) w.categoryId = p.filters.categoryId;
  if (p.filters.status) w.status = p.filters.status;
  if (p.filters.branchId) w.branchId = p.filters.branchId;
  return w;
}
const include = { category: { select: { code: true, nameAr: true, nameEn: true } } };

export async function listAssets(session: AppSession, p: ListParams): Promise<PagedResult<Record<string, unknown>>> {
  const w = where(session, p);
  const [rows, total] = await Promise.all([prisma.fixedAsset.findMany({ where: w, orderBy: orderByFrom(p.sort, ["number", "nameEn", "acquisitionDate", "cost", "status"], { number: "asc" }), ...skipTake(p), include }), prisma.fixedAsset.count({ where: w })]);
  return { rows: rows.map(shape), total, page: p.page, pageSize: p.pageSize };
}
export async function allAssets(session: AppSession, p: ListParams) {
  return (await prisma.fixedAsset.findMany({ where: where(session, p), orderBy: { number: "asc" }, take: 10_000, include })).map(shape);
}
function shape<T extends { cost: unknown; accumulated: unknown }>(r: T) {
  return { ...r, netBook: D(r.cost as string).minus(D(r.accumulated as string)) };
}
export async function getAsset(session: AppSession, id: string) {
  return prisma.fixedAsset.findFirst({ where: { id, companyId: session.companyId }, include: { ...include, depreciation: { orderBy: { periodDate: "asc" } } } });
}

export async function saveAsset(session: AppSession, input: AssetInput) {
  const cat = await prisma.fixedAssetCategory.findFirst({ where: { id: input.categoryId, companyId: session.companyId } });
  if (!cat) throw new Error("NOT_FOUND");
  const { id, postAcquisition, creditAccountId, number, ...rest } = input;
  const data = { ...rest, acquisitionDate: new Date(rest.acquisitionDate), depreciationStart: new Date(rest.depreciationStart), branchId: rest.branchId || null, vendorId: rest.vendorId || null, costCenterId: rest.costCenterId || null };
  return prisma.$transaction(async (tx) => {
    if (id) {
      const ex = await tx.fixedAsset.findFirst({ where: { id, companyId: session.companyId } });
      if (!ex) throw new Error("NOT_FOUND");
      const locked = !D(ex.accumulated).isZero();
      return tx.fixedAsset.update({ where: { id }, data: locked ? { nameAr: data.nameAr, nameEn: data.nameEn, serial: data.serial, location: data.location, branchId: data.branchId, costCenterId: data.costCenterId, notes: data.notes } : data });
    }
    const num = number || (await nextDocumentNumber(tx, session.companyId, "ASSET", data.acquisitionDate));
    const asset = await tx.fixedAsset.create({ data: { ...data, number: num, companyId: session.companyId, createdById: session.userId } });
    if (postAcquisition) {
      const credit = creditAccountId || (await mappedAccount(tx, session.companyId, "AP"));
      const entry = await postJournal(tx, { companyId: session.companyId, branchId: data.branchId, entryDate: data.acquisitionDate, description: `Asset acquisition ${num} — ${data.nameEn}`, reference: num, source: "ASSET", sourceType: "FixedAsset", sourceId: asset.id, userId: session.userId, lines: [{ accountId: cat.assetAccountId, costCenterId: data.costCenterId, debit: data.cost, description: data.nameEn }, { accountId: credit, credit: data.cost, description: data.nameEn }] });
      await tx.fixedAsset.update({ where: { id: asset.id }, data: { acquisitionEntryId: entry.id } });
    }
    return asset;
  });
}

/** Monthly depreciation amount for an asset given its current accumulated depreciation. */
export function monthlyDepreciation(a: { cost: unknown; salvage: unknown; lifeMonths: number; method: string; rate: unknown; accumulated: unknown }) {
  const cost = D(a.cost as string);
  const salvage = D(a.salvage as string);
  const acc = D(a.accumulated as string);
  const remaining = cost.minus(salvage).minus(acc);
  if (remaining.lte(0)) return ZERO;
  let amt = a.method === "STRAIGHT_LINE" ? cost.minus(salvage).div(a.lifeMonths) : cost.minus(acc).times(D(a.rate as string)).div(100).div(12);
  amt = round(amt, 2);
  if (amt.gt(remaining)) amt = remaining;
  return amt;
}

/** Runs depreciation for the month containing `periodDate` (posts one journal per run). */
export async function runDepreciation(companyId: string, userId: string | null, periodDate: Date) {
  const last = new Date(Date.UTC(periodDate.getUTCFullYear(), periodDate.getUTCMonth() + 1, 0));
  const assets = await prisma.fixedAsset.findMany({ where: { companyId, status: "ACTIVE", depreciationStart: { lte: last } }, include: { category: true, depreciation: { where: { periodDate: last } } } });
  const due = assets.filter((a) => a.depreciation.length === 0);
  if (due.length === 0) return { posted: 0, amount: 0 };
  const lines: PostingLine[] = [];
  const updates: { id: string; amount: ReturnType<typeof D>; after: ReturnType<typeof D> }[] = [];
  for (const a of due) {
    const amt = monthlyDepreciation(a);
    if (amt.lte(0)) {
      await prisma.fixedAsset.update({ where: { id: a.id }, data: { status: "FULLY_DEPRECIATED" } });
      continue;
    }
    lines.push({ accountId: a.category.depExpenseAccountId, costCenterId: a.costCenterId, description: `${a.number} ${a.nameEn}`, debit: amt });
    lines.push({ accountId: a.category.accumDepAccountId, costCenterId: a.costCenterId, description: `${a.number} ${a.nameEn}`, credit: amt });
    updates.push({ id: a.id, amount: amt, after: D(a.accumulated).plus(amt) });
  }
  if (updates.length === 0) return { posted: 0, amount: 0 };
  return prisma.$transaction(async (tx) => {
    const entry = await postJournal(tx, { companyId, entryDate: last, description: `Depreciation ${last.toISOString().slice(0, 7)}`, source: "ASSET", sourceType: "Depreciation", sourceId: last.toISOString().slice(0, 10), lines, userId: userId ?? "system" });
    let total = ZERO;
    for (const u of updates) {
      const a = due.find((x) => x.id === u.id)!;
      await tx.depreciationEntry.create({ data: { companyId, assetId: u.id, periodDate: last, amount: u.amount, accumulatedAfter: u.after, journalEntryId: entry.id } });
      const fully = u.after.gte(D(a.cost).minus(a.salvage));
      await tx.fixedAsset.update({ where: { id: u.id }, data: { accumulated: u.after, status: fully ? "FULLY_DEPRECIATED" : "ACTIVE" } });
      total = total.plus(u.amount);
    }
    return { posted: updates.length, amount: total.toNumber(), entryNumber: entry.number };
  });
}

export async function disposeAsset(session: AppSession, input: { id: string; disposalDate: string; disposalAmount: number; proceedsAccountId?: string | null }) {
  return prisma.$transaction(async (tx) => {
    const a = await tx.fixedAsset.findFirst({ where: { id: input.id, companyId: session.companyId }, include: { category: true } });
    if (!a) throw new Error("NOT_FOUND");
    if (a.status === "DISPOSED") throw new Error("ALREADY_DISPOSED");
    const nbv = D(a.cost).minus(a.accumulated);
    const proceeds = D(input.disposalAmount);
    const diff = proceeds.minus(nbv); // + gain / − loss
    const lines: PostingLine[] = [];
    if (proceeds.gt(0)) lines.push({ accountId: input.proceedsAccountId || (await mappedAccount(tx, session.companyId, "BANK_DEFAULT")), debit: proceeds, description: `Disposal ${a.number}` });
    if (!D(a.accumulated).isZero()) lines.push({ accountId: a.category.accumDepAccountId, debit: a.accumulated, description: `Disposal ${a.number}` });
    lines.push({ accountId: a.category.assetAccountId, credit: a.cost, description: `Disposal ${a.number}` });
    if (diff.gt(0)) lines.push({ accountId: await mappedAccount(tx, session.companyId, "OTHER_INCOME"), credit: diff, description: `Gain on disposal ${a.number}` });
    if (diff.lt(0)) lines.push({ accountId: await mappedAccount(tx, session.companyId, "OTHER_EXPENSE"), debit: diff.abs(), description: `Loss on disposal ${a.number}` });
    const entry = await postJournal(tx, { companyId: session.companyId, branchId: a.branchId, entryDate: new Date(input.disposalDate), description: `Asset disposal ${a.number} — ${a.nameEn}`, reference: a.number, source: "ASSET", sourceType: "FixedAsset", sourceId: a.id, userId: session.userId, lines });
    return tx.fixedAsset.update({ where: { id: a.id }, data: { status: "DISPOSED", disposalDate: new Date(input.disposalDate), disposalAmount: proceeds, disposalEntryId: entry.id } });
  });
}

/** Projected schedule (for the asset page). */
export function schedule(a: { cost: unknown; salvage: unknown; lifeMonths: number; method: string; rate: unknown; depreciationStart: Date | string }) {
  const rows: { period: string; amount: number; accumulated: number; netBook: number }[] = [];
  let acc = ZERO;
  const start = new Date(a.depreciationStart);
  for (let i = 0; i < Math.min(a.lifeMonths + 24, 600); i++) {
    const amt = monthlyDepreciation({ ...a, accumulated: acc });
    if (amt.lte(0)) break;
    acc = acc.plus(amt);
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i + 1, 0));
    rows.push({ period: d.toISOString().slice(0, 7), amount: amt.toNumber(), accumulated: acc.toNumber(), netBook: D(a.cost as string).minus(acc).toNumber() });
    if (a.method === "DECLINING_BALANCE" && amt.lt(1)) break;
  }
  return rows;
}

export function assetColumns(tf: (k: string) => string, t: (k: string) => string): ColumnDef[] {
  return [
    { key: "number", label: tf("number"), sortable: true, type: "link", hrefTemplate: "/finance/assets/{id}" },
    { key: "name", label: tf("name"), bilingual: "name" },
    { key: "category", label: tf("category"), bilingual: "category.name" },
    { key: "acquisitionDate", label: t("acquisitionDate"), type: "date", sortable: true },
    { key: "method", label: t("depMethod"), type: "enum", enumName: "DepreciationMethod" },
    { key: "cost", label: t("cost"), type: "money", align: "end", sortable: true },
    { key: "accumulated", label: t("accumulated"), type: "money", align: "end" },
    { key: "netBook", label: t("netBook"), type: "money", align: "end" },
    { key: "status", label: tf("status"), type: "enum", enumName: "AssetStatus", tones: { ACTIVE: "success", FULLY_DEPRECIATED: "info", DISPOSED: "secondary" } },
  ];
}

// Cron: depreciation for the previous month, all companies.
registerCronJob("depreciation", async () => {
  const companies = await prisma.company.findMany({ where: { isActive: true }, select: { id: true } });
  const now = new Date();
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const out: Record<string, unknown> = {};
  for (const c of companies) {
    try {
      out[c.id] = await runDepreciation(c.id, null, prev);
    } catch (e) {
      out[c.id] = { error: String(e) };
    }
  }
  return out;
});
