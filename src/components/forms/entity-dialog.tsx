"use client";

import * as React from "react";
import { useForm, type DefaultValues, type FieldValues, type Path } from "react-hook-form";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import type { ActionResult } from "@/core/action";
import { DialogAttachments } from "@/components/attachments/attachments-panel";
import { usePendingAttachments } from "@/components/attachments/pending";
import { cn } from "@/lib/utils";

export type FieldType = "text" | "number" | "email" | "password" | "date" | "textarea" | "select" | "switch" | "hidden";

export type FieldConfig = {
  name: string;
  label: string;
  type?: FieldType;
  options?: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  dir?: "ltr" | "rtl";
  colSpan?: 1 | 2;
  step?: string;
  disabled?: boolean;
  description?: string;
  /** Show only when another field equals one of the given values (serialisable — pages are server components) */
  visibleWhen?: { field: string; equals: string | string[] };
};

function isVisible(f: FieldConfig, values: Record<string, unknown>) {
  if (!f.visibleWhen) return true;
  const v = String(values[f.visibleWhen.field] ?? "");
  const eq = f.visibleWhen.equals;
  return Array.isArray(eq) ? eq.includes(v) : eq === v;
}

type Props<T extends FieldValues> = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  fields: FieldConfig[];
  defaultValues: DefaultValues<T>;
  action: (input: unknown) => Promise<ActionResult>;
  onSuccess?: (data: unknown) => void;
  size?: "sm" | "md" | "lg" | "xl";
  columns?: 1 | 2;
  /** Show an attachments box: files queue until the record is saved, then upload with its id. */
  attach?: { entityType: string; entityId?: string | null; canUpload: boolean; canDelete: boolean };
  /** Extra content rendered below generated fields */
  children?: React.ReactNode;
};

export function EntityDialog<T extends FieldValues>({ open, onOpenChange, title, description, fields, defaultValues, action, onSuccess, size = "lg", columns = 2, attach, children }: Props<T>) {
  const t = useTranslations("common");
  const te = useTranslations("errors");
  const ta = useTranslations("foundation.attachments");
  const toast = useToast();
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const form = useForm<T>({ defaultValues });
  const pending = usePendingAttachments();
  const close = (o: boolean) => {
    if (!o) pending.clear();
    onOpenChange(o);
  };

  React.useEffect(() => {
    if (open) form.reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // eslint-disable-next-line react-hooks/incompatible-library -- watch() is needed for conditional fields
  const values = form.watch() as Record<string, unknown>;

  const onSubmit = async (raw: T) => {
    setLoading(true);
    const payload: Record<string, unknown> = { ...raw };
    for (const f of fields) {
      const v = payload[f.name];
      if (f.type === "number") payload[f.name] = v === "" || v === null || v === undefined ? (f.required ? 0 : null) : Number(v);
      if (f.type === "select" && (v === "" || v === "__none")) payload[f.name] = null;
      if ((f.type === "text" || f.type === "email" || f.type === "textarea") && v === "") payload[f.name] = f.required ? "" : null;
      if (f.type === "date" && v === "") payload[f.name] = null;
    }
    const res = await action(payload);
    setLoading(false);
    if (res.ok) {
      const savedId = (res.data as { id?: string } | null)?.id ?? attach?.entityId ?? null;
      if (attach && savedId && pending.files.length) {
        const f = await pending.flush(attach.entityType, savedId);
        if (f.failed.length) toast.error(ta("pendingFailed", { files: f.failed.join(", ") }));
      }
      toast.success(t("saved"));
      close(false);
      onSuccess?.(res.data);
      router.refresh();
    } else {
      if (res.fieldErrors) {
        for (const [k, msgs] of Object.entries(res.fieldErrors)) {
          form.setError(k as Path<T>, { message: msgs[0] });
        }
      }
      toast.error(te.has(res.error) ? te(res.error) : res.error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent size={size}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className={cn("grid gap-4", columns === 2 && "sm:grid-cols-2")}>
              {fields.map((f) => {
                if (f.type === "hidden") return null;
                if (!isVisible(f, values)) return null;
                return (
                  <FormField
                    key={f.name}
                    control={form.control}
                    name={f.name as Path<T>}
                    rules={f.required ? { required: t("required") } : undefined}
                    render={({ field }) => (
                      <FormItem className={cn(f.colSpan === 2 && "sm:col-span-2", f.type === "switch" && "flex items-center gap-3 space-y-0 pt-6")}>
                        <FormLabel>
                          {f.label}
                          {f.required && <span className="text-destructive">*</span>}
                        </FormLabel>
                        <FormControl>
                          {f.type === "textarea" ? (
                            <Textarea {...field} value={field.value ?? ""} placeholder={f.placeholder} disabled={f.disabled} />
                          ) : f.type === "switch" ? (
                            <Switch checked={!!field.value} onCheckedChange={field.onChange} disabled={f.disabled} />
                          ) : f.type === "select" ? (
                            <Select value={field.value ? String(field.value) : "__none"} onValueChange={(v) => field.onChange(v === "__none" ? "" : v)} disabled={f.disabled}>
                              <SelectTrigger>
                                <SelectValue placeholder={f.placeholder} />
                              </SelectTrigger>
                              <SelectContent>
                                {!f.required && <SelectItem value="__none">—</SelectItem>}
                                {(f.options ?? []).map((o) => (
                                  <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              {...field}
                              value={field.value ?? ""}
                              type={f.type ?? "text"}
                              step={f.step ?? (f.type === "number" ? "any" : undefined)}
                              dir={f.dir ?? (f.type === "number" || f.type === "email" || f.type === "date" ? "ltr" : undefined)}
                              placeholder={f.placeholder}
                              disabled={f.disabled}
                            />
                          )}
                        </FormControl>
                        {f.description && <p className="text-xs text-muted-foreground">{f.description}</p>}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                );
              })}
            </div>
            {attach && (attach.canUpload || attach.entityId) && (
              <DialogAttachments key={attach.entityId ?? "new"} entityType={attach.entityType} entityId={attach.entityId ?? null} canUpload={attach.canUpload} canDelete={attach.canDelete} pending={pending} />
            )}
            {children}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="animate-spin" />} {t("save")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
