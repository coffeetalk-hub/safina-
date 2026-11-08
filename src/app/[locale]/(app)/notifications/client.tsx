"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { markReadAction } from "@/modules/foundation/notifications/actions";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Item = { id: string; title: string; body: string | null; link: string | null; isRead: boolean; createdAt: string; type: string };

export function NotificationsClient({ items }: { items: Item[] }) {
  const t = useTranslations("foundation.notifications");
  const locale = useLocale();
  const router = useRouter();
  const unread = items.filter((i) => !i.isRead).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{unread > 0 && <Badge variant="destructive">{unread}</Badge>}</span>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={() => markReadAction("all").then(() => router.refresh())}>
            <CheckCheck /> {t("markAllRead")}
          </Button>
        )}
      </div>
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <Bell className="size-8" /> {t("empty")}
        </div>
      ) : (
        <ul className="divide-y rounded-md border bg-card">
          {items.map((n) => (
            <li key={n.id} className={cn("flex items-start gap-3 p-3", !n.isRead && "bg-primary/5")}>
              <span className={cn("mt-2 size-2 rounded-full", n.isRead ? "bg-transparent" : "bg-primary")} />
              <div className="flex-1 min-w-0">
                {n.link ? (
                  <Link href={n.link} onClick={() => markReadAction(n.id)} className="font-medium hover:underline">
                    {n.title}
                  </Link>
                ) : (
                  <div className="font-medium">{n.title}</div>
                )}
                {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
                <div className="text-xs text-muted-foreground" dir="ltr">
                  {formatDateTime(n.createdAt, locale)}
                </div>
              </div>
              {!n.isRead && (
                <Button variant="ghost" size="icon-sm" onClick={() => markReadAction(n.id).then(() => router.refresh())} aria-label="read">
                  <CheckCheck />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
