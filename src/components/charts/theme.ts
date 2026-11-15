/** Recharts props that follow the app theme (light and dark) instead of the library's white defaults. */
export const chartTooltip = {
  contentStyle: { background: "var(--popover)", color: "var(--popover-foreground)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, boxShadow: "0 6px 16px rgb(0 0 0 / 0.18)" },
  itemStyle: { color: "var(--popover-foreground)" },
  labelStyle: { color: "var(--muted-foreground)", marginBottom: 4 },
  cursor: { fill: "var(--accent)", stroke: "var(--border)", opacity: 0.7 },
} as const;

export const chartAxis = {
  tick: { fill: "var(--muted-foreground)" },
  stroke: "var(--border)",
  tickLine: false,
} as const;
