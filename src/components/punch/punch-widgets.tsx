"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Clock3, Fingerprint, Palmtree, UserX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { elapsedSeconds, formatDuration, usePunch } from "./punch-context";
import { PunchDial, PunchDigits } from "./punch-dial";

const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;
const riyadhTime = (ms: number) => new Date(ms + RIYADH_OFFSET_MS).toISOString().slice(11, 19);

function useHeadline() {
  const { state } = usePunch();
  const t = useTranslations("punch");
  return { OFF: t("notStarted"), IN: t("working"), OUT: t("finished"), ON_LEAVE: t("onLeave"), NOT_LINKED: t("notLinked") }[state.phase];
}

function useWorked() {
  const { state } = usePunch();
  const t = useTranslations("punch");
  const minutes = Math.round(state.workedHrs * 60);
  return t("hoursMinutes", { h: Math.floor(minutes / 60), m: minutes % 60 });
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold tabular-nums" dir="ltr">{value}</div>
    </div>
  );
}

function PunchBadges() {
  const { state } = usePunch();
  const t = useTranslations("punch");
  return (
    <>
      {(state.phase === "IN" || state.phase === "OUT") && (state.lateMin > 0 ? <Badge variant="warning">{t("late", { duration: state.lateMin < 60 ? t("minutes", { m: state.lateMin }) : t("hoursMinutes", { h: Math.floor(state.lateMin / 60), m: state.lateMin % 60 }) })}</Badge> : <Badge variant="success">{t("onTime")}</Badge>)}
      {state.forgottenDay && <p className="text-xs text-muted-foreground">{t("forgotPunchOut", { day: state.forgottenDay })}</p>}
    </>
  );
}

/** The large control at the top of the dashboard. */
export function PunchCard() {
  const { state, nowMs } = usePunch();
  const t = useTranslations("punch");
  const headline = useHeadline();
  const worked = useWorked();
  if (state.phase === "NOT_LINKED") return null;
  const running = state.phase === "IN";
  return (
    <Card className="mb-4" data-testid="punch-card">
      <CardContent className="grid items-center gap-6 md:grid-cols-[auto_1fr] md:gap-10">
        <PunchDial />
        <div className="space-y-4 text-center md:text-start">
          <div>
            <h2 className="text-lg font-semibold">{headline}</h2>
            <p className="text-xs text-muted-foreground">{running ? t("timeOnClock") : t("timeInRiyadh")}</p>
          </div>
          <PunchDigits value={running ? formatDuration(elapsedSeconds(state, nowMs)) : riyadhTime(nowMs)} className="text-5xl font-bold tracking-tight" />
          <div className="mx-auto grid max-w-sm grid-cols-3 gap-3 md:mx-0">
            <Fact label={t("in")} value={state.checkIn ?? "—"} />
            <Fact label={t("out")} value={state.checkOut ?? "—"} />
            {state.phase === "OUT" ? <Fact label={t("worked")} value={worked} /> : <Fact label={t("shiftEnds")} value={state.workEnd || "—"} />}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start"><PunchBadges /></div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Header button available on every page, for every role. Opens the dial in a popover. */
export function PunchPill() {
  const { state, nowMs } = usePunch();
  const t = useTranslations("punch");
  const headline = useHeadline();
  const worked = useWorked();
  const { phase } = state;
  const Icon = phase === "OUT" ? CheckCircle2 : phase === "ON_LEAVE" ? Palmtree : phase === "NOT_LINKED" ? UserX : phase === "IN" ? Clock3 : Fingerprint;
  const label = phase === "IN" ? formatDuration(elapsedSeconds(state, nowMs)) : phase === "OUT" ? worked : phase === "ON_LEAVE" ? t("onLeaveShort") : t("punchIn");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("punch-pill px-2 sm:px-3", phase === "IN" && "punch-pill-live")} data-testid="punch-pill" aria-label={`${t("title")}: ${headline}`} title={headline}>
          {phase === "IN" ? <span className="punch-live-dot" /> : <Icon />}
          <span className="hidden tabular-nums sm:inline" dir={phase === "IN" ? "ltr" : undefined}>{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-72 p-4">
        {phase === "NOT_LINKED" ? (
          <div className="space-y-2 text-center">
            <UserX className="mx-auto size-8 text-muted-foreground" />
            <p className="text-sm">{headline}</p>
          </div>
        ) : (
          <div className="space-y-3 text-center">
            <p className="text-sm font-medium">{headline}</p>
            <PunchDial size="sm" />
            {phase === "IN" && <PunchDigits value={formatDuration(elapsedSeconds(state, nowMs))} className="text-2xl font-bold" />}
            <div className="grid grid-cols-2 gap-2">
              <Fact label={t("in")} value={state.checkIn ?? "—"} />
              <Fact label={t("out")} value={state.checkOut ?? "—"} />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2"><PunchBadges /></div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
