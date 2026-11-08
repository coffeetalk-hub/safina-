"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, PagedResult } from "@/components/data-table/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { removeUserAction, saveUserAction } from "@/modules/foundation/users/actions";

type Opt = { value: string; label: string };
type Row = Record<string, unknown>;
type FormValues = { id?: string; email: string; nameAr: string; nameEn: string; phone: string; locale: "ar" | "en"; password: string; isActive: boolean; isSuperAdmin: boolean; roleIds: string[]; companyIds: string[] };

export function UsersClient({ data, columns, roles, companies, isSuperAdmin, can }: { data: PagedResult<Row>; columns: ColumnDef[]; roles: Opt[]; companies: Opt[]; isSuperAdmin: boolean; can: { create: boolean; edit: boolean; delete: boolean } }) {
  const t = useTranslations("foundation.users");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Row | null>(null);
  const [loading, setLoading] = React.useState(false);
  const form = useForm<FormValues>();

  const openDialog = (row: Row | null) => {
    setEditing(row);
    form.reset(
      row
        ? { id: String(row.id), email: String(row.email), nameAr: String(row.nameAr), nameEn: String(row.nameEn), phone: String(row.phone ?? ""), locale: row.locale as "ar" | "en", password: "", isActive: !!row.isActive, isSuperAdmin: !!row.isSuperAdmin, roleIds: (row.roleIds as string[]) ?? [], companyIds: (row.companyIds as string[]) ?? [] }
        : { email: "", nameAr: "", nameEn: "", phone: "", locale: "ar", password: "", isActive: true, isSuperAdmin: false, roleIds: [], companyIds: [] },
    );
    setOpen(true);
  };

  const onSubmit = async (v: FormValues) => {
    setLoading(true);
    const res = await saveUserAction({ ...v, phone: v.phone || null, password: v.password || null });
    setLoading(false);
    if (res.ok) {
      toast.success(tc("saved"));
      setOpen(false);
      router.refresh();
    } else toast.error(te.has(res.error) ? te(res.error) : res.error);
  };

  return (
    <>
      <DataTable
        tableKey="users"
        columns={columns}
        data={data}
        exportResource="users"
        filters={[
          { key: "roleId", label: tf("role"), type: "select", options: roles },
          { key: "isActive", label: tf("isActive"), type: "boolean" },
        ]}
        onRowClick={can.edit ? openDialog : undefined}
        toolbar={
          can.create && (
            <Button size="sm" onClick={() => openDialog(null)}>
              <Plus /> {t("new")}
            </Button>
          )
        }
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{editing ? t("edit") : t("new")}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="email" rules={{ required: tc("required") }} render={({ field }) => (<FormItem><FormLabel>{tf("email")}</FormLabel><FormControl><Input type="email" dir="ltr" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>{tf("phone")}</FormLabel><FormControl><Input dir="ltr" {...field} /></FormControl></FormItem>)} />
                <FormField control={form.control} name="nameAr" rules={{ required: tc("required") }} render={({ field }) => (<FormItem><FormLabel>{tf("nameAr")}</FormLabel><FormControl><Input dir="rtl" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="nameEn" rules={{ required: tc("required") }} render={({ field }) => (<FormItem><FormLabel>{tf("nameEn")}</FormLabel><FormControl><Input dir="ltr" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="password" rules={editing ? undefined : { required: tc("required"), minLength: 8 }} render={({ field }) => (<FormItem><FormLabel>{tf("password")}</FormLabel><FormControl><Input type="password" dir="ltr" autoComplete="new-password" {...field} /></FormControl>{editing && <p className="text-xs text-muted-foreground">{t("passwordHint")}</p>}<FormMessage /></FormItem>)} />
                <FormField control={form.control} name="locale" render={({ field }) => (<FormItem><FormLabel>{tf("locale")}</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="ar">العربية</SelectItem><SelectItem value="en">English</SelectItem></SelectContent></Select></FormItem>)} />
                <FormField control={form.control} name="isActive" render={({ field }) => (<FormItem className="flex items-center gap-3 space-y-0 pt-2"><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>{tf("isActive")}</FormLabel></FormItem>)} />
                {isSuperAdmin && <FormField control={form.control} name="isSuperAdmin" render={({ field }) => (<FormItem className="flex items-center gap-3 space-y-0 pt-2"><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>{tf("isSuperAdmin")}</FormLabel></FormItem>)} />}
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">{tf("roles")}</div>
                <FormField
                  control={form.control}
                  name="roleIds"
                  render={({ field }) => (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {roles.map((r) => (
                        <label key={r.value} className="flex items-center gap-2 text-sm">
                          <Checkbox checked={field.value?.includes(r.value)} onCheckedChange={(v) => field.onChange(v ? [...(field.value ?? []), r.value] : (field.value ?? []).filter((x) => x !== r.value))} />
                          {r.label}
                        </label>
                      ))}
                    </div>
                  )}
                />
              </div>

              {isSuperAdmin && companies.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">{tf("companies")}</div>
                  <FormField
                    control={form.control}
                    name="companyIds"
                    render={({ field }) => (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {companies.map((c) => (
                          <label key={c.value} className="flex items-center gap-2 text-sm">
                            <Checkbox checked={field.value?.includes(c.value)} onCheckedChange={(v) => field.onChange(v ? [...(field.value ?? []), c.value] : (field.value ?? []).filter((x) => x !== c.value))} />
                            {c.label}
                          </label>
                        ))}
                      </div>
                    )}
                  />
                </div>
              )}

              <DialogFooter className="sm:justify-between">
                <div>
                  {editing && can.delete && (
                    <ConfirmButton title={tc("deleteConfirmTitle")} action={() => removeUserAction(String(editing.id))} variant="ghost" size="sm" onSuccess={() => setOpen(false)}>
                      <Trash2 className="text-destructive" /> <span className="text-destructive">{tc("delete")}</span>
                    </ConfirmButton>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
                  <Button type="submit" disabled={loading}>{loading && <Loader2 className="animate-spin" />} {tc("save")}</Button>
                </div>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
