import { listPage, type SP } from "@/modules/foundation/_shared/page-helpers";
import { listRoles } from "@/modules/foundation/roles/service";
import { PageHeader } from "@/components/shell/page-header";
import { RESOURCES, ACTIONS } from "@/core/rbac/permissions";
import { RolesClient } from "./client";

export default async function RolesPage({ searchParams }: { searchParams: SP }) {
  const { session, t, perms } = await listPage("role", searchParams);
  const roles = await listRoles(session);
  return (
    <>
      <PageHeader title={t("roles.title")} />
      <RolesClient
        roles={roles.map((r) => ({ id: r.id, code: r.code, nameAr: r.nameAr, nameEn: r.nameEn, description: r.description, isSystem: r.isSystem, users: r._count.users, permissions: r.permissions.map((p) => p.permission) }))}
        resources={RESOURCES}
        actions={[...ACTIONS]}
        can={perms}
      />
    </>
  );
}
