"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { Plus, Settings2, Trash2, User } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { EntityDialog } from "@/components/forms/entity-dialog";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { useToast } from "@/components/ui/toast";
import { moveOpportunityAction, removeStageAction, saveOpportunityAction, saveStageAction } from "@/modules/sales/actions";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Opt = { value: string; label: string };
type Stage = { id: string; code: string; nameAr: string; nameEn: string; order: number; probability: number; isWon: boolean; isLost: boolean; isActive: boolean };
type Opp = { id: string; titleAr: string; titleEn: string; stageId: string; amount: number; currencyCode: string; expectedClose: string | null; ownerId: string | null; probability: number; position: number; customer: { nameAr: string; nameEn: string } | null };

function Card({ o, locale, owners, dragging }: { o: Opp; locale: string; owners: Opt[]; dragging?: boolean }) {
  const owner = owners.find((x) => x.value === o.ownerId)?.label.split(" · ")[1];
  return (
    <div className={cn("rounded-md border bg-card p-2 text-sm shadow-xs", dragging && "opacity-80 rotate-1 shadow-lg")}>
      <Link href={`/sales/opportunities/${o.id}`} className="font-medium hover:underline block truncate" onClick={(e) => e.stopPropagation()}>{locale === "ar" ? o.titleAr : o.titleEn}</Link>
      {o.customer && <div className="text-xs text-muted-foreground truncate">{locale === "ar" ? o.customer.nameAr : o.customer.nameEn}</div>}
      <div className="mt-1 flex items-center justify-between text-xs">
        <span className="font-semibold tabular-nums" dir="ltr">{formatMoney(o.amount, locale, o.currencyCode)}</span>
        {o.expectedClose && <span dir="ltr" className="text-muted-foreground">{formatDate(o.expectedClose, locale)}</span>}
      </div>
      {owner && <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><User className="size-3" /> {owner}</div>}
    </div>
  );
}
function DraggableCard(props: { o: Opp; locale: string; owners: Opt[]; canDrag: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: props.o.id, disabled: !props.canDrag });
  return <div ref={setNodeRef} {...attributes} {...listeners} className={cn("touch-none", isDragging && "opacity-30")}><Card o={props.o} locale={props.locale} owners={props.owners} /></div>;
}
function Column({ stage, children, locale, total, count }: { stage: Stage; children: React.ReactNode; locale: string; total: number; count: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <div ref={setNodeRef} className={cn("flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30 transition-colors", isOver && "bg-primary/5 border-primary/40", stage.isWon && "border-emerald-300", stage.isLost && "border-red-300")}>
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="font-medium text-sm">{locale === "ar" ? stage.nameAr : stage.nameEn} <Badge variant="outline" className="ms-1">{count}</Badge></div>
        <span className="text-xs text-muted-foreground">{stage.probability}%</span>
      </div>
      <div className="px-2 py-1 text-xs text-muted-foreground tabular-nums" dir="ltr">{formatMoney(total, locale)}</div>
      <div className="flex flex-1 flex-col gap-2 p-2 min-h-24">{children}</div>
    </div>
  );
}

