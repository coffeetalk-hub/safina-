import { setRequestLocale } from "next-intl/server";
import { requireSession } from "@/core/auth/session";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/shell/header";
import { Sidebar } from "@/components/shell/sidebar";
import { Link } from "@/i18n/navigation";
import "@/modules/finance/register";

export default async function AppLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireSession();
  const [companies, unread] = await Promise.all([
    prisma.company.findMany({ where: { id: { in: session.companyIds }, isActive: true }, select: { id: true, nameAr: true, nameEn: true }, orderBy: { code: "asc" } }),
    prisma.notification.count({ where: { userId: session.userId, isRead: false } }),
  ]);
  const permissions = Array.from(session.permissions);

  return (
    <div className="flex min-h-screen overflow-x-hidden">
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-e bg-sidebar text-sidebar-foreground no-print">
        <div className="flex h-14 items-center border-b px-4 font-bold">
          <Link href="/dashboard">⛵ Safina ERP</Link>
        </div>
        <div className="flex-1 overflow-y-auto">
          <Sidebar permissions={permissions} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          user={{ nameAr: session.nameAr, nameEn: session.nameEn, email: session.email }}
          companies={companies}
          activeCompanyId={session.companyId}
          unread={unread}
          permissions={permissions}
        />
        <main className="flex-1 min-w-0 overflow-x-hidden p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
