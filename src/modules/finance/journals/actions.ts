"use server";

import { z } from "zod";
import { runAction } from "@/core/action";
import { deleteJournalDraft, journalSchema, postJournalEntry, recurringSchema, reverseJournalEntry, runRecurring, saveJournalDraft, saveRecurring } from "./service";
import { prisma } from "@/lib/prisma";

export async function saveJournalAction(input: unknown) {
  const isEdit = Boolean((input as { id?: string })?.id);
  return runAction({ permission: `finance.journal:${isEdit ? "edit" : "create"}`, schema: journalSchema }, input, async (d, s) => {
    const e = await saveJournalDraft(s, d);
    return { id: e.id, number: e.number };
  });
}
export async function postJournalAction(id: string) {
  return runAction({ permission: "finance.journal:edit" }, null, (_d, s) => postJournalEntry(s, id));
}
export async function reverseJournalAction(input: unknown) {
  return runAction({ permission: "finance.journal:approve", schema: z.object({ id: z.string(), date: z.string().optional() }) }, input, async (d, s) => {
    const r = await reverseJournalEntry(s, d.id, d.date);
    return { id: r.id, number: r.number };
  });
}
export async function deleteJournalAction(id: string) {
  return runAction({ permission: "finance.journal:delete" }, null, (_d, s) => deleteJournalDraft(s, id));
}
export async function saveRecurringAction(input: unknown) {
  const isEdit = Boolean((input as { id?: string })?.id);
  return runAction({ permission: `finance.recurring:${isEdit ? "edit" : "create"}`, schema: recurringSchema }, input, (d, s) => saveRecurring(s, d));
}
export async function removeRecurringAction(id: string) {
  return runAction({ permission: "finance.recurring:delete" }, null, async (_d, s) => {
    const r = await prisma.recurringJournal.findFirst({ where: { id, companyId: s.companyId } });
    if (!r) throw new Error("NOT_FOUND");
    return prisma.recurringJournal.delete({ where: { id } });
  });
}
export async function runRecurringAction() {
  return runAction({ permission: "finance.recurring:create" }, null, (_d, s) => runRecurring(s.companyId, s.userId));
}
