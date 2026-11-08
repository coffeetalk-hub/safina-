import { listPage, type SP } from "@/modules/foundation/_shared/page-helpers";
import { lookups } from "@/modules/foundation/_shared/lookups";
import { listUsers, userColumns } from "@/modules/foundation/users/service";
import { PageHeader } from "@/components/shell/page-header";
import { plain } from "@/components/data-table/types";
import { prisma } from "@/lib/prisma";
import { UsersClient } from "./client";

export default async function UsersPage({ searchParams }: { searchParams: SP }) {
  const { session, locale, params, t, tf, perms } = await listPage("user", searchParams);
  const [data, lk, companies] = await Promise.all([
    listUsers(session, params, locale),
    lookups(session.companyId, locale),
    session.isSuperAdmin ? prisma.company.findMany({ where: { isActive: true }, select: { id: true, code: true, nameAr: true, nameEn: true } }) : Promise.resolve([]),
  ]);
  return (
    <>
      <PageHeader title={t("users.title")} />
      <UsersClient
        data={plain(data)}
        columns={userColumns(tf)}
        roles={lk.roles}
        companies={companies.map((c) => ({ value: c.id, label: `${c.code} · ${locale === "ar" ? c.nameAr : c.nameEn}` }))}
        isSuperAdmin={session.isSuperAdmin}
        can={perms}
      />
    </>
  );
}
