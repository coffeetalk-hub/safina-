"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ComboOption = { value: string; label: string };

/** Searchable select for long lists (accounts, customers, items). */
export function Combobox({ options, value, onChange, placeholder, className, disabled, allowClear = true, size = "default" }: { options: ComboOption[]; value: string | null | undefined; onChange: (v: string | null) => void; placeholder?: string; className?: string; disabled?: boolean; allowClear?: boolean; size?: "sm" | "default" }) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const selected = options.find((o) => o.value === value);
  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s ? options.filter((o) => o.label.toLowerCase().includes(s)) : options;
    return list.slice(0, 100);
  }, [options, q]);
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setTimeout(() => inputRef.current?.focus(), 0); else setQ(""); }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" disabled={disabled} className={cn("w-full justify-between font-normal", size === "sm" ? "h-8 px-2 text-xs" : "", !selected && "text-muted-foreground", className)}>
          <span className="truncate">{selected ? selected.label : placeholder ?? "—"}</span>
          <span className="flex items-center gap-1 shrink-0">
            {allowClear && selected && !disabled && (
              <X className="size-3.5 opacity-60 hover:opacity-100" onClick={(e) => { e.stopPropagation(); onChange(null); }} />
            )}
            <ChevronsUpDown className="size-3.5 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[260px] p-1" align="start">
        <Input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="…" className="h-8 mb-1" onKeyDown={(e) => { if (e.key === "Enter" && filtered[0]) { onChange(filtered[0].value); setOpen(false); } }} />
        <div className="max-h-64 overflow-y-auto">
          {filtered.length === 0 && <div className="p-2 text-xs text-muted-foreground">—</div>}
          {filtered.map((o) => (
            <button key={o.value} type="button" className={cn("flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-start text-sm hover:bg-accent", o.value === value && "bg-accent")} onClick={() => { onChange(o.value); setOpen(false); }}>
              <Check className={cn("size-3.5", o.value === value ? "opacity-100" : "opacity-0")} />
              <span className="truncate">{o.label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
