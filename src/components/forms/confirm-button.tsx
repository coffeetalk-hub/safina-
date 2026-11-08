"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button, type buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import type { ActionResult } from "@/core/action";
import type { VariantProps } from "class-variance-authority";

export function ConfirmButton({
  title,
  description,
  action,
  children,
  variant = "destructive",
  size,
  onSuccess,
  confirmLabel,
  disabled,
}: {
  title: string;
  description?: string;
  action: () => Promise<ActionResult>;
  children: React.ReactNode;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  onSuccess?: (data: unknown) => void;
  confirmLabel?: string;
  disabled?: boolean;
}) {
  const t = useTranslations("common");
  const te = useTranslations("errors");
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)} disabled={disabled} type="button">
        {children}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              variant={variant}
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                const res = await action();
                setLoading(false);
                if (res.ok) {
                  toast.success(t("done"));
                  setOpen(false);
                  onSuccess?.(res.data);
                  router.refresh();
                } else toast.error(te.has(res.error) ? te(res.error) : res.error);
              }}
            >
              {loading && <Loader2 className="animate-spin" />} {confirmLabel ?? t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