export function Kanban({ stages, opportunities, customers, salespersons, branches, currencies, ownerId, can }: { stages: Stage[]; opportunities: Opp[]; customers: Opt[]; salespersons: Opt[]; branches: Opt[]; currencies: Opt[]; ownerId: string; can: { create: boolean; edit: boolean; delete: boolean } }) {
  const t = useTranslations("sales");
  const tf = useTranslations("fields");
  const tc = useTranslations("common");
  const locale = useLocale();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [items, setItems] = React.useState(opportunities);
  const [prevOpps, setPrevOpps] = React.useState(opportunities);
  if (prevOpps !== opportunities) {
    // sync local board state when the server sends fresh data (React-sanctioned "adjust state on prop change")
    setPrevOpps(opportunities);
    setItems(opportunities);
  }
  const [active, setActive] = React.useState<Opp | null>(null);
  const [open, setOpen] = React.useState(false);
  const [stageOpen, setStageOpen] = React.useState(false);
  const [stageEditing, setStageEditing] = React.useState<Stage | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragEnd = async (e: DragEndEvent) => {
    setActive(null);
    const id = String(e.active.id);
    const stageId = e.over ? String(e.over.id) : null;
    const o = items.find((x) => x.id === id);
    if (!o || !stageId || o.stageId === stageId) return;
    const position = items.filter((x) => x.stageId === stageId).length;
    setItems((p) => p.map((x) => (x.id === id ? { ...x, stageId, position } : x)));
    const res = await moveOpportunityAction({ id, stageId, position });
    if (!res.ok) { toast.error(res.error); setItems(opportunities); } else router.refresh();
  };
  const stageOptions = stages.map((s) => ({ value: s.id, label: locale === "ar" ? s.nameAr : s.nameEn }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1 min-w-[220px]"><Label>{t("owner")}</Label><Combobox options={salespersons} value={ownerId} onChange={(v) => { const n = new URLSearchParams(sp.toString()); if (v) n.set("f.ownerId", v); else n.delete("f.ownerId"); router.push(`${pathname}?${n.toString()}`); }} /></div>
        <div className="ms-auto flex gap-2">
          {can.edit && <Button variant="outline" size="sm" onClick={() => { setStageEditing(null); setStageOpen(true); }}><Settings2 /> {t("pipeline.stages")}</Button>}
          {can.create && <Button size="sm" onClick={() => setOpen(true)}><Plus /> {t("opportunities.new")}</Button>}
        </div>
      </div>
      <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setActive(items.find((x) => x.id === e.active.id) ?? null)} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-3">
          {stages.map((s) => {
            const list = items.filter((o) => o.stageId === s.id);
            return (
              <Column key={s.id} stage={s} locale={locale} count={list.length} total={list.reduce((a, o) => a + o.amount, 0)}>
                {list.map((o) => <DraggableCard key={o.id} o={o} locale={locale} owners={salespersons} canDrag={can.edit} />)}
                {can.edit && <button className="mt-1 text-xs text-muted-foreground hover:text-foreground text-start" onClick={() => { setStageEditing(s); setStageOpen(true); }}>{tc("edit")}…</button>}
              </Column>
            );
          })}
        </div>
        <DragOverlay>{active ? <div className="w-72"><Card o={active} locale={locale} owners={salespersons} dragging /></div> : null}</DragOverlay>
      </DndContext>

      <EntityDialog open={open} onOpenChange={setOpen} title={t("opportunities.new")} size="lg" defaultValues={{ stageId: stages[0]?.id ?? "", currencyCode: "SAR", amount: 0, ownerId: ownerId || "" }} action={saveOpportunityAction} onSuccess={(d) => router.push(`/${locale}/sales/opportunities/${(d as { id: string }).id}`)} fields={[
        { name: "titleAr", label: t("titleAr"), required: true, dir: "rtl" },
        { name: "titleEn", label: t("titleEn"), required: true, dir: "ltr" },
        { name: "customerId", label: t("customer"), type: "select", options: customers },
        { name: "stageId", label: t("stage"), type: "select", options: stageOptions, required: true },
        { name: "amount", label: tf("amount"), type: "number" },
        { name: "currencyCode", label: tf("currency"), type: "select", options: currencies, required: true },
        { name: "expectedClose", label: t("expectedClose"), type: "date" },
        { name: "ownerId", label: t("owner"), type: "select", options: salespersons },
        { name: "branchId", label: tf("branch"), type: "select", options: branches },
        { name: "source", label: t("source") },
        { name: "notes", label: tc("notes"), type: "textarea", colSpan: 2 },
      ]} />
      <EntityDialog open={stageOpen} onOpenChange={setStageOpen} title={stageEditing ? t("pipeline.editStage") : t("pipeline.newStage")} size="md" defaultValues={stageEditing ?? { order: stages.length + 1, probability: 10, isWon: false, isLost: false, isActive: true }} action={saveStageAction} fields={[
        { name: "code", label: tf("code"), required: true, dir: "ltr" },
        { name: "order", label: t("order"), type: "number", required: true },
        { name: "nameAr", label: tf("nameAr"), required: true, dir: "rtl" },
        { name: "nameEn", label: tf("nameEn"), required: true, dir: "ltr" },
        { name: "probability", label: t("probability"), type: "number", required: true },
        { name: "isActive", label: tf("isActive"), type: "switch" },
        { name: "isWon", label: t("isWon"), type: "switch" },
        { name: "isLost", label: t("isLost"), type: "switch" },
      ]}>
        {stageEditing && can.delete && <ConfirmButton title={tc("deleteConfirmTitle")} action={() => removeStageAction(stageEditing.id)} variant="ghost" size="sm" onSuccess={() => setStageOpen(false)}><Trash2 className="text-destructive" /></ConfirmButton>}
      </EntityDialog>
    </div>
  );
}
