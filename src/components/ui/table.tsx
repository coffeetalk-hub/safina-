"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Phone layout for a stacked table: gives each body cell its column heading as `data-label`
 * (shown above the value by the `.stack-mobile` rules in globals.css). Cells that set their
 * own `data-label`, and cells that span columns, are left alone.
 */
function useStackLabels(ref: React.RefObject<HTMLTableElement | null>, enabled: boolean) {
  React.useEffect(() => {
    const table = ref.current;
    if (!enabled || !table) return;
    const apply = () => {
      const heads = Array.from(table.querySelectorAll<HTMLTableCellElement>(":scope > thead > tr:last-child > th")).map((th) => th.textContent?.trim() ?? "");
      table.querySelectorAll<HTMLTableRowElement>(":scope > tbody > tr, :scope > tfoot > tr").forEach((tr) => {
        let col = 0;
        for (const td of Array.from(tr.cells)) {
          const label = heads[col];
          col += td.colSpan;
          if (td.colSpan > 1 || !label) continue;
          if (td.dataset.label === undefined || td.dataset.autoLabel !== undefined) {
            if (td.dataset.label !== label) td.dataset.label = label;
            td.dataset.autoLabel = "";
          }
        }
      });
    };
    apply();
    // Rows come and go in editors (add line, delete line): label the new ones too.
    const observer = new MutationObserver(apply);
    observer.observe(table, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [ref, enabled]);
}

/**
 * `stack`: on phones, show each row as a card instead of scrolling sideways.
 * Use `stack="flat"` when the table already sits inside a card.
 */
function Table({ className, stack, ...props }: React.ComponentProps<"table"> & { stack?: boolean | "flat" }) {
  const ref = React.useRef<HTMLTableElement>(null);
  useStackLabels(ref, Boolean(stack));
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table ref={ref} className={cn("w-full caption-bottom text-sm", stack && "stack-mobile", stack === "flat" && "stack-flat", className)} {...props} />
    </div>
  );
}
function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead className={cn("[&_tr]:border-b", className)} {...props} />;
}
function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}
function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return <tfoot className={cn("bg-muted/50 border-t font-medium [&>tr]:last:border-b-0", className)} {...props} />;
}
function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return <tr className={cn("hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors", className)} {...props} />;
}
function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return <th className={cn("text-foreground h-10 px-2 text-start align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pe-0", className)} {...props} />;
}
function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return <td className={cn("p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pe-0", className)} {...props} />;
}
function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return <caption className={cn("text-muted-foreground mt-4 text-sm", className)} {...props} />;
}

export { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow };
