-- Aligns the built-in roles of existing companies with the tightened role templates.
-- Company-wide permissions now mean exactly that, and personal access has its own
-- resources (hr.self, purchasing.myRequest). Only system roles are touched.

-- Employees: personal access only.
DELETE FROM "RolePermission" rp USING "Role" r
WHERE rp."roleId" = r."id" AND r."isSystem" AND r."code" = 'EMPLOYEE'
  AND rp."permission" IN ('hr.attendance:view', 'hr.attendance:create', 'hr.leave:view', 'hr.leave:create', 'purchasing.request:view', 'purchasing.request:create');

INSERT INTO "RolePermission" ("id", "roleId", "permission")
SELECT gen_random_uuid()::text, r."id", p.permission
FROM "Role" r
CROSS JOIN (VALUES
  ('hr.self:view'), ('hr.self:create'), ('hr.self:edit'), ('hr.self:delete'),
  ('purchasing.myRequest:view'), ('purchasing.myRequest:create'), ('purchasing.myRequest:edit'), ('purchasing.myRequest:delete')
) AS p(permission)
WHERE r."isSystem" AND r."code" = 'EMPLOYEE'
ON CONFLICT ("roleId", "permission") DO NOTHING;

-- Accountants: no administration, directory or audit log; only the sales and purchasing records they post from.
DELETE FROM "RolePermission" rp USING "Role" r
WHERE rp."roleId" = r."id" AND r."isSystem" AND r."code" = 'ACCOUNTANT'
  AND rp."permission" IN (
    'foundation.company:view', 'foundation.user:view', 'foundation.role:view', 'foundation.audit:view',
    'foundation.numbering:view', 'foundation.approval:view', 'foundation.employee:view', 'foundation.settings:view',
    'sales.lead:view', 'sales.opportunity:view', 'sales.priceList:view', 'sales.portal:view',
    'purchasing.request:view', 'purchasing.rfq:view', 'purchasing.evaluation:view'
  );

-- Finance managers: same administrative limits; no CRM pipeline.
DELETE FROM "RolePermission" rp USING "Role" r
WHERE rp."roleId" = r."id" AND r."isSystem" AND r."code" = 'FINANCE_MANAGER'
  AND rp."permission" IN (
    'foundation.company:view', 'foundation.user:view', 'foundation.role:view', 'foundation.audit:view',
    'foundation.numbering:view', 'foundation.approval:view', 'foundation.employee:view', 'foundation.settings:view',
    'sales.lead:view', 'sales.lead:approve', 'sales.opportunity:view', 'sales.opportunity:approve', 'sales.portal:view', 'sales.portal:approve'
  );

-- Approvers: no salaries, employee files or CRM pipeline.
DELETE FROM "RolePermission" rp USING "Role" r
WHERE rp."roleId" = r."id" AND r."isSystem" AND r."code" = 'APPROVER'
  AND rp."permission" IN (
    'hr.employee:view', 'hr.employee:approve', 'hr.contract:view', 'hr.contract:approve', 'hr.document:view', 'hr.document:approve',
    'hr.attendance:view', 'hr.attendance:approve', 'hr.payroll:view', 'hr.payroll:approve', 'hr.eosb:view', 'hr.eosb:approve',
    'hr.wps:view', 'hr.wps:approve', 'hr.report:view', 'hr.report:approve',
    'sales.lead:view', 'sales.lead:approve', 'sales.opportunity:view', 'sales.opportunity:approve',
    'sales.priceList:view', 'sales.priceList:approve', 'sales.portal:view', 'sales.portal:approve',
    'purchasing.evaluation:view', 'purchasing.evaluation:approve'
  );

-- HR and administrators get their own self-service too.
INSERT INTO "RolePermission" ("id", "roleId", "permission")
SELECT gen_random_uuid()::text, r."id", p.permission
FROM "Role" r
CROSS JOIN (VALUES ('hr.self:view'), ('hr.self:create'), ('hr.self:edit'), ('hr.self:approve'), ('hr.self:delete')) AS p(permission)
WHERE r."isSystem" AND r."code" IN ('HR', 'ADMIN')
ON CONFLICT ("roleId", "permission") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permission")
SELECT gen_random_uuid()::text, r."id", p.permission
FROM "Role" r
CROSS JOIN (VALUES ('purchasing.myRequest:view'), ('purchasing.myRequest:create'), ('purchasing.myRequest:edit'), ('purchasing.myRequest:approve'), ('purchasing.myRequest:delete')) AS p(permission)
WHERE r."isSystem" AND r."code" = 'ADMIN'
ON CONFLICT ("roleId", "permission") DO NOTHING;
