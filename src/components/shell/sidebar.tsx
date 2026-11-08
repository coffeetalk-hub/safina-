"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { NAV, type NavGroup } from "./nav-config";
import { cn } from "@/lib/utils";

export function Sidebar({ permissions, extraGroups = [], onNavigate }: { permissions: string[]; extraGroups?: NavGroup[]; onNavigate?: () => void }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const all = permissions.includes("*");
  const canSee = (p?: string) => !p || all || permissions.includes(p);
  const groups = [...NAV, ...extraGroups];

  return (
    <nav className="flex flex-col gap-4 p-3 text-sm">
      {groups.map((g) => {
        const items = g.items.filter((i) => canSee(i.permission));
        if (items.length === 0) return null;
        return (
          <div key={g.key}>
            <div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/60">{t(`groups.${g.key}`)}</div>
            <ul className="space-y-0.5">
              {items.map((i) => {
                const active = pathname === i.href || pathname.startsWith(i.href + "/");
                return (
                  <li key={i.key}>
                    <Link
                      href={i.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-sidebar-accent",
                        active && "bg-sidebar-accent font-medium text-primary",
                      )}
                    >
                      <i.icon className="size-4 shrink-0" />
                      <span className="truncate">{t(`items.${i.key}`)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
