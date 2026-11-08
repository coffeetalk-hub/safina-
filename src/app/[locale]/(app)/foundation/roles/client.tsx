"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Shield, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { removeRoleAction, saveRoleAction } from "@/modules/foundation/roles/actions";
import { cn } from "@/lib/utils";

type Role = { id: string; code: string; nameAr: string; nameEn: string; description: string | null; isSystem: boolean; users: number; permissions: string[] };

export function RolesClient({ roles, resources, actions, can }: { roles: Role[]; resources: Record<string, string[]>; actions: string[]; can: { create: boolean; edit: boolean; delete: boolean } }) {
  const t = useTranslations("foundation.roles");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const tn = useTranslations("nav.groups");
  const locale = useLocale();
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Role | null>(null);
  const [form, setForm] = React.useState({ code: "", nameAr: "", nameEn: "", description: "" });
  const [perms, setPerms] = React.useState<Set<string>>(new Set());
  const [loading, setLoading] = React.useState(false);

  const openDialog = (r: Role | null) => {
    setEditing(r);
    setForm({ code: r?.code ?? "", nameAr: r?.nameAr ?? "", nameEn: r?.nameEn ?? "", description: r?.description ?? "" });
    setPerms(new Set(r?.permissions ?? []));
    setOpen(true);
  };
  const toggle = (keys: string[], on: boolean) =>
    setPerms((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (on ? next.add(k) : next.delete(k)));
      return next;
    });

  const groupLabel = (mod: string) => (mod === "foundation" ? tn("administration") : tn(mod));

  const submit = async () => {
    setLoading(true);
    const res = await saveRoleAction({ id: editing?.id ?? null, ...form, description: form.description || null, permissions: [...perms] });
    setLoading(false);
    if (res.ok) {
      toast.success(tc("saved"));
      setOpen(false);
      router.refresh();
    } else toast.error(te.has(res.error) ? te(res.error) : res.error);
  };

  return (
    <>
      {can.create && (
        <div className="mb-4 flex justify-end">
          <Button onClick={() => openDialog(null)}>
            <Plus /> {t("new")}
          </Button>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {roles.map((r) => (
          <Card key={r.id} className={cn("cursor-pointer hover:border-primary/50", !can.edit && "cursor-default")} onClick={() => can.edit && openDialog(r)}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="size-4 text-primary" /> {locale === "ar" ? r.nameAr : r.nameEn}
                {r.isSystem && <Badge variant="secondary">{t("system")}</Badge>}
              </CardTitle>
              <CardDescription dir="ltr" className="text-start">
                {r.code}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Users className="size-4" /> {r.users}
              </span>
              <span>{r.permissions.length} {tf("permissions")}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle>{editing ? t("edit") : t("new")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>{tf("code")}</Label>
              <Input dir="ltr" value={form.code} disabled={editing?.isSystem} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
            </div>
            <div className="space-y-1">
              <Label>{tf("nameAr")}</Label>
              <Input dir="rtl" value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>{tf("nameEn")}</Label>
              <Input dir="ltr" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} />
            </div>
          </div>
          <div className="text-sm font-medium">{t("permissionMatrix")}</div>
          <div className="max-h-[50vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead>{t("resource")}</TableHead>
                  {actions.map((a) => (
                    <TableHead key={a} className="text-center capitalize">
                      {a}
                    </TableHead>
                  ))}
                  <TableHead className="text-center">{tc("selectAll")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(resources).map(([mod, res]) => (
                  <React.Fragment key={mod}>
                    <TableRow className="bg-muted/40">
                      <TableCell className="font-semibold">{groupLabel(mod)}</TableCell>
                      {actions.map((a) => {
                        const keys = res.map((r) => `${mod}.${r}:${a}`);
                        const all = keys.every((k) => perms.has(k));
                        return (
                          <TableCell key={a} className="text-center">
                            <Checkbox checked={all} onCheckedChange={(v) => toggle(keys, !!v)} />
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center">
                        {(() => {
                          const keys = res.flatMap((r) => actions.map((a) => `${mod}.${r}:${a}`));
                          return <Checkbox checked={keys.every((k) => perms.has(k))} onCheckedChange={(v) => toggle(keys, !!v)} />;
                        })()}
                      </TableCell>
                    </TableRow>
                    {res.map((r) => (
                      <TableRow key={r}>
                        <TableCell className="ps-6 text-sm" dir="ltr">
                          {r}
                        </TableCell>
                        {actions.map((a) => {
                          const k = `${mod}.${r}:${a}`;
                          return (
                            <TableCell key={a} className="text-center">
                              <Checkbox checked={perms.has(k)} onCheckedChange={(v) => toggle([k], !!v)} />
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center">
                          {(() => {
                            const keys = actions.map((a) => `${mod}.${r}:${a}`);
                            return <Checkbox checked={keys.every((k) => perms.has(k))} onCheckedChange={(v) => toggle(keys, !!v)} />;
                          })()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter className="sm:justify-between">
            <div>
              {editing && !editing.isSystem && can.delete && (
                <ConfirmButton title={tc("deleteConfirmTitle")} action={() => removeRoleAction(editing.id)} variant="ghost" size="sm" onSuccess={() => setOpen(false)}>
                  <Trash2 className="text-destructive" /> <span className="text-destructive">{tc("delete")}</span>
                </ConfirmButton>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                {tc("cancel")}
              </Button>
              <Button onClick={submit} disabled={loading || !form.code || !form.nameAr || !form.nameEn}>
                {loading && <Loader2 className="animate-spin" />} {tc("save")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
