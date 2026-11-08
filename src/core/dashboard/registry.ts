import type { AppSession } from "@/core/auth/session";

/**
 * Dashboard widget registry. Widgets are code-defined; each declares the permission
 * required to see it and a loader returning serialisable data. Role layouts
 * (RoleDashboard) choose which widget keys appear and in what order.
 */
export type WidgetKind = "stat" | "list" | "chart" | "links";

export type WidgetData =
  | { kind: "stat"; value: number | string; hint?: string; href?: string; format?: "number" | "money" }
  | { kind: "list"; items: { title: string; subtitle?: string; href?: string; badge?: string }[]; href?: string }
  | { kind: "chart"; type: "bar" | "line" | "pie"; data: Record<string, unknown>[]; xKey: string; series: { key: string; label: string }[] }
  | { kind: "links"; items: { label: string; href: string }[] };

export type Widget = {
  key: string;
  permission?: string;
  size?: 1 | 2 | 3; // grid columns of 3
  load: (session: AppSession, locale: string) => Promise<WidgetData>;
};

const widgets = new Map<string, Widget>();

export function registerWidget(w: Widget) {
  widgets.set(w.key, w);
}
export function getWidget(key: string) {
  return widgets.get(key);
}
export function allWidgets() {
  return [...widgets.values()];
}

/** Default widget order per role code; used when no RoleDashboard row exists. */
export const DEFAULT_LAYOUTS: Record<string, string[]> = {
  ADMIN: ["pendingApprovals", "unreadNotifications", "customersCount", "vendorsCount", "employeesCount", "expiringDocuments", "recentAudit", "quickLinks"],
  ACCOUNTANT: ["pendingApprovals", "customersCount", "vendorsCount", "recentAudit", "quickLinks"],
  FINANCE_MANAGER: ["pendingApprovals", "customersCount", "vendorsCount", "recentAudit", "quickLinks"],
  SALES: ["pendingApprovals", "customersCount", "quickLinks"],
  PURCHASING: ["pendingApprovals", "vendorsCount", "quickLinks"],
  HR: ["pendingApprovals", "employeesCount", "expiringDocuments", "quickLinks"],
  EMPLOYEE: ["unreadNotifications", "quickLinks"],
  APPROVER: ["pendingApprovals", "unreadNotifications"],
};
