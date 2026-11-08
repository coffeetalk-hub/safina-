import { prisma } from "@/lib/prisma";
import { registerWidget, DEFAULT_LAYOUTS } from "@/core/dashboard/registry";
import { myEmployee } from "./employees";

registerWidget({
  key: "expiringDocuments",
  permission: "hr.document:view",
  load: async (s) => ({ kind: "stat", value: await prisma.employeeDocument.count({ where: { companyId: s.companyId, expiryDate: { lte: new Date(Date.now() + 60 * 86_400_000) } } }), href: "/hr/documents?f.expiring=true" }),
});
registerWidget({
  key: "pendingLeave",
  permission: "hr.leave:view",
  load: async (s) => ({ kind: "stat", value: await prisma.leaveRequest.count({ where: { companyId: s.companyId, status: "PENDING_APPROVAL" } }), href: "/hr/leave?f.status=PENDING_APPROVAL" }),
});
registerWidget({
  key: "onLeaveToday",
  permission: "hr.attendance:view",
  load: async (s, locale) => {
    const today = new Date(new Date().toISOString().slice(0, 10));
    const rows = await prisma.leaveRequest.findMany({ where: { companyId: s.companyId, status: "APPROVED", startDate: { lte: today }, endDate: { gte: today } }, include: { leaveType: { select: { nameAr: true, nameEn: true } } }, take: 8 });
    const emps = await prisma.employee.findMany({ where: { id: { in: rows.map((r) => r.employeeId) } }, select: { id: true, firstNameAr: true, lastNameAr: true, firstNameEn: true, lastNameEn: true } });
    return { kind: "list", href: "/hr/leave", items: rows.map((r) => { const e = emps.find((x) => x.id === r.employeeId); return { title: locale === "ar" ? `${e?.firstNameAr} ${e?.lastNameAr}` : `${e?.firstNameEn} ${e?.lastNameEn}`, subtitle: `${r.startDate.toISOString().slice(0, 10)} → ${r.endDate.toISOString().slice(0, 10)}`, badge: locale === "ar" ? r.leaveType.nameAr : r.leaveType.nameEn, href: "/hr/leave" }; }) };
  },
});
registerWidget({
  key: "payrollCost",
  permission: "hr.payroll:view",
  size: 2,
  load: async (s, locale) => {
    const runs = await prisma.payrollRun.findMany({ where: { companyId: s.companyId, status: { in: ["POSTED", "PAID", "APPROVED", "CALCULATED"] } }, orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }], take: 6 });
    return { kind: "chart", type: "bar", xKey: "period", data: runs.reverse().map((r) => ({ period: `${r.periodYear}-${String(r.periodMonth).padStart(2, "0")}`, net: Math.round(Number(r.totalNet)), gosi: Math.round(Number(r.totalGosiEmployer)) })), series: [{ key: "net", label: locale === "ar" ? "صافي الرواتب" : "Net salaries" }, { key: "gosi", label: locale === "ar" ? "تأمينات صاحب العمل" : "GOSI employer" }] };
  },
});
registerWidget({
  key: "saudization",
  permission: "hr.report:view",
  load: async (s) => { const [total, saudi] = await Promise.all([prisma.employee.count({ where: { companyId: s.companyId, status: { in: ["ACTIVE", "ON_LEAVE"] } } }), prisma.employee.count({ where: { companyId: s.companyId, status: { in: ["ACTIVE", "ON_LEAVE"] }, isSaudi: true } })]); return { kind: "stat", value: `${total ? Math.round((saudi / total) * 1000) / 10 : 0}%`, hint: `${saudi}/${total}`, href: "/hr/reports" }; },
});
registerWidget({
  key: "myLeaveBalance",
  permission: "hr.leave:view",
  load: async (s, locale) => {
    const me = await myEmployee(s);
    if (!me) return { kind: "stat", value: "—", href: "/hr/self" };
    const b = await prisma.leaveBalance.findFirst({ where: { employeeId: me.id, year: new Date().getUTCFullYear(), leaveType: { code: "ANNUAL" } } });
    const remaining = b ? Number(b.entitled) + Number(b.carried) + Number(b.adjusted) - Number(b.taken) : 0;
    return { kind: "stat", value: remaining, hint: locale === "ar" ? "يوم إجازة سنوية" : "annual leave days", href: "/hr/self" };
  },
});
DEFAULT_LAYOUTS.HR = ["pendingApprovals", "employeesCount", "pendingLeave", "expiringDocuments", "saudization", "payrollCost", "onLeaveToday", "quickLinks"];
DEFAULT_LAYOUTS.EMPLOYEE = ["myLeaveBalance", "unreadNotifications", "quickLinks"];
DEFAULT_LAYOUTS.ADMIN = [...DEFAULT_LAYOUTS.ADMIN, "pendingLeave"];
