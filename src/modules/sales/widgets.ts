import { prisma } from "@/lib/prisma";
import { registerWidget, DEFAULT_LAYOUTS } from "@/core/dashboard/registry";
import { D } from "@/lib/money";

registerWidget({
  key: "pipelineValue",
  permission: "sales.opportunity:view",
  load: async (s) => {
    const rows = await prisma.opportunity.findMany({ where: { companyId: s.companyId, closedAt: null }, select: { amount: true, probability: true } });
    const weighted = rows.reduce((a, r) => a.plus(D(r.amount).times(r.probability).div(100)), D(0));
    return { kind: "stat", value: weighted.toNumber(), format: "money", hint: `${rows.length}`, href: "/sales/pipeline" };
  },
});
registerWidget({
  key: "quotesAwaiting",
  permission: "sales.quotation:view",
  load: async (s) => ({ kind: "stat", value: await prisma.quotation.count({ where: { companyId: s.companyId, status: "SENT" } }), href: "/sales/quotations?f.status=SENT" }),
});
registerWidget({
  key: "ordersToInvoice",
  permission: "sales.order:view",
  load: async (s) => ({ kind: "stat", value: await prisma.salesOrder.count({ where: { companyId: s.companyId, status: { in: ["CONFIRMED", "PARTIALLY_INVOICED"] } } }), href: "/sales/orders?f.status=CONFIRMED" }),
});
registerWidget({
  key: "pipelineByStage",
  permission: "sales.opportunity:view",
  size: 2,
  load: async (s, locale) => {
    const stages = await prisma.pipelineStage.findMany({ where: { companyId: s.companyId, isActive: true, isLost: false }, orderBy: { order: "asc" }, include: { opportunities: { where: { closedAt: null }, select: { amount: true } } } });
    return { kind: "chart", type: "bar", xKey: "stage", data: stages.map((st) => ({ stage: locale === "ar" ? st.nameAr : st.nameEn, amount: st.opportunities.reduce((a, o) => a + Number(o.amount), 0), count: st.opportunities.length })), series: [{ key: "amount", label: locale === "ar" ? "القيمة" : "Value" }] };
  },
});
registerWidget({
  key: "myActivities",
  load: async (s, locale) => {
    const rows = await prisma.activity.findMany({ where: { companyId: s.companyId, doneAt: null, OR: [{ assigneeId: s.userId }, { createdById: s.userId }] }, orderBy: { dueAt: "asc" }, take: 6 });
    return { kind: "list", items: rows.map((a) => ({ title: a.subject, subtitle: a.dueAt ? a.dueAt.toISOString().slice(0, 10) : (locale === "ar" ? "بدون موعد" : "No due date"), href: a.opportunityId ? `/sales/opportunities/${a.opportunityId}` : "/sales/leads", badge: a.type })) };
  },
});
DEFAULT_LAYOUTS.SALES = ["pipelineValue", "quotesAwaiting", "ordersToInvoice", "pipelineByStage", "myActivities", "customersCount", "quickLinks"];
DEFAULT_LAYOUTS.ADMIN = [...DEFAULT_LAYOUTS.ADMIN.slice(0, 1), "pipelineValue", ...DEFAULT_LAYOUTS.ADMIN.slice(1)];
