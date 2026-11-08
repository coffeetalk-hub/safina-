import { z } from "zod";
import { requirePermission, requireSession, type AppSession, ForbiddenError } from "@/core/auth/session";
import { runWithContext } from "@/core/context";
import { Prisma } from "@prisma/client";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Wraps a server action: authenticates, checks permission, validates input with Zod,
 * runs inside a request context (so Prisma audit extension knows who/which company),
 * and converts thrown errors into a serialisable result.
 */
export async function runAction<S extends z.ZodTypeAny, T>(
  opts: { permission?: string | readonly string[]; schema?: S },
  input: unknown,
  fn: (data: z.infer<S>, session: AppSession) => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    const session = opts.permission ? await requirePermission(opts.permission) : await requireSession();
    let data = input as z.infer<S>;
    if (opts.schema) {
      const parsed = opts.schema.safeParse(input);
      if (!parsed.success) {
        const fieldErrors: Record<string, string[]> = {};
        for (const issue of parsed.error.issues) {
          const k = issue.path.join(".") || "_";
          (fieldErrors[k] ??= []).push(issue.message);
        }
        return { ok: false, error: "VALIDATION", fieldErrors };
      }
      data = parsed.data;
    }
    const result = await runWithContext(
      { userId: session.userId, companyId: session.companyId, ip: session.ip, userAgent: session.userAgent },
      () => fn(data, session),
    );
    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, error: toMessage(e) };
  }
}

function toMessage(e: unknown): string {
  if (e instanceof ForbiddenError) return "FORBIDDEN";
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") return "DUPLICATE";
    if (e.code === "P2003") return "IN_USE";
    if (e.code === "P2025") return "NOT_FOUND";
  }
  if (e instanceof Error) {
    // Next.js redirect() throws — rethrow so navigation works
    if ((e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e;
    // Database errors carry SQL and schema details: log them, never show them to the user.
    if (e.name.startsWith("PrismaClient")) {
      console.error("[action] database error", e);
      return "UNKNOWN";
    }
    return e.message;
  }
  console.error("[action] unexpected error", e);
  return "UNKNOWN";
}
