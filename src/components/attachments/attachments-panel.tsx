"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { FileText, Image as ImageIcon, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { removeAttachmentAction, uploadAttachmentAction } from "@/modules/foundation/attachments/actions";
import { formatDateTime } from "@/lib/dates";

export type AttachmentItem = { id: string; fileName: string; mimeType: string; size: number; description: string | null; createdAt: string };

/** Drop-in panel for any document page: list + upload + delete. */
export function AttachmentsPanel({ entityType, entityId, items, canUpload, canDelete }: { entityType: string; entityId: string; items: AttachmentItem[]; canUpload: boolean; canDelete: boolean }) {
  const t = useTranslations("foundation.attachments");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const locale = useLocale();
  const toast = useToast();
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [desc, setDesc] = React.useState("");
  const fileRef = React.useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setLoading(true);
    for (const f of Array.from(files)) {
      const fd = new FormData();
      fd.set("entityType", entityType);
      fd.set("entityId", entityId);
      fd.set("description", desc);
      fd.set("file", f);
      const res = await uploadAttachmentAction(fd);
      if (!res.ok) toast.error(te.has(res.error) ? te(res.error) : res.error);
    }
    setLoading(false);
    setDesc("");
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Paperclip className="size-4" /> {tc("attachments")} <span className="text-muted-foreground font-normal">({items.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {canUpload && (
          <div
            className="rounded-md border border-dashed p-3 text-sm flex flex-wrap items-center gap-2"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              upload(e.dataTransfer.files);
            }}
          >
            <Input placeholder={tc("notes")} value={desc} onChange={(e) => setDesc(e.target.value)} className="h-8 max-w-xs" />
            <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => upload(e.target.files)} accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.xlsx,.xls,.docx,.doc,.csv,.txt" />
            <Button size="sm" variant="outline" disabled={loading} onClick={() => fileRef.current?.click()}>
              {loading ? <Loader2 className="animate-spin" /> : <Upload />} {t("upload")}
            </Button>
            <span className="text-xs text-muted-foreground">{t("dropHint")}</span>
          </div>
        )}
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noFiles")}</p>
        ) : (
          <ul className="divide-y">
            {items.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2 text-sm">
                {a.mimeType.startsWith("image/") ? <ImageIcon className="size-4 text-muted-foreground" /> : <FileText className="size-4 text-muted-foreground" />}
                <a href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate">
                  {a.fileName}
                </a>
                {a.description && <span className="text-muted-foreground truncate">— {a.description}</span>}
                <span className="ms-auto text-xs text-muted-foreground whitespace-nowrap" dir="ltr">
                  {Math.round(a.size / 1024)} KB · {formatDateTime(a.createdAt, locale)}
                </span>
                {canDelete && (
                  <ConfirmButton title={tc("deleteConfirmTitle")} action={() => removeAttachmentAction(a.id)} variant="ghost" size="icon-sm">
                    <Trash2 className="text-destructive" />
                  </ConfirmButton>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
