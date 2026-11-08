"use client";

import * as React from "react";
import { Toast as ToastPrimitive } from "radix-ui";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; kind: ToastKind; title: string; description?: string };

const ToastContext = React.createContext<{ push: (t: Omit<ToastItem, "id">) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const push = React.useCallback((t: Omit<ToastItem, "id">) => {
    setItems((prev) => [...prev, { ...t, id: Date.now() + Math.random() }]);
  }, []);
  return (
    <ToastContext.Provider value={{ push }}>
      <ToastPrimitive.Provider swipeDirection="right" duration={4000}>
        {children}
        {items.map((t) => (
          <ToastPrimitive.Root
            key={t.id}
            onOpenChange={(open) => !open && setItems((p) => p.filter((x) => x.id !== t.id))}
            className={cn(
              "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-80 data-[state=open]:slide-in-from-bottom-full group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-md border p-4 pe-8 shadow-lg",
              t.kind === "error" && "border-destructive/40",
              t.kind === "success" && "border-emerald-300",
            )}
          >
            {t.kind === "success" && <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />}
            {t.kind === "error" && <XCircle className="size-5 text-destructive shrink-0" />}
            {t.kind === "info" && <Info className="size-5 text-sky-600 shrink-0" />}
            <div className="grid gap-1">
              <ToastPrimitive.Title className="text-sm font-semibold">{t.title}</ToastPrimitive.Title>
              {t.description && <ToastPrimitive.Description className="text-sm text-muted-foreground">{t.description}</ToastPrimitive.Description>}
            </div>
            <ToastPrimitive.Close className="absolute top-2 end-2 rounded-md p-1 text-foreground/50 hover:text-foreground cursor-pointer">
              <X className="size-4" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed bottom-0 end-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:max-w-[420px]" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return {
    success: (title: string, description?: string) => ctx.push({ kind: "success", title, description }),
    error: (title: string, description?: string) => ctx.push({ kind: "error", title, description }),
    info: (title: string, description?: string) => ctx.push({ kind: "info", title, description }),
  };
}
