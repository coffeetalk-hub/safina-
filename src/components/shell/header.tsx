"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { signOut } from "next-auth/react";
import { Bell, Building2, Globe, LogOut, Menu, User } from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Avatar } from "@/components/ui/misc";
import { Sidebar } from "./sidebar";
import { switchCompanyAction, switchLocaleAction } from "./actions";
import type { NavGroup } from "./nav-config";

export type HeaderProps = {
  user: { nameAr: string; nameEn: string; email: string };
  companies: { id: string; nameAr: string; nameEn: string }[];
  activeCompanyId: string;
  unread: number;
  permissions: string[];
  extraGroups?: NavGroup[];
};

export function Header({ user, companies, activeCompanyId, unread, permissions, extraGroups }: HeaderProps) {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const name = locale === "ar" ? user.nameAr : user.nameEn;
  const company = companies.find((c) => c.id === activeCompanyId);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-1 sm:gap-2 border-b bg-background/95 px-2 sm:px-3 backdrop-blur no-print overflow-hidden">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="menu">
        <Menu />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="start" className="p-0 w-72">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="p-4 font-bold">⛵ Safina ERP</div>
          <Sidebar permissions={permissions} extraGroups={extraGroups} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="min-w-0 max-w-[140px] sm:max-w-[220px]">
            <Building2 className="shrink-0" /> <span className="truncate">{company ? (locale === "ar" ? company.nameAr : company.nameEn) : t("selectCompany")}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>{t("company")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={activeCompanyId}
            onValueChange={async (id) => {
              await switchCompanyAction(id);
              router.refresh();
            }}
          >
            {companies.map((c) => (
              <DropdownMenuRadioItem key={c.id} value={c.id}>
                {locale === "ar" ? c.nameAr : c.nameEn}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="ms-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="px-2"
          onClick={async () => {
            const next = locale === "ar" ? "en" : "ar";
            await switchLocaleAction(next);
            router.replace(pathname, { locale: next });
          }}
        >
          <Globe /> <span className="hidden sm:inline">{locale === "ar" ? "EN" : "عربي"}</span>
        </Button>
        <Button variant="ghost" size="icon" asChild className="relative">
          <Link href="/notifications" aria-label="notifications">
            <Bell />
            {unread > 0 && (
              <span className="absolute -top-0.5 -end-0.5 min-w-4 h-4 rounded-full bg-destructive px-1 text-[10px] font-bold text-white flex items-center justify-center">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2">
              <Avatar name={name} />
              <span className="hidden md:inline max-w-[140px] truncate">{name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="font-medium">{name}</div>
              <div className="text-xs text-muted-foreground" dir="ltr">{user.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile">
                <User /> {t("profile")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => signOut({ callbackUrl: `/${locale}/login` })}>
              <LogOut /> {t("signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
