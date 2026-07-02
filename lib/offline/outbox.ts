import { useCallback, useSyncExternalStore } from "react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { convexClient } from "@/lib/convex";
import { attendance as attendanceNs } from "@/lib/i18n/ns/attendance";
import { getDb, type OutboxEntry } from "./db";
import { registry, type OutboxName } from "./registry";

// --- Module store (backs useOutbox via useSyncExternalStore) ---

const EMPTY: OutboxEntry[] = [];
let pending: OutboxEntry[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

async function refresh(): Promise<void> {
  const db = await getDb();
  pending = await db.getAllFromIndex("outbox", "by_createdAt");
  loaded = true;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!loaded) void refresh();
  return () => listeners.delete(listener);
}

function getSnapshot(): OutboxEntry[] {
  return pending;
}

function getServerSnapshot(): OutboxEntry[] {
  return EMPTY;
}

// --- Conflict tracking (PRD §8.5 LWW) ---
// Session-scoped: keys of replayed writes whose server row had changed after
// the client queued them ({conflict: true} mutation results). Cleared on
// page reload; UI shows an amber marker for rows whose key is in this set.

const EMPTY_CONFLICTS: ReadonlySet<string> = new Set();
let conflictKeys: ReadonlySet<string> = EMPTY_CONFLICTS;

const CONFLICT_KEY_FIELDS = ["nurseryId", "studentId", "date", "week"] as const;

/** Stable identity of an outbox write: name + (nurseryId, studentId, date|week). */
export function conflictKeyOf(
  name: string,
  args: Record<string, unknown>,
): string {
  const picked: Record<string, unknown> = {};
  for (const field of CONFLICT_KEY_FIELDS) {
    if (args[field] !== undefined) picked[field] = args[field];
  }
  return `${name}:${JSON.stringify(picked)}`;
}

function recordConflict(entry: OutboxEntry) {
  const next = new Set(conflictKeys);
  next.add(conflictKeyOf(entry.name, entry.args));
  conflictKeys = next;
  emit();
}

/** Session conflict set (exported for tests; UI reads it via useOutbox). */
export function getConflictKeys(): ReadonlySet<string> {
  return conflictKeys;
}

function getConflictServerSnapshot(): ReadonlySet<string> {
  return EMPTY_CONFLICTS;
}

// --- Permanent-failure toasts (ConvexError code → i18n key) ---

const ERROR_KEYS: Record<string, string> = {
  forbidden: "offline.error.forbidden",
  unauthorized: "offline.error.unauthorized",
  no_photo_consent: "offline.error.no_photo_consent",
  already_enrolled: "offline.error.already_enrolled",
  invalid_score: "offline.error.invalid_score",
};

function localizeErrorCode(code: unknown, fallback: string): string {
  const raw = typeof code === "string" ? code : fallback;
  const key = ERROR_KEYS[raw];
  if (key === undefined) return raw;
  const locale =
    typeof document !== "undefined" && document.cookie.includes("locale=en")
      ? "en"
      : "ar";
  return attendanceNs[locale][key] ?? raw;
}

// --- Outbox ---

// Date.now() can return the same millisecond for consecutive submits, which
// would make the by_createdAt index tie-break on the random uuid key and
// break FIFO. Keep createdAt strictly monotonic.
let lastCreatedAt = 0;

/**
 * Write-ahead submit: always persists the mutation to the IndexedDB outbox
 * first, then triggers a replay if the browser is (possibly) online.
 */
export async function submit(
  name: OutboxName,
  args: Record<string, unknown>,
): Promise<void> {
  const createdAt = Math.max(Date.now(), lastCreatedAt + 1);
  lastCreatedAt = createdAt;
  const entry: OutboxEntry = {
    clientMutationId: crypto.randomUUID(),
    name,
    args,
    createdAt,
  };
  const db = await getDb();
  await db.put("outbox", entry);
  await refresh();
  if (typeof navigator === "undefined" || navigator.onLine !== false) {
    void replay();
  }
}

let replaying = false;

/**
 * FIFO drain of the outbox through the Convex client.
 * - success: entry deleted; a `{conflict: true}` result (server row changed
 *   after this write was queued, PRD §8.5) is recorded in `conflictKeys`
 * - ConvexError (permanent rejection): entry deleted, translated toast
 * - network/unknown error: entry kept, drain aborted
 */
export async function replay(): Promise<void> {
  if (replaying) return;
  replaying = true;
  try {
    const db = await getDb();
    const entries = await db.getAllFromIndex("outbox", "by_createdAt");
    for (const entry of entries) {
      let result: unknown;
      try {
        result = await convexClient.mutation(registry[entry.name], {
          ...entry.args,
          clientMutationId: entry.clientMutationId,
          // LWW conflict detection: when this write was queued on the client.
          clientCreatedAt: entry.createdAt,
        } as never);
      } catch (error) {
        if (error instanceof ConvexError) {
          // Permanently rejected by the server; retrying can never succeed.
          console.warn(`[outbox] ${entry.name} rejected`, error.data);
          try {
            toast.error(localizeErrorCode(error.data, entry.name));
          } catch {
            // toast unavailable (e.g. non-browser environment)
          }
          await db.delete("outbox", entry.clientMutationId);
          await refresh();
          continue;
        }
        // Network/unknown error: keep the entry and stop draining.
        break;
      }
      if (
        result !== null &&
        typeof result === "object" &&
        (result as { conflict?: boolean }).conflict === true
      ) {
        recordConflict(entry);
      }
      await db.delete("outbox", entry.clientMutationId);
      await refresh();
    }
  } finally {
    replaying = false;
  }
}

export function useOutbox(): {
  pending: OutboxEntry[];
  count: number;
  conflictKeys: ReadonlySet<string>;
  syncNow: () => void;
} {
  const entries = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const conflicts = useSyncExternalStore(
    subscribe,
    getConflictKeys,
    getConflictServerSnapshot,
  );
  const syncNow = useCallback(() => void replay(), []);
  return {
    pending: entries,
    count: entries.length,
    conflictKeys: conflicts,
    syncNow,
  };
}
