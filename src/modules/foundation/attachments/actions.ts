"use server";

import { runAction } from "@/core/action";
import { removeAttachment, uploadAttachment } from "./service";

export async function uploadAttachmentAction(formData: FormData) {
  const entityType = String(formData.get("entityType") ?? "");
  const entityId = String(formData.get("entityId") ?? "");
  const description = String(formData.get("description") ?? "") || undefined;
  const file = formData.get("file");
  return runAction({ permission: "foundation.attachment:create" }, null, async (_d, s) => {
    if (!(file instanceof File) || !entityType || !entityId) throw new Error("INVALID_FILE");
    const a = await uploadAttachment(s, { entityType, entityId, file, description });
    return { id: a.id };
  });
}

export async function removeAttachmentAction(id: string) {
  return runAction({ permission: "foundation.attachment:delete" }, null, (_d, s) => removeAttachment(s, id));
}
