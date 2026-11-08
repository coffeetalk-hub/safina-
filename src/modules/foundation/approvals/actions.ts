"use server";

import { z } from "zod";
import { runAction } from "@/core/action";
import { decideRequest } from "./service";

export async function decideAction(input: unknown) {
  return runAction({ schema: z.object({ requestId: z.string(), decision: z.enum(["APPROVED", "REJECTED"]), comment: z.string().max(1000).optional() }) }, input, (d, s) => decideRequest(s, d.requestId, d.decision, d.comment));
}
