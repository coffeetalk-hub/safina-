import * as React from "react";
import { cn } from "@/lib/utils";

export function Separator({ className, orientation = "horizontal", ...props }: React.ComponentProps<"div"> & { orientation?: "horizontal" | "vertical" }) {
  return <div role="separator" className={cn("bg-border shrink-0", orientation === "horizontal" ? "h-px w-full" : "h-full w-px", className)} {...props} />;
}

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("bg-accent animate-pulse rounded-md", className)} {...props} />;
}

export function Alert({ className, variant = "default", ...props }: React.ComponentProps<"div"> & { variant?: "default" | "destructive" | "success" | "warning" }) {
  const v = {
    default: "bg-card text-card-foreground",
    destructive: "text-destructive bg-destructive/5 border-destructive/30 [&>svg]:text-destructive",
    success: "text-emerald-800 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300",
    warning: "text-amber-800 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300",
  }[variant];
  return <div role="alert" className={cn("relative w-full rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5", v, className)} {...props} />;
}
export function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight", className)} {...props} />;
}
export function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed", className)} {...props} />;
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
  return (
    <span className={cn("bg-primary/10 text-primary inline-flex size-8 items-center justify-center rounded-full text-xs font-semibold", className)}>
      {initials}
    </span>
  );
}
