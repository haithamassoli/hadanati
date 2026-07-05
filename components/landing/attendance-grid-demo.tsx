"use client";

// THE signature piece. A self-playing attendance grid built from the real Card +
// StatusChip + the offline-chip's amber pending language, so the hero mock and
// the product are literally the same components. It loops slowly through the
// offline→synced story that words alone can't sell: drop the network, keep
// taking taps, reconnect, sweep, and land on "nothing lost". Under reduced
// motion it renders the resolved end-state and never loops.

import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from "motion/react";
import { Check, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusChip, type ChipStatus } from "@/components/status-chip";

type Row = { name: string; status: ChipStatus; offlineMark?: 1 | 2 | 3 };

// Three are already marked; three more get marked *while offline* (offlineMark
// = the order they pop in). Names stay in JSX — they're an Arabic nursery's
// roster, not translatable copy.
const ROSTER: Row[] = [
  { name: "عمر", status: "present" },
  { name: "لمى", status: "present", offlineMark: 1 },
  { name: "يوسف", status: "present" },
  { name: "سارة", status: "late", offlineMark: 2 },
  { name: "كرم", status: "present" },
  { name: "جنى", status: "excused", offlineMark: 3 },
];

const PHASES = [
  { name: "online", ms: 1600 },
  { name: "offline", ms: 1100 },
  { name: "marking", ms: 1900 },
  { name: "reconnect", ms: 900 },
  { name: "sweep", ms: 850 },
  { name: "synced", ms: 3600 },
] as const;
type PhaseName = (typeof PHASES)[number]["name"];
const SYNCED_INDEX = PHASES.findIndex((p) => p.name === "synced");

const POP = { type: "spring", stiffness: 380, damping: 30 } as const;

// Formatters are expensive to construct — build once, not every render (the demo
// re-renders continuously while playing).
const NF: Record<string, Intl.NumberFormat> = {
  ar: new Intl.NumberFormat("ar-JO"),
  en: new Intl.NumberFormat("en-US"),
};

function PopChip({ status, reduce }: { status: ChipStatus; reduce: boolean }) {
  if (reduce) return <StatusChip status={status} size="sm" />;
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={status}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1, transition: POP }}
        exit={{ scale: 0.6, opacity: 0, transition: { duration: 0.15 } }}
      >
        <StatusChip status={status} size="sm" />
      </motion.div>
    </AnimatePresence>
  );
}

