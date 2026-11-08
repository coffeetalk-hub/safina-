"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2, Upload, Trash2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { saveLogoAction, saveSettingsAction } from "@/modules/foundation/settings/actions";
import type { CompanySettings } from "@/modules/foundation/settings/service";

export function SettingsClient({ settings, hasLogo, company, canEdit }: { settings: CompanySettings; hasLogo: boolean; company: Record<string, string | null>; canEdit: boolean }) {
  const t = useTranslations("foundation.settings");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const toast = useToast();
  const router = useRouter();
  const [s, setS] = React.useState(settings);
  const [loading, setLoading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [logoVersion, setLogoVersion] = React.useState(0);

  const save = async () => {
    setLoading(true);
    const res = await saveSettingsAction(s);
    setLoading(false);
    if (res.ok) toast.success(tc("saved"));
    else toast.error(res.error);
  };
  const uploadLogo = async (file: File | null) => {
    const fd = new FormData();
    if (file) fd.set("file", file);
    const res = await saveLogoAction(fd);
    if (res.ok) {
      toast.success(tc("saved"));
      setLogoVersion((v) => v + 1);
      router.refresh();
    } else toast.error(res.error);
  };

  return (
    <Tabs defaultValue="general">
      <TabsList>
        <TabsTrigger value="general">{t("general")}</TabsTrigger>
        <TabsTrigger value="invoice">{t("invoice")}</TabsTrigger>
      </TabsList>
      <TabsContent value="general" className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{tf("logo")}</CardTitle>
            <CardDescription>{t("logoHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex h-32 items-center justify-center rounded-md border bg-muted/30">
              {hasLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/company-logo?v=${logoVersion}`} alt="logo" className="max-h-28 max-w-full object-contain" />
              ) : (
                <span className="text-sm text-muted-foreground">{tc("none")}</span>
              )}
            </div>
            {canEdit && (
              <div className="flex gap-2">
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => uploadLogo(e.target.files?.[0] ?? null)} />
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload /> {t("uploadLogo")}
                </Button>
                {hasLogo && (
                  <Button variant="ghost" size="sm" onClick={() => uploadLogo(null)}>
                    <Trash2 className="text-destructive" /> {t("removeLogo")}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{tc("company")}</CardTitle>
            <CardDescription>
              <Link href="/foundation/companies" className="underline">
                {tc("edit")}
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-muted-foreground">{tf("nameAr")}</div><div>{company.nameAr}</div>
            <div className="text-muted-foreground">{tf("nameEn")}</div><div>{company.nameEn}</div>
            <div className="text-muted-foreground">{tf("crNumber")}</div><div dir="ltr">{company.crNumber ?? "—"}</div>
            <div className="text-muted-foreground">{tf("vatNumber")}</div><div dir="ltr">{company.vatNumber ?? "—"}</div>
            <div className="text-muted-foreground">{tf("addressAr")}</div><div>{company.addressAr ?? "—"}</div>
            <div className="text-muted-foreground">{tf("addressEn")}</div><div>{company.addressEn ?? "—"}</div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>{tf("paymentTermsDays")}</Label>
              <Input type="number" dir="ltr" value={s.defaultPaymentTermsDays} onChange={(e) => setS({ ...s, defaultPaymentTermsDays: Number(e.target.value) })} disabled={!canEdit} />
            </div>
            <div className="space-y-1">
              <Label>{t("primaryColor")}</Label>
              <Input type="color" value={s.primaryColor} onChange={(e) => setS({ ...s, primaryColor: e.target.value })} disabled={!canEdit} className="h-9 w-20 p-1" />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch checked={s.emailNotifications} onCheckedChange={(v) => setS({ ...s, emailNotifications: v })} disabled={!canEdit} /> <Label>Email</Label>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="invoice">
        <Card>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>{t("invoice")}</Label>
              <Select value={s.invoiceTemplate} onValueChange={(v) => setS({ ...s, invoiceTemplate: v as "CLASSIC" | "MODERN" })} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="CLASSIC">Classic</SelectItem><SelectItem value="MODERN">Modern</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch checked={s.showQr} onCheckedChange={(v) => setS({ ...s, showQr: v })} disabled={!canEdit} /> <Label>{t("showQr")}</Label>
            </div>
            <div className="space-y-1"><Label>{t("invoiceFooterAr")}</Label><Textarea dir="rtl" value={s.invoiceFooterAr} onChange={(e) => setS({ ...s, invoiceFooterAr: e.target.value })} disabled={!canEdit} /></div>
            <div className="space-y-1"><Label>{t("invoiceFooterEn")}</Label><Textarea dir="ltr" value={s.invoiceFooterEn} onChange={(e) => setS({ ...s, invoiceFooterEn: e.target.value })} disabled={!canEdit} /></div>
            <div className="space-y-1"><Label>{t("invoiceTerms")} (AR)</Label><Textarea dir="rtl" value={s.invoiceTermsAr} onChange={(e) => setS({ ...s, invoiceTermsAr: e.target.value })} disabled={!canEdit} /></div>
            <div className="space-y-1"><Label>{t("invoiceTerms")} (EN)</Label><Textarea dir="ltr" value={s.invoiceTermsEn} onChange={(e) => setS({ ...s, invoiceTermsEn: e.target.value })} disabled={!canEdit} /></div>
            <div className="space-y-1 sm:col-span-2"><Label>{t("bankDetails")}</Label><Textarea dir="ltr" value={s.bankDetails} onChange={(e) => setS({ ...s, bankDetails: e.target.value })} disabled={!canEdit} /></div>
          </CardContent>
        </Card>
      </TabsContent>
      {canEdit && (
        <div className="mt-4">
          <Button onClick={save} disabled={loading}>{loading && <Loader2 className="animate-spin" />} {tc("save")}</Button>
        </div>
      )}
    </Tabs>
  );
}
