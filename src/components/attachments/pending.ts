"use client";

import * as React from "react";
import { uploadAttachmentAction } from "@/modules/foundation/attachments/actions";

export type PendingFile = { key: string; file: File; description: string };

/**
 * Files chosen before the record exists. Editors queue them here and call `flush`
 * with the new id right after the first save, so the user can attach while filling the form.
 */
export type PendingAttachments = {
  files: PendingFile[];
  add: (files: FileList | File[], description: string) => void;
  remove: (key: string) => void;
  clear: () => void;
  flush: (entityType: string, entityId: string) => Promise<{ uploaded: number; failed: string[] }>;
};

export function usePendingAttachments(): PendingAttachments {
  const [files, setFiles] = React.useState<PendingFile[]>([]);
  const add = React.useCallback((list: FileList | File[], description: string) => {
    const picked = Array.from(list).map((file, i) => ({ key: `${file.name}-${file.size}-${Date.now()}-${i}`, file, description }));
    if (picked.length) setFiles((p) => [...p, ...picked]);
  }, []);
  const remove = React.useCallback((key: string) => setFiles((p) => p.filter((f) => f.key !== key)), []);
  const clear = React.useCallback(() => setFiles([]), []);
  const flush = async (entityType: string, entityId: string) => {
    const failed: string[] = [];
    let uploaded = 0;
    for (const p of files) {
      const fd = new FormData();
      fd.set("entityType", entityType);
      fd.set("entityId", entityId);
      fd.set("description", p.description);
      fd.set("file", p.file);
      const res = await uploadAttachmentAction(fd);
      if (res.ok) uploaded++;
      else failed.push(`${p.file.name} (${res.error})`);
    }
    setFiles([]);
    return { uploaded, failed };
  };
  return { files, add, remove, clear, flush };
}
