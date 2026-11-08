"use server";

import { runAction } from "@/core/action";
import { saveLogo, saveSettings, settingsSchema } from "./service";

export async function saveSettingsAction(input: unknown) {
  return runAction({ permission: "foundation.settings:edit", schema: settingsSchema }, input, (d, s) => saveSettings(s, d));
}
export async function saveLogoAction(formData: FormData) {
  const file = formData.get("file");
  return runAction({ permission: "foundation.settings:edit" }, null, (_d, s) => saveLogo(s, file instanceof File && file.size > 0 ? file : null));
}
