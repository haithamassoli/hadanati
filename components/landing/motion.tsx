"use client";

// Shared landing motion primitives (motion/react v12). Entrance reveals are
// y+opacity only, so RTL never needs an x-flip; everything degrades to a plain
// fade (or nothing) under prefers-reduced-motion.

import { useEffect, useRef, type ReactNode } from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type Variants,
} from "motion/react";
import { cn } from "@/lib/utils";

export const EASE = [0.22, 1, 0.36, 1] as const;

const CONTAINER: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

function itemVariants(reduce: boolean): Variants {
  return reduce
    ? { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.2 } } }
    : {
        hidden: { opacity: 0, y: 16 },
        show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
      };
}

/**
 * Staggering container. Reveals its `Item` descendants in reading order the
 * first time it scrolls into view. Variant propagation flows through the React
 * tree, so `Item`s may sit inside plain wrappers.
 */
export function Reveal({
  children,
  className,
  margin = "-15%",
}: {
  children: ReactNode;
  className?: string;
  margin?: `${number}%` | `${number}px`;
}) {
  return (
    <motion.div
      className={className}
      variants={CONTAINER}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin }}
    >
      {children}
    </motion.div>
  );
}

/** A single revealed element inside a `Reveal`. */
export function Item({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion() ?? false;
  return (
    <motion.div className={className} variants={itemVariants(reduce)}>
      {children}
    </motion.div>
  );
}

/**
 * Counts up to `to` the first time it enters view. Renders the final value
 * immediately under reduced motion. `format` handles locale numerals; keep
 * `tabular-nums` on the caller so the width never jitters mid-count.
 */
export function CountUp({
  to,
  format,
  className,
  duration = 1.1,
}: {
  to: number;
  format?: (n: number) => string;
  className?: string;
  duration?: number;
}) {
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15%" });
  const mv = useMotionValue(reduce ? to : 0);
  const fmt = format ?? ((n: number) => String(Math.round(n)));
  // Rendering a MotionValue as the child updates the DOM text directly — the
  // count never re-renders React.
  const text = useTransform(mv, (v) => fmt(v));

  useEffect(() => {
    if (reduce || !inView) return;
    const controls = animate(mv, to, { duration, ease: EASE });
    return () => controls.stop();
  }, [inView, reduce, to, duration, mv]);

  return (
    <motion.span ref={ref} className={cn("tabular-nums", className)}>
      {text}
    </motion.span>
  );
}
