import { useEffect, useRef } from "react";
import type { OutboxEntry } from "./db";

/**
 * Drops optimistic local-echo state once its outbox entries have drained.
 *
 * Screens layer three sources: local echo ▸ pending outbox ▸ server. The
 * local echo must win while a write is queued, but once the write reaches
 * the server the reactive query is the truth — keeping the echo around
 * would mask later writes from other devices (PRD §8.5 LWW convergence).
 *
 * A key is only "settled" after it was OBSERVED in `pending` and then
 * disappeared — never before, so the submit → outbox-refresh gap can't
 * prematurely drop a fresh tap's echo.
 */
export function useEchoSettled(
  pending: OutboxEntry[],
  keyOf: (entry: OutboxEntry) => string | null,
  onSettled: (keys: string[]) => void,
): void {
  const seen = useRef<Set<string>>(new Set());
  useEffect(() => {
    const current = new Set<string>();
    for (const entry of pending) {
      const key = keyOf(entry);
      if (key !== null) current.add(key);
    }
    for (const key of current) seen.current.add(key);
    const settled: string[] = [];
    for (const key of seen.current) {
      if (!current.has(key)) settled.push(key);
    }
    if (settled.length > 0) {
      for (const key of settled) seen.current.delete(key);
      onSettled(settled);
    }
  }, [pending, keyOf, onSettled]);
}
