/**
 * Permission catalogue. Key format: "<module>.<resource>:<action>".
 * Actions: view | create | edit | approve | delete
 *
 * Scope rule: every resource permission is company-wide. `hr.leave:view` means "see
 * every employee's leave". Personal access has its own resources, so that a role
 * can never reach other people's data by accident:
 *   - hr.self             the signed-in user's own HR record (leave, attendance, payslips…)
 *   - purchasing.myRequest purchase requests the signed-in user raised
 */
export const ACTIONS = ["view", "create", "edit", "approve", "delete"] as const;
export type Action = (typeof ACTIONS)[number];

export const RESOURCES: Record<string, string[]> = {
  foundation: [
    "company", "branch", "fiscal", "currency", "tax", "user", "role", "audit",
    "numbering", "approval", "account", "costCenter", "customer", "vendor", "item",
    "employee", "settings", "attachment", "import", "dashboard",
  ],
  finance: [
    "journal", "recurring", "bill", "payment", "invoice", "receipt", "bank", "reconciliation",
    "pettyCash", "asset", "vat", "zatca", "budget", "report",
  ],
  sales: ["lead", "opportunity", "quotation", "order", "priceList", "portal", "report"],
  purchasing: ["request", "myRequest", "rfq", "order", "contract", "evaluation", "report"],
  hr: ["self", "employee", "contract", "document", "attendance", "leave", "payroll", "loan", "eosb", "wps", "report"],
};

export type Permission = `${string}.${string}:${Action}`;

export function allPermissions(): Permission[] {
  const out: Permission[] = [];
  for (const [mod, resources] of Object.entries(RESOURCES)) {
    for (const r of resources) for (const a of ACTIONS) out.push(`${mod}.${r}:${a}`);
  }
  return out;
}

export function perm(module: keyof typeof RESOURCES, resource: string, action: Action): Permission {
  return `${module}.${resource}:${action}`;
}

/** Master data finance staff work with day to day. Deliberately excludes users, roles, audit, settings and the employee directory. */
const FINANCE_MASTER_DATA = ["account", "costCenter", "customer", "vendor", "item", "tax", "branch", "fiscal", "currency", "attachment", "import", "dashboard"];

/** Built-in role templates seeded for every company. */
export const ROLE_TEMPLATES: Record<string, { nameAr: string; nameEn: string; permissions: () => Permission[] }> = {
  ADMIN: { nameAr: "مدير النظام", nameEn: "Administrator", permissions: allPermissions },
  ACCOUNTANT: {
    nameAr: "محاسب",
    nameEn: "Accountant",
    permissions: () => [
      ...byModule("finance", ["view", "create", "edit"]),
      ...forResources("foundation", FINANCE_MASTER_DATA, ["view"]),
      ...forResources("foundation", ["account", "costCenter", "customer", "vendor", "item", "tax"], ["create", "edit"]),
      ...forResources("sales", ["quotation", "order", "report"], ["view"]),
      ...forResources("purchasing", ["order", "contract", "report"], ["view"]),
    ],
  },
  FINANCE_MANAGER: {
    nameAr: "مدير مالي",
    nameEn: "Finance Manager",
    permissions: () => [
      ...byModule("finance"),
      ...forResources("foundation", FINANCE_MASTER_DATA, ["view"]),
      ...forResources("sales", ["quotation", "order", "priceList", "report"], ["view", "approve"]),
      ...forResources("purchasing", ["request", "rfq", "order", "contract", "evaluation", "report"], ["view", "approve"]),
    ],
  },
  SALES: {
    nameAr: "مبيعات",
    nameEn: "Sales",
    permissions: () => [
      ...byModule("sales", ["view", "create", "edit"]),
      ...forResources("foundation", ["customer", "item"], ["view", "create", "edit"]),
      ...forResources("finance", ["invoice", "receipt"], ["view", "create"]),
    ],
  },
  PURCHASING: {
    nameAr: "مشتريات",
    nameEn: "Purchasing",
    permissions: () => [
      ...forResources("purchasing", ["request", "rfq", "order", "contract", "evaluation", "report"], ["view", "create", "edit"]),
      ...forResources("foundation", ["vendor", "item"], ["view", "create", "edit"]),
      ...forResources("finance", ["bill"], ["view", "create"]),
    ],
  },
  HR: {
    nameAr: "موارد بشرية",
    nameEn: "HR",
    permissions: () => [...byModule("hr"), ...forResources("foundation", ["employee", "branch", "costCenter"], ["view", "create", "edit"])],
  },
  EMPLOYEE: {
    nameAr: "موظف",
    nameEn: "Employee",
    permissions: () => [
      ...forResources("hr", ["self"], ["view", "create", "edit", "delete"]),
      ...forResources("purchasing", ["myRequest"], ["view", "create", "edit", "delete"]),
      ...forResources("foundation", ["dashboard"], ["view"]),
    ],
  },
  APPROVER: {
    nameAr: "معتمد",
    nameEn: "Approver",
    permissions: () => [
      ...byModule("finance", ["view", "approve"]),
      ...forResources("sales", ["quotation", "order", "report"], ["view", "approve"]),
      ...forResources("purchasing", ["request", "rfq", "order", "contract", "report"], ["view", "approve"]),
      ...forResources("hr", ["leave", "loan"], ["view", "approve"]),
    ],
  },
};

function byModule(mod: string, actions: readonly Action[] = ACTIONS): Permission[] {
  return RESOURCES[mod].flatMap((r) => actions.map((a) => `${mod}.${r}:${a}` as Permission));
}
function forResources(mod: string, resources: string[], actions: readonly Action[]): Permission[] {
  return resources.flatMap((r) => actions.map((a) => `${mod}.${r}:${a}` as Permission));
}
