/**
 * Permission catalogue. Key format: "<module>.<resource>:<action>".
 * Actions: view | create | edit | approve | delete
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
  purchasing: ["request", "rfq", "order", "contract", "evaluation", "report"],
  hr: ["employee", "contract", "document", "attendance", "leave", "payroll", "loan", "eosb", "wps", "report"],
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

/** Built-in role templates seeded for every company. */
export const ROLE_TEMPLATES: Record<string, { nameAr: string; nameEn: string; permissions: () => Permission[] }> = {
  ADMIN: { nameAr: "مدير النظام", nameEn: "Administrator", permissions: allPermissions },
  ACCOUNTANT: {
    nameAr: "محاسب",
    nameEn: "Accountant",
    permissions: () => [
      ...byModule("finance", ["view", "create", "edit"]),
      ...byModule("foundation", ["view"]),
      ...forResources("foundation", ["account", "costCenter", "customer", "vendor", "item", "tax"], ["create", "edit"]),
      ...byModule("sales", ["view"]),
      ...byModule("purchasing", ["view"]),
    ],
  },
  FINANCE_MANAGER: {
    nameAr: "مدير مالي",
    nameEn: "Finance Manager",
    permissions: () => [...byModule("finance"), ...byModule("foundation", ["view"]), ...byModule("sales", ["view", "approve"]), ...byModule("purchasing", ["view", "approve"])],
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
      ...byModule("purchasing", ["view", "create", "edit"]),
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
      ...forResources("hr", ["attendance", "leave"], ["view", "create"]),
      ...forResources("purchasing", ["request"], ["view", "create"]),
      ...forResources("foundation", ["dashboard"], ["view"]),
    ],
  },
  APPROVER: {
    nameAr: "معتمد",
    nameEn: "Approver",
    permissions: () => [...byModule("finance", ["view", "approve"]), ...byModule("sales", ["view", "approve"]), ...byModule("purchasing", ["view", "approve"]), ...byModule("hr", ["view", "approve"])],
  },
};

function byModule(mod: string, actions: readonly Action[] = ACTIONS): Permission[] {
  return RESOURCES[mod].flatMap((r) => actions.map((a) => `${mod}.${r}:${a}` as Permission));
}
function forResources(mod: string, resources: string[], actions: readonly Action[]): Permission[] {
  return resources.flatMap((r) => actions.map((a) => `${mod}.${r}:${a}` as Permission));
}
