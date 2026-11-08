"use server";

import { runAction } from "@/core/action";
import { saveSequence, sequenceSchema } from "./service";

export async function saveSequenceAction(input: unknown) {
  return runAction({ permission: "foundation.numbering:edit", schema: sequenceSchema }, input, (d, s) => saveSequence(s, d));
}
