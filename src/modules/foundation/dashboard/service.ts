import { prisma } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";
import { can } from "@/core/auth/session";
import { DEFAULT_LAYOUTS, getWidget, type WidgetData } from "@/core/dashboard/registry";
import "./widgets";

export async function loadDashboard(session: AppSession, locale: string): Promise<{ key: string; size: number; data: WidgetData }[]> {
  const ucr = await prisma.userCompanyRole.findMany({ where: { userCompany: { userId: session.userId, companyId: session.companyId } }, include: { role: { include: { dashboards: { where: { companyId: session.companyId } } } } } });
  const keys: string[] = [];
  const push = (k: string) => !keys.includes(k) && keys.push(k);
  for (const r of ucr) {
    const custom = r.role.dashboards[0]?.widgets as string[] | undefined;
    (custom ?? DEFAULT_LAYOUTS[r.role.code] ?? []).forEach(push);
  }
  if (session.isSuperAdmin || keys.length === 0) DEFAULT_LAYOUTS.ADMIN.forEach(push);

  const out: { key: string; size: number; data: WidgetData }[] = [];
  for (const key of keys) {
    const w = getWidget(key);
    if (!w) continue;
    if (w.permission && !can(session, w.permission)) continue;
    try {
      const data = await w.load(session, locale);
      if (data.kind === "links" && data.items.length === 0) continue;
      out.push({ key, size: w.size ?? 1, data });
    } catch (e) {
      console.error("widget failed", key, e);
    }
  }
  return out;
}