export function AttendanceGridDemo({ className }: { className?: string }) {
  const { t, locale } = useT();
  const reduce = useReducedMotion() ?? false;
  const rtl = locale === "ar";
  const nf = NF[locale] ?? NF.en;
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { margin: "0px" });

  const [phaseIdx, setPhaseIdx] = useState(reduce ? SYNCED_INDEX : 0);
  const [revealed, setRevealed] = useState(reduce ? 3 : 0);

  useEffect(() => {
    // Reduced motion → static synced end-state. Off-screen → fully idle (no
    // timers, re-renders, or spinner) until the hero scrolls back into view.
    if (reduce || !inView) return;
    let cancelled = false;
    let advance: ReturnType<typeof setTimeout> | undefined;
    let reveals: ReturnType<typeof setTimeout>[] = [];
    const step = (idx: number) => {
      if (cancelled) return;
      const phase = PHASES[idx];
      setPhaseIdx(idx);
      reveals.forEach(clearTimeout);
      reveals = [];
      if (phase.name === "online" || phase.name === "marking") setRevealed(0);
      if (phase.name === "marking") {
        reveals.push(setTimeout(() => setRevealed(1), 350));
        reveals.push(setTimeout(() => setRevealed(2), 850));
        reveals.push(setTimeout(() => setRevealed(3), 1350));
      }
      advance = setTimeout(() => step((idx + 1) % PHASES.length), phase.ms);
    };
    step(0);
    // Live timers stay bounded to <=4 (1 advance + 3 reveals), reset each step.
    return () => {
      cancelled = true;
      if (advance) clearTimeout(advance);
      reveals.forEach(clearTimeout);
    };
  }, [reduce, inView]);

  const phase: PhaseName = PHASES[phaseIdx].name;
  const offline = phase === "offline" || phase === "marking";
  const marked = phase === "marking" || phase === "reconnect" || phase === "sweep" || phase === "synced";
  const pending = phase === "synced" ? 0 : marked ? revealed : 0;

  const rowStatus = (row: Row): ChipStatus =>
    row.offlineMark == null
      ? row.status
      : marked && revealed >= row.offlineMark
        ? row.status
        : "unmarked";

  return (
    <div
      ref={rootRef}
      aria-hidden
      className={cn(
        "relative w-full max-w-md rounded-3xl bg-card p-3 shadow-[0_24px_60px_-28px_var(--accent)] ring-1 ring-foreground/10",
        className,
      )}
    >
      {/* Header: classroom · connectivity */}
      <div className="flex items-center justify-between gap-2 px-2 pt-1 pb-3">
        <div className="min-w-0">
          <p className="truncate font-heading text-sm leading-tight">
            {t("landing.demo.classroom")}
          </p>
          <p className="mt-0.5 truncate text-[0.7rem] text-muted-foreground">
            {t("landing.demo.dataAge")}
          </p>
        </div>
        <ConnectivityBadge offline={offline} reduce={reduce} t={t} />
      </div>

      {/* Grid body */}
      <div className="relative overflow-hidden rounded-2xl">
        {/* calm offline dashed ring — never alarm-red */}
        <AnimatePresence>
          {offline && !reduce && (
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-10 rounded-2xl border-2 border-dashed border-muted-foreground/35"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
          )}
        </AnimatePresence>

        {/* sync sweep — green band crossing from the inline-start edge */}
        <AnimatePresence>
          {phase === "sweep" && !reduce && (
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-present/30 to-transparent"
                initial={{ x: rtl ? "110%" : "-110%" }}
                animate={{ x: rtl ? "-110%" : "110%" }}
                transition={{ duration: 0.8, ease: "easeInOut" }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <ul className="divide-y divide-border/70">
          {ROSTER.map((row) => (
            <li
              key={row.name}
              className="flex items-center justify-between gap-3 bg-card px-2 py-2"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar size="sm">
                  <AvatarFallback className="bg-secondary text-[0.7rem] font-medium text-secondary-foreground">
                    {row.name.slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate text-sm">{row.name}</span>
              </div>
              <PopChip status={rowStatus(row)} reduce={reduce} />
            </li>
          ))}
        </ul>
      </div>

      {/* Footer: the resolving status line */}
      <div className="flex min-h-9 items-center px-2 pt-3">
        <AnimatePresence mode="wait" initial={false}>
          {phase === "synced" ? (
            <motion.div
              key="synced"
              className="flex items-center gap-1.5 text-sm font-medium text-present"
              initial={reduce ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -4 }}
            >
              <motion.span
                initial={reduce ? false : { scale: 0 }}
                animate={{ scale: 1, transition: POP }}
                className="grid size-4 place-items-center rounded-full bg-present text-present-foreground"
              >
                <Check className="size-3" strokeWidth={3} />
              </motion.span>
              {t("landing.demo.synced")}
            </motion.div>
          ) : offline || phase === "reconnect" || phase === "sweep" ? (
            <motion.div
              key="pending"
              className="flex items-center gap-1.5 rounded-full border border-late/30 bg-late-soft px-2.5 py-1 text-xs font-medium text-late-foreground"
              initial={reduce ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -4 }}
            >
              {phase === "reconnect" || phase === "sweep" ? (
                <RefreshCw className={cn("size-3.5", !reduce && "animate-spin")} />
              ) : (
                <WifiOff className="size-3.5" />
              )}
              {t("landing.demo.marking")}
              {pending > 0 && (
                <span className="ms-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-late/25 px-1 tabular-nums">
                  {nf.format(pending)}
                </span>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              className="text-xs text-muted-foreground"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduce ? undefined : { opacity: 0 }}
            >
              {t("landing.demo.dataAge")}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ConnectivityBadge({
  offline,
  reduce,
  t,
}: {
  offline: boolean;
  reduce: boolean;
  t: (key: string) => string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-medium ring-1 transition-colors",
        offline
          ? "bg-late-soft text-late-foreground ring-late/30"
          : "bg-present-soft text-present-foreground ring-present/30",
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={offline ? "off" : "on"}
          initial={reduce ? false : { scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={reduce ? undefined : { scale: 0.5, opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {offline ? (
            <WifiOff className="size-3.5" />
          ) : (
            <Wifi className="size-3.5" />
          )}
        </motion.span>
      </AnimatePresence>
      {t(offline ? "landing.demo.offline" : "landing.demo.online")}
    </span>
  );
}
