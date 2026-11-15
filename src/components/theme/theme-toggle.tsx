"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { readTheme, setTheme, subscribeTheme, type Theme } from "./theme";

const serverTheme = (): Theme => "system";

/** Sun / moon / monitor button that switches between light, dark and the system setting. */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations("common");
  const theme = React.useSyncExternalStore(subscribeTheme, readTheme, serverTheme);
  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={className} aria-label={t("theme")} title={t("theme")} data-testid="theme-toggle">
          <Icon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>{t("theme")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as Theme)}>
          <DropdownMenuRadioItem value="light"><Sun className="size-4" /> {t("themeLight")}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark"><Moon className="size-4" /> {t("themeDark")}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system"><Monitor className="size-4" /> {t("themeSystem")}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
