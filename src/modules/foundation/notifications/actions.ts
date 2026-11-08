"use server";

import { runAction } from "@/core/action";
import { markRead } from "./service";

export async function markReadAction(id: string | "all") {
  return runAction({}, null, (_d, s) => markRead(s, id));
}
