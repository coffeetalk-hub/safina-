"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { WidgetData } from "@/core/dashboard/registry";
import { formatMoney, formatNumber } from "@/lib/money";
import { cn } from "@/lib/utils";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export function WidgetGrid({ widgets }: { widgets: { key: string; size: number; data: WidgetData }[] }) {
  const t = useTranslations("widgets");
  const tn = useTranslations("nav.items");
  const locale = useLocale();
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {widgets.map((w) => {
        const title = t.has(w.key) ? t(w.key) : w.key;
        return (
          <Card key={w.key} className={cn(w.size === 2 && "lg:col-span-2", w.size === 3 && "lg:col-span-3")}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              {w.data.kind === "stat" && (
                <div>
                  <div className="text-3xl font-semibold tabular-nums" dir="ltr">
                    {w.data.format === "money" ? formatMoney(Number(w.data.value), locale) : typeof w.data.value === "number" ? formatNumber(w.data.value, locale, 0) : w.data.value}
                  </div>
                  {w.data.hint && <div className="text-xs text-muted-foreground">{w.data.hint}</div>}
                  {w.data.href && (
                    <Link href={w.data.href} className="mt-2 inline-block text-xs text-primary hover:underline">
                      →
                    </Link>
                  )}
                </div>
              )}
              {w.data.kind === "list" && (
                <ul className="divide-y text-sm">
                  {w.data.items.length === 0 && <li className="py-2 text-muted-foreground">—</li>}
                  {w.data.items.map((i, idx) => (
                    <li key={idx} className="flex items-center gap-2 py-1.5">
                      <div className="min-w-0 flex-1">
                        {i.href ? <Link href={i.href} className="hover:underline truncate block">{i.title}</Link> : <div className="truncate">{i.title}</div>}
                        {i.subtitle && <div className="text-xs text-muted-foreground truncate" dir="auto">{i.subtitle}</div>}
                      </div>
                      {i.badge && <Badge variant="outline">{i.badge}</Badge>}
                    </li>
                  ))}
                </ul>
              )}
              {w.data.kind === "links" && (
                <div className="flex flex-wrap gap-2">
                  {w.data.items.map((i) => (
                    <Button key={i.href} variant="outline" size="sm" asChild>
                      <Link href={i.href}>{tn.has(i.label) ? tn(i.label) : i.label}</Link>
                    </Button>
                  ))}
                </div>
              )}
              {w.data.kind === "chart" && (
                <div className="h-56" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    {w.data.type === "bar" ? (
                      <BarChart data={w.data.data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey={w.data.xKey} fontSize={11} />
                        <YAxis fontSize={11} />
                        <Tooltip />
                        <Legend />
                        {w.data.series.map((s, i) => <Bar key={s.key} dataKey={s.key} name={s.label} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />)}
                      </BarChart>
                    ) : w.data.type === "line" ? (
                      <LineChart data={w.data.data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey={w.data.xKey} fontSize={11} />
                        <YAxis fontSize={11} />
                        <Tooltip />
                        <Legend />
                        {w.data.series.map((s, i) => <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={COLORS[i % COLORS.length]} dot={false} />)}
                      </LineChart>
                    ) : (
                      <PieChart>
                        <Pie data={w.data.data} dataKey={w.data.series[0]?.key} nameKey={w.data.xKey} outerRadius={80} label>
                          {w.data.data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    )}
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
