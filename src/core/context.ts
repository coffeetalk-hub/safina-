import { AsyncLocalStorage } from "node:async_hooks";

/** Request-scoped context used by the Prisma audit/soft-delete extensions. */
export type RequestContext = {
  userId?: string;
  companyId?: string;
  ip?: string;
  userAgent?: string;
};

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(ctx: RequestContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(ctx, fn);
}

export function getContext(): RequestContext {
  return storage.getStore() ?? {};
}
