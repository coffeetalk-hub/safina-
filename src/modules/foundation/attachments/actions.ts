"use server";

import { runAction } from "@/core/action";
import { plain } from "@/components/data-table/types";
import { listForEntityAs, removeAttachment, uploadAttachment } from "./service";

/** Rights come from the record the file belongs to (see service.ts), not from a blanket permission. */
export async function uploadAttachmentAction(formData: FormData) {
  const entityType = String(formData.get("entityType") ?? "");
  const entityId = String(formData.get("entityId") ?? "");
  const description = String(formData.get("description") ?? "") || undefined;
  const file = formData.get("file");
  return runAction({}, null, async (_d, s) => {
    if (!(file instanceof File) || !entityType || !entityId) throw new Error("INVALID_FILE");
    const a = await uploadAttachment(s, { entityType, entityId, file, description });
    return { id: a.id };
  });
}

export async function removeAttachmentAction(id: string) {
  return runAction({}, null, (_d, s) => removeAttachment(s, id));
}

export async function listAttachmentsAction(entityType: string, entityId: string) {
  return runAction({}, null, async (_d, s) => plain(await listForEntityAs(s, entityType, entityId)));
}
