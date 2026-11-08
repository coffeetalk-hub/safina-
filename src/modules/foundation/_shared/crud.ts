import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";
import { orderByFrom, skipTake, type ListParams, type PagedResult } from "@/components/data-table/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Delegate = {
  findMany: (args: any) => Promise<any[]>;
  findFirst: (args: any) => Promise<any>;
  count: (args: any) => Promise<number>;
  create: (args: any) => Promise<any>;
  update: (args: any) => Promise<any>;
  delete: (args: any) => Promise<any>;
};

export type CrudConfig<S extends z.ZodTypeAny> = {
  model: string; // prisma delegate name e.g. "customer"
  resource: string; // permission resource e.g. "customer"
  schema: S;
  searchFields: string[];
  sortFields: string[];
  defaultOrder: Record<string, "asc" | "desc">;
  include?: Record<string, unknown>;
  /** Map URL filters to a Prisma where clause */
  filterWhere?: (filters: Record<string, string>) => Record<string, unknown>;
  /** Hook to mutate data before create/update (e.g. auto-code) */
  beforeSave?: (data: z.infer<S>, session: AppSession, id: string | null) => Promise<z.infer<S>>;
  /** Scope by company (default true) */
  companyScoped?: boolean;
};

export function makeCrud<S extends z.ZodTypeAny>(cfg: CrudConfig<S>) {
  const delegate = () => (prisma as unknown as Record<string, Delegate>)[cfg.model];
  const scoped = cfg.companyScoped !== false;

  function baseWhere(session: AppSession, p: ListParams) {
    const where: Record<string, unknown> = scoped ? { companyId: session.companyId } : {};
    if (p.q) where.OR = cfg.searchFields.map((f) => ({ [f]: { contains: p.q, mode: "insensitive" } }));
    if (cfg.filterWhere) Object.assign(where, cfg.filterWhere(p.filters));
    else {
      for (const [k, v] of Object.entries(p.filters)) {
        if (v === "true" || v === "false") where[k] = v === "true";
        else where[k] = v;
      }
    }
    return where;
  }

  async function list<T = any>(session: AppSession, p: ListParams): Promise<PagedResult<T>> {
    const where = baseWhere(session, p);
    const [rows, total] = await Promise.all([
      delegate().findMany({ where, orderBy: orderByFrom(p.sort, cfg.sortFields, cfg.defaultOrder), ...skipTake(p), include: cfg.include }),
      delegate().count({ where }),
    ]);
    return { rows, total, page: p.page, pageSize: p.pageSize };
  }

  async function all<T = any>(session: AppSession, p: ListParams): Promise<T[]> {
    return delegate().findMany({ where: baseWhere(session, p), orderBy: orderByFrom(p.sort, cfg.sortFields, cfg.defaultOrder), take: 10_000, include: cfg.include });
  }

  async function get(session: AppSession, id: string) {
    return delegate().findFirst({ where: scoped ? { id, companyId: session.companyId } : { id }, include: cfg.include });
  }

  async function save(session: AppSession, input: z.infer<S> & { id?: string | null }) {
    const { id, ...rest } = input as { id?: string | null } & Record<string, unknown>;
    let data = rest as z.infer<S>;
    if (cfg.beforeSave) data = await cfg.beforeSave(data, session, id ?? null);
    if (id) {
      const existing = await get(session, id);
      if (!existing) throw new Error("NOT_FOUND");
      return delegate().update({ where: { id }, data: { ...(data as object), updatedById: session.userId } });
    }
    return delegate().create({ data: { ...(data as object), ...(scoped ? { companyId: session.companyId } : {}), createdById: session.userId } });
  }

  async function remove(session: AppSession, id: string) {
    const existing = await get(session, id);
    if (!existing) throw new Error("NOT_FOUND");
    return delegate().delete({ where: { id } });
  }

  return { list, all, get, save, remove, cfg };
}

/** Common Zod helpers */
export const zStr = (max = 200) => z.string().trim().min(1).max(max);
export const zOptStr = (max = 500) => z.string().trim().max(max).nullable().optional().transform((v) => (v === "" ? null : v ?? null));
export const zMoney = z.coerce.number().min(0).default(0);
export const zDate = z
  .union([z.string(), z.date(), z.null(), z.undefined()])
  .transform((v) => (v ? new Date(v) : null));
export const zBool = z.coerce.boolean().default(false);
