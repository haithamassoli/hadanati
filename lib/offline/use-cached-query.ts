"use client";

import { useEffect, useState } from "react";
import { useQuery, type OptionalRestArgsOrSkip } from "convex/react";
import {
  getFunctionName,
  type FunctionArgs,
  type FunctionReference,
  type FunctionReturnType,
} from "convex/server";
import { getDb, type Snapshot } from "./db";

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * `useQuery` with an IndexedDB snapshot fallback: live results are persisted
 * fire-and-forget; while offline and the live result is still loading, the
 * last persisted snapshot is served with `isStale: true`.
 *
 * Accepts `"skip"` like `useQuery` (no fetch, no snapshot, data undefined).
 */
export function useCachedQuery<Query extends FunctionReference<"query">>(
  query: Query,
  args: FunctionArgs<Query> | "skip",
): {
  data: FunctionReturnType<Query> | undefined;
  isStale: boolean;
  updatedAt?: number;
} {
  const skip = args === "skip";
  const live = useQuery(query, ...([args] as OptionalRestArgsOrSkip<Query>)) as
    | FunctionReturnType<Query>
    | undefined;
  const key = skip ? null : `${getFunctionName(query)}${stableStringify(args)}`;
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  useEffect(() => {
    if (key === null) return;
    if (live !== undefined) {
      void getDb()
        .then((db) =>
          db.put("snapshots", { key, data: live, updatedAt: Date.now() }),
        )
        .catch(() => {});
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      void getDb()
        .then((db) => db.get("snapshots", key))
        .then((stored) => {
          if (stored) setSnapshot(stored);
        })
        .catch(() => {});
    }
  }, [live, key]);

  if (key === null) {
    return { data: undefined, isStale: false };
  }
  if (live !== undefined) {
    return { data: live, isStale: false };
  }
  if (snapshot && snapshot.key === key) {
    return {
      data: snapshot.data as FunctionReturnType<Query>,
      isStale: true,
      updatedAt: snapshot.updatedAt,
    };
  }
  return { data: undefined, isStale: false };
}
