import { Prisma, PrismaClient } from "@prisma/client";
import { getContext } from "@/core/context";

/**
 * Models with soft-delete (deletedAt) support. Reads filter them out automatically,
 * `delete` becomes `update({deletedAt})`.
 */
const SOFT_DELETE_MODELS = new Set<string>([
  "Company", "Branch", "FiscalYear", "TaxCode", "User", "Role", "ApprovalPolicy",
  "Account", "CostCenter", "Customer", "Vendor", "Item", "Employee", "Attachment",
  "EmployeeContract", "EmployeeDocument", "LeaveRequest", "EmployeeLoan",
]);

/** Models we never audit (noise or self-referential). */
const NO_AUDIT_MODELS = new Set<string>([
  "AuditLog", "Notification", "EmailOutbox", "UserTablePreference", "DocumentSequence", "ImportJob",
  "PasswordResetToken", "RateLimit", "ScheduledJob",
]);

const AUDITED_ACTIONS = new Set(["create", "update", "delete", "upsert"]);

function toPlain(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => {
      if (v instanceof Prisma.Decimal) return v.toString();
      if (typeof v === "bigint") return v.toString();
      return v;
    }),
  );
}

function computeDiff(before: Record<string, unknown> | null, after: Record<string, unknown> | null) {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const k of keys) {
    if (k === "updatedAt" || k === "passwordHash") continue;
    const a = before?.[k];
    const b = after?.[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) diff[k] = { from: a ?? null, to: b ?? null };
  }
  return diff;
}

function createClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  return base.$extends({
    name: "safina-soft-delete-audit",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const softDelete = SOFT_DELETE_MODELS.has(model);
          const a = args as Record<string, unknown>;

          // ---- soft delete: filter reads
          if (softDelete) {
            if (["findMany", "findFirst", "count", "aggregate", "groupBy", "findFirstOrThrow"].includes(operation)) {
              const where = (a.where ?? {}) as Record<string, unknown>;
              if (where.deletedAt === undefined && !("includeDeleted" in where)) {
                a.where = { ...where, deletedAt: null };
              }
              if ("includeDeleted" in where) {
                const { includeDeleted: _ignored, ...rest } = where;
                void _ignored;
                a.where = rest;
              }
            }
            if (operation === "delete") {
              const ctx = getContext();
              const before = await (base as unknown as Record<string, { findUnique: (x: unknown) => Promise<unknown> }>)[
                lowerFirst(model)
              ].findUnique({ where: a.where });
              const res = await (base as unknown as Record<string, { update: (x: unknown) => Promise<unknown> }>)[
                lowerFirst(model)
              ].update({ where: a.where, data: { deletedAt: new Date(), deletedById: ctx.userId ?? null } });
              await writeAudit(base, model, (res as { id: string }).id, "DELETE", before, res);
              return res;
            }
            if (operation === "deleteMany") {
              const ctx = getContext();
              return (base as unknown as Record<string, { updateMany: (x: unknown) => Promise<unknown> }>)[
                lowerFirst(model)
              ].updateMany({ where: a.where, data: { deletedAt: new Date(), deletedById: ctx.userId ?? null } });
            }
          }

          // ---- audit
          if (!NO_AUDIT_MODELS.has(model) && AUDITED_ACTIONS.has(operation)) {
            let before: unknown = null;
            if ((operation === "update" || operation === "upsert" || operation === "delete") && a.where) {
              try {
                before = await (base as unknown as Record<string, { findUnique: (x: unknown) => Promise<unknown> }>)[
                  lowerFirst(model)
                ].findUnique({ where: a.where });
              } catch {
                before = null;
              }
            }
            const result = await query(args);
            const action = operation === "create" ? "CREATE" : operation === "delete" ? "DELETE" : before ? "UPDATE" : "CREATE";
            const id = (result as { id?: string })?.id;
            if (id) await writeAudit(base, model, id, action, before, result);
            return result;
          }

          return query(args);
        },
      },
    },
  });
}

async function writeAudit(
  base: PrismaClient,
  model: string,
  entityId: string,
  action: "CREATE" | "UPDATE" | "DELETE",
  before: unknown,
  after: unknown,
) {
  const ctx = getContext();
  const b = (before ? toPlain(before) : null) as Record<string, unknown> | null;
  const af = (after ? toPlain(after) : null) as Record<string, unknown> | null;
  if (b) delete b.passwordHash;
  if (af) delete af.passwordHash;
  const companyId = ctx.companyId ?? (af?.companyId as string | undefined) ?? (b?.companyId as string | undefined) ?? null;
  try {
    await base.auditLog.create({
      data: {
        companyId,
        userId: ctx.userId ?? null,
        entity: model,
        entityId,
        action,
        before: (b ?? undefined) as Prisma.InputJsonValue | undefined,
        after: (af ?? undefined) as Prisma.InputJsonValue | undefined,
        diff: action === "UPDATE" ? (computeDiff(b, af) as Prisma.InputJsonValue) : undefined,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
    });
  } catch (e) {
    console.error("audit write failed", e);
  }
}

function lowerFirst(s: string) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

type ExtendedClient = ReturnType<typeof createClient>;

/** Transaction client of the extended Prisma client (what `prisma.$transaction(tx => …)` yields). */
export type Tx = Omit<ExtendedClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;
/** Either the root client or a transaction client. */
export type Db = Tx | ExtendedClient;

const globalForPrisma = globalThis as unknown as { prisma?: ExtendedClient };

export const prisma: ExtendedClient = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export { Prisma };
