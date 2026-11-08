import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";

export const fiscalYearSchema = z.object({
  id: z.string().nullable().optional(),
  code: z.string().trim().min(1).max(10),
  name: z.string().trim().min(1).max(60),
  startDate: z.string().min(10),
  endDate: z.string().min(10),
});

export async function listFiscalYears(session: AppSession) {
  return prisma.fiscalYear.findMany({
    where: { companyId: session.companyId },
    orderBy: { startDate: "desc" },
    include: { periods: { orderBy: { number: "asc" } } },
  });
}

export async function saveFiscalYear(session: AppSession, input: z.infer<typeof fiscalYearSchema>) {
  const start = new Date(input.startDate);
  const end = new Date(input.endDate);
  if (end <= start) throw new Error("END_BEFORE_START");
  if (input.id) {
    const fy = await prisma.fiscalYear.findFirst({ where: { id: input.id, companyId: session.companyId } });
    if (!fy) throw new Error("NOT_FOUND");
    return prisma.fiscalYear.update({ where: { id: input.id }, data: { code: input.code, name: input.name } });
  }
  return prisma.$transaction(async (tx) => {
    const fy = await tx.fiscalYear.create({ data: { companyId: session.companyId, code: input.code, name: input.name, startDate: start, endDate: end, createdById: session.userId } });
    // Generate monthly periods between start and end
    const periods: { number: number; name: string; startDate: Date; endDate: Date }[] = [];
    let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    let n = 1;
    while (cursor <= end && n <= 13) {
      const pStart = n === 1 ? start : cursor;
      const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0));
      const pEnd = monthEnd > end ? end : monthEnd;
      periods.push({ number: n, name: `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`, startDate: pStart, endDate: pEnd });
      cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
      n++;
    }
    await tx.fiscalPeriod.createMany({ data: periods.map((p) => ({ ...p, fiscalYearId: fy.id, companyId: session.companyId })) });
    return fy;
  });
}

export async function setPeriodStatus(session: AppSession, periodId: string, status: "OPEN" | "CLOSED" | "LOCKED") {
  const p = await prisma.fiscalPeriod.findFirst({ where: { id: periodId, companyId: session.companyId } });
  if (!p) throw new Error("NOT_FOUND");
  if (p.status === "LOCKED" && !session.isSuperAdmin) throw new Error("FORBIDDEN");
  return prisma.fiscalPeriod.update({ where: { id: periodId }, data: { status } });
}

export async function setYearStatus(session: AppSession, yearId: string, status: "OPEN" | "CLOSED" | "LOCKED") {
  const fy = await prisma.fiscalYear.findFirst({ where: { id: yearId, companyId: session.companyId } });
  if (!fy) throw new Error("NOT_FOUND");
  await prisma.$transaction([
    prisma.fiscalYear.update({ where: { id: yearId }, data: { status } }),
    prisma.fiscalPeriod.updateMany({ where: { fiscalYearId: yearId }, data: { status } }),
  ]);
  return true;
}

/** Finds the open period containing a date; throws if closed/missing. Used by the posting engine. */
export async function requireOpenPeriod(companyId: string, date: Date) {
  const period = await prisma.fiscalPeriod.findFirst({ where: { companyId, startDate: { lte: date }, endDate: { gte: date } } });
  if (!period) throw new Error("NO_FISCAL_PERIOD");
  if (period.status !== "OPEN") throw new Error("PERIOD_CLOSED");
  return period;
}
