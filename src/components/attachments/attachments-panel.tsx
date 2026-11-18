"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Clock, FileText, Image as ImageIcon, Loader2, Paperclip, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { listAttachmentsAction, removeAttachmentAction, uploadAttachmentAction } from "@/modules/foundation/attachments/actions";
import { formatDateTime } from "@/lib/dates";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "@/lib/hosting";
import { cn } from "@/lib/utils";
import type { PendingAttachments } from "./pending";

export type AttachmentItem = { id: string; fileName: string; mimeType: string; size: number; description: string | null; createdAt: string };

export const ATTACHMENT_ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.gif,.xlsx,.xls,.docx,.doc,.csv,.txt";

type Props = {
  entityType: string;
  /** null while the record is still being created: files are queued in `pending` and uploaded after the first save. */
  entityId: string | null;
  items: AttachmentItem[];
  canUpload: boolean;
  canDelete: boolean;
  pending?: PendingAttachments;
  /** Called after a server-side upload or delete; defaults to refreshing the route. */
  onChanged?: () => void;
  /** Borderless variant for dialogs. */
  compact?: boolean;
  /** The page's action buttons (Save, Submit…), shown at the bottom of the card on the end side. */
  footer?: React.ReactNode;
};

/** Drop-in panel for any document page or dialog: list + upload + delete, with a queue for unsaved records. */
export function AttachmentsPanel({ entityType, entityId, items, canUpload, canDelete, pending, onChanged, compact, footer }: Props) {
  const t = useTranslations("foundation.attachments");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const locale = useLocale();
  const toast = useToast();
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [desc, setDesc] = React.useState("");
  const fileRef = React.useRef<HTMLInputElement>(null);
  const changed = () => (onChanged ? onChanged() : router.refresh());
  const queued = pending?.files ?? [];
  const count = items.length + queued.length;

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    const tooBig = Array.from(list).filter((f) => f.size > MAX_UPLOAD_BYTES);
    if (tooBig.length) toast.error(t("tooLarge", { files: tooBig.map((f) => f.name).join(", "), mb: MAX_UPLOAD_MB }));
    const files = Array.from(list).filter((f) => f.size <= MAX_UPLOAD_BYTES);
    if (!files.length) {
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    if (!entityId) {
      pending?.add(files, desc);
      setDesc("");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setLoading(true);
    for (const f of files) {
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
    changed();
  };
  const showUpload = canUpload && (entityId || pending);

  const body = (
    <>
      {showUpload && (
        <div
          className="rounded-md border border-dashed p-3 text-sm flex flex-wrap items-center gap-2"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            upload(e.dataTransfer.files);
          }}
        >
          <Input placeholder={tc("notes")} value={desc} onChange={(e) => setDesc(e.target.value)} className="h-8 max-md:h-9 sm:max-w-xs" />
          <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => upload(e.target.files)} accept={ATTACHMENT_ACCEPT} data-testid="attachment-input" />
          <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => fileRef.current?.click()}>
            {loading ? <Loader2 className="animate-spin" /> : <Upload />} {t("upload")}
          </Button>
          <span className="text-xs text-muted-foreground">{t("dropHint", { mb: MAX_UPLOAD_MB })}</span>
        </div>
      )}
      {count === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noFiles")}</p>
      ) : (
        <ul className="divide-y">
          {queued.map((q) => (
            <li key={q.key} className="flex items-center gap-3 py-2 text-sm">
              <Clock className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span className="min-w-0 truncate">{q.file.name}</span>
              {q.description && <span className="min-w-0 text-muted-foreground truncate max-sm:hidden">— {q.description}</span>}
              <span className="ms-auto text-xs text-muted-foreground whitespace-nowrap">{t("pending")}</span>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => pending?.remove(q.key)} aria-label={tc("delete")}>
                <X className="size-3.5" />
              </Button>
            </li>
          ))}
          {items.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-2 text-sm">
              {a.mimeType.startsWith("image/") ? <ImageIcon className="size-4 shrink-0 text-muted-foreground" /> : <FileText className="size-4 shrink-0 text-muted-foreground" />}
              <a href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer" className="min-w-0 text-primary hover:underline truncate">
                {a.fileName}
              </a>
              {a.description && <span className="min-w-0 text-muted-foreground truncate max-sm:hidden">— {a.description}</span>}
              <span className="ms-auto text-xs text-muted-foreground whitespace-nowrap" dir="ltr">
                {Math.round(a.size / 1024)} KB<span className="max-sm:hidden"> · {formatDateTime(a.createdAt, locale)}</span>
              </span>
              {canDelete && (
                <ConfirmButton title={tc("deleteConfirmTitle")} action={() => removeAttachmentAction(a.id)} variant="ghost" size="icon-sm" onSuccess={changed}>
                  <Trash2 className="text-destructive" />
                </ConfirmButton>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );

  if (compact) {
    return (
      <div className="space-y-2 rounded-md border p-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Paperclip className="size-4" /> {tc("attachments")} <span className="text-muted-foreground font-normal">({count})</span>
        </div>
        {body}
      </div>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Paperclip className="size-4" /> {tc("attachments")} <span className="text-muted-foreground font-normal">({count})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className={cn("space-y-3")}>{body}</CardContent>
      {footer && <CardFooter className="flex-wrap justify-end gap-2 border-t pt-4">{footer}</CardFooter>}
    </Card>
  );
}

/**
 * Attachments inside a form dialog. Loads the record's files itself when it already exists,
 * and queues new files in `pending` while the record is still being created.
 */
export function DialogAttachments({ entityType, entityId, canUpload, canDelete, pending }: { entityType: string; entityId: string | null; canUpload: boolean; canDelete: boolean; pending: PendingAttachments }) {
  const [items, setItems] = React.useState<AttachmentItem[]>([]);
  const load = React.useCallback(() => {
    if (!entityId) return;
    listAttachmentsAction(entityType, entityId).then((r) => {
      if (r.ok) setItems(r.data as AttachmentItem[]);
    });
  }, [entityType, entityId]);
  React.useEffect(() => {
    let alive = true;
    if (!entityId) return;
    listAttachmentsAction(entityType, entityId).then((r) => {
      if (alive && r.ok) setItems(r.data as AttachmentItem[]);
    });
    return () => {
      alive = false;
    };
  }, [entityType, entityId]);
  return <AttachmentsPanel compact entityType={entityType} entityId={entityId} items={items} canUpload={canUpload} canDelete={canDelete} pending={pending} onChanged={load} />;
}
