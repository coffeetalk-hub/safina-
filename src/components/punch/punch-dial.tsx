"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Fingerprint, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { elapsedSeconds, usePunch } from "./punch-context";

const HOLD_MS = 850;
const SUCCESS_MS = 1200;
const DENIED_MS = 650;
const PARTICLES = Array.from({ length: 14 }, (_, i) => (360 / 14) * i);

type Gesture = "idle" | "holding" | "saving" | "success" | "denied";

/** The press-and-hold control. Holding guards against accidental punches; keyboard and screen-reader activation punch directly. */
export function PunchDial({ size = "lg" }: { size?: "lg" | "sm" }) {
  const { state, nowMs, punch } = usePunch();
  const t = useTranslations("punch");
  const te = useTranslations("errors");
  const toast = useToast();
  const [gesture, setGesture] = React.useState<Gesture>("idle");
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  React.useEffect(() => clearTimer, []);

  const { phase } = state;
  const disabled = phase === "ON_LEAVE" || phase === "NOT_LINKED";
  const action = phase === "IN" ? "OUT" : "IN";
  const busy = gesture === "saving" || gesture === "success";

  const elapsed = elapsedSeconds(state, nowMs);
  const onClockMinutes = phase === "IN" ? elapsed / 60 : state.spanMinutes;
  const progress = Math.min(100, (onClockMinutes / state.shiftMinutes) * 100);

  const commit = async () => {
    setGesture("saving");
    navigator.vibrate?.(30);
    const res = await punch(action);
    if (!res.ok) {
      setGesture("idle");
      toast.error(te.has(res.error) ? te(res.error) : res.error);
      return;
    }
    setGesture("success");
    toast.success(action === "IN" ? t("punchedIn") : t("punchedOut"));
    timer.current = setTimeout(() => setGesture("idle"), SUCCESS_MS);
  };

  const startHold = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || busy || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    clearTimer();
    setGesture("holding");
    timer.current = setTimeout(commit, HOLD_MS);
  };
  const endHold = () => {
    if (gesture !== "holding") return;
    clearTimer();
    setGesture("denied");
    timer.current = setTimeout(() => setGesture("idle"), DENIED_MS);
  };

  const caption = disabled ? "" : gesture === "denied" ? t("keepHolding") : phase === "IN" ? t("holdToPunchOut") : phase === "OUT" ? t("holdToResume") : t("holdToPunchIn");

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={cn("punch-dial", size === "lg" ? "size-52 [--punch-burst:136px]" : "size-40 [--punch-burst:104px]")} data-phase={phase} data-gesture={gesture} data-goal={progress >= 100 && phase === "IN" ? "" : undefined}>
        {phase === "IN" && (
          <>
            <span className="punch-halo" />
            <span className="punch-ripple" />
            <span className="punch-ripple punch-ripple-late" />
          </>
        )}
        <svg viewBox="0 0 200 200" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="100" cy="100" r="92" className="punch-track" />
          <circle cx="100" cy="100" r="92" pathLength={100} strokeDasharray={100} strokeDashoffset={100 - progress} className="punch-progress" />
          <circle cx="100" cy="100" r="79" pathLength={100} strokeDasharray={100} className="punch-hold" />
        </svg>
        {phase === "IN" && (
          <span className="punch-orbit">
            <span className="punch-orbit-dot" />
          </span>
        )}
        <button
          type="button"
          className="punch-button"
          data-testid="punch-button"
          disabled={disabled}
          aria-label={phase === "IN" ? t("punchOut") : t("punchIn")}
          onPointerDown={startHold}
          onPointerUp={endHold}
          onPointerCancel={endHold}
          onClick={(e) => {
            if (e.detail === 0 && !disabled && !busy) void commit();
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {gesture === "saving" ? (
            <Loader2 className="size-[38%] animate-spin" />
          ) : gesture === "success" ? (
            <svg viewBox="0 0 48 48" className="punch-check-icon size-[46%]" aria-hidden>
              <path d="M11 25 L20.5 34.5 L37.5 15" className="punch-check" />
            </svg>
          ) : (
            <span className="punch-print">
              <Fingerprint className="size-full" strokeWidth={1.5} />
              <span className="punch-scan" />
            </span>
          )}
        </button>
        {gesture === "success" && PARTICLES.map((angle, i) => <span key={angle} className="punch-particle" style={{ "--angle": `${angle}deg`, "--hue": i % 2 ? "var(--punch-accent)" : "var(--punch-color)" } as React.CSSProperties} />)}
      </div>
      <p className={cn("min-h-5 text-center text-sm text-muted-foreground", gesture === "denied" && "font-medium text-foreground")} aria-live="polite">{caption}</p>
    </div>
  );
}

/** Time readout where each digit rolls in only when it changes. */
export function PunchDigits({ value, className }: { value: string; className?: string }) {
  return (
    <span className={cn("inline-flex tabular-nums", className)} dir="ltr">
      {value.split("").map((ch, i) => (
        <span key={`${i}-${ch}`} className={ch === ":" ? "opacity-50" : "punch-digit"}>{ch}</span>
      ))}
    </span>
  );
}
