"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import type { ActionResult } from "@/core/action";

export function MappingsForm({ keys, current, options, action, canEdit }: { keys: string[]; current: Record<string, string>; options: { value: string; label: string }[]; action: (input: unknown) => Promise<ActionResult>; canEdit: boolean }) {
  const t = useTranslations("common");
  const toast = useToast();
  const router = useRouter();
  const [values, setValues] = React.useState<Record<string, string | null>>(() => Object.fromEntries(keys.map((k) => [k, current[k] ?? null])));
  const [loading, setLoading] = React.useState(false);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {keys.map((k) => (
          <div key={k} className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" dir="ltr">
              {k}
            </label>
            <Select value={values[k] ?? "__none"} onValueChange={(v) => setValues((p) => ({ ...p, [k]: v === "__none" ? null : v }))} disabled={!canEdit}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">—</SelectItem>
                {options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
      {canEdit && (
        <Button
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            const res = await action(values);
            setLoading(false);
            if (res.ok) {
              toast.success(t("saved"));
              router.refresh();
            } else toast.error(res.error);
          }}
        >
          {loading && <Loader2 className="animate-spin" />} {t("save")}
        </Button>
      )}
    </div>
  );
}
