import { prisma } from "@/lib/prisma";
import { registerWidget } from "@/core/dashboard/registry";
import { myPendingApprovals } from "../approvals/service";

registerWidget({
  key: "pendingApprovals",
  load: async (s) => {
    const n = (await myPendingApprovals(s)).length;
    return { kind: "stat", value: n, href: "/approvals" };
  },
});
registerWidget({
  key: "unreadNotifications",
  load: async (s) => ({ kind: "stat", value: await prisma.notification.count({ where: { userId: s.userId, isRead: false } }), href: "/notifications" }),
});
registerWidget({
  key: "customersCount",
  permission: "foundation.customer:view",
  load: async (s) => ({ kind: "stat", value: await prisma.customer.count({ where: { companyId: s.companyId, isActive: true } }), href: "/foundation/customers" }),
});
registerWidget({
  key: "vendorsCount",
  permission: "foundation.vendor:view",
  load: async (s) => ({ kind: "stat", value: await prisma.vendor.count({ where: { companyId: s.companyId, isActive: true } }), href: "/foundation/vendors" }),
});
registerWidget({
  key: "employeesCount",
  permission: "foundation.employee:view",
  load: async (s) => ({ kind: "stat", value: await prisma.employee.count({ where: { companyId: s.companyId, status: "ACTIVE" } }), href: "/foundation/employees" }),
});
registerWidget({
  key: "recentAudit",
  permission: "foundation.audit:view",
  size: 2,
  load: async (s, locale) => {
    const rows = await prisma.auditLog.findMany({ where: { companyId: s.companyId }, orderBy: { at: "desc" }, take: 8, include: { user: { select: { nameAr: true, nameEn: true } } } });
    return {
      kind: "list",
      href: "/foundation/audit",
      items: rows.map((r) => ({ title: `${r.entity} · ${r.entityId.slice(0, 8)}`, subtitle: `${r.user ? (locale === "ar" ? r.user.nameAr : r.user.nameEn) : "system"} · ${r.at.toISOString().slice(0, 16).replace("T", " ")}`, badge: r.action })),
    };
  },
});
registerWidget({
  key: "quickLinks",
  load: async () => ({
    kind: "links",
    items: [
      { label: "customers", href: "/foundation/customers" },
      { label: "vendors", href: "/foundation/vendors" },
      { label: "items", href: "/foundation/items" },
      { label: "employees", href: "/foundation/employees" },
      { label: "import", href: "/foundation/import" },
      { label: "settings", href: "/foundation/settings" },
    ],
  }),
});
