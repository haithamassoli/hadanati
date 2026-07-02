"use client";

import { useEffect } from "react";
import { replay, useOutbox } from "./outbox";

/**
 * Renders nothing. Drains the offline outbox on mount, whenever the browser
 * comes back online, and every 15s while entries are pending.
 */
export function OutboxReplayer() {
  const { count } = useOutbox();
  const hasPending = count > 0;

  useEffect(() => {
    void replay();
    const onOnline = () => void replay();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  useEffect(() => {
    if (!hasPending) return;
    const id = setInterval(() => {
      if (navigator.onLine) void replay();
    }, 15_000);
    return () => clearInterval(id);
  }, [hasPending]);

  return null;
}
