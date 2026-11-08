"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { punchAction } from "@/modules/hr/actions";
import type { PunchState } from "@/modules/hr/punch";

type PunchResult = { ok: true; state: PunchState } | { ok: false; error: string };
type PunchContextValue = { state: PunchState; nowMs: number; punch: (action: "IN" | "OUT") => Promise<PunchResult> };

const PunchContext = React.createContext<PunchContextValue | null>(null);

const everySecond = (notify: () => void) => {
  const id = setInterval(notify, 1000);
  return () => clearInterval(id);
};
const wholeSeconds = () => Math.floor(Date.now() / 1000);
const beforeHydration = () => 0;

/** Holds today's punch state for the header and dashboard, ticking once a second on the server's clock. */
export function PunchProvider({ initial, children }: { initial: PunchState; children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = React.useState(initial);
  const [lastServerState, setLastServerState] = React.useState(initial.serverNow);
  if (lastServerState !== initial.serverNow) {
    setLastServerState(initial.serverNow);
    setState(initial);
  }

  // Pair each server timestamp with the browser clock, so a wrong device clock can't skew the timer.
  const tick = React.useSyncExternalStore(everySecond, wholeSeconds, beforeHydration);
  const [anchor, setAnchor] = React.useState({ server: state.serverNow, client: 0 });
  if (tick > 0 && (anchor.server !== state.serverNow || anchor.client === 0)) setAnchor({ server: state.serverNow, client: tick * 1000 });
  const nowMs = tick > 0 && anchor.client > 0 ? Date.parse(anchor.server) + (tick * 1000 - anchor.client) : Date.parse(state.serverNow);

  const punch = React.useCallback(
    async (action: "IN" | "OUT"): Promise<PunchResult> => {
      const res = await punchAction({ action });
      if (!res.ok) return { ok: false, error: res.error };
      setState(res.data);
      router.refresh();
      return { ok: true, state: res.data };
    },
    [router],
  );

  const value = React.useMemo(() => ({ state, nowMs, punch }), [state, nowMs, punch]);
  return <PunchContext.Provider value={value}>{children}</PunchContext.Provider>;
}

export function usePunch() {
  const value = React.useContext(PunchContext);
  if (!value) throw new Error("usePunch must be used inside PunchProvider");
  return value;
}

/** Elapsed time since punch-in on the server's clock, in whole seconds; zero when not punched in. */
export function elapsedSeconds(state: PunchState, nowMs: number) {
  if (state.phase !== "IN" || !state.punchInAt) return 0;
  return Math.max(0, Math.floor((nowMs - Date.parse(state.punchInAt)) / 1000));
}

export function formatDuration(totalSeconds: number) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(totalSeconds / 3600))}:${pad(Math.floor(totalSeconds / 60) % 60)}:${pad(totalSeconds % 60)}`;
}
