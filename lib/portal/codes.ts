"use client";

// Stored parent access codes (FR-AUTH-2). The code IS the credential — no
// accounts. Multiple codes on one device → child switcher (activeIndex).
// Persisted in localStorage under one key; useCodes() subscribes via
// useSyncExternalStore (SSR-safe: empty on the server).

import { useSyncExternalStore } from "react";

export type StoredCode = {
  code: string;
  studentName: string;
  nurseryName: string;
  addedAt: number;
};

export type CodesState = {
  codes: StoredCode[];
  activeIndex: number;
};

const STORAGE_KEY = "hadanati.codes";
const EMPTY: CodesState = { codes: [], activeIndex: 0 };

// Snapshot cache keyed by the raw string so getSnapshot stays
// referentially stable between renders (useSyncExternalStore contract).
let cachedRaw: string | null = null;
let cachedState: CodesState = EMPTY;

const listeners = new Set<() => void>();

function parse(raw: string | null): CodesState {
  if (raw === null) return EMPTY;
  try {
    const value = JSON.parse(raw) as Partial<CodesState>;
    const codes = Array.isArray(value.codes)
      ? value.codes.filter(
          (c): c is StoredCode =>
            c !== null &&
            typeof c === "object" &&
            typeof c.code === "string" &&
            typeof c.studentName === "string" &&
            typeof c.nurseryName === "string" &&
            typeof c.addedAt === "number",
        )
      : [];
    const activeIndex =
      typeof value.activeIndex === "number" &&
      value.activeIndex >= 0 &&
      value.activeIndex < codes.length
        ? value.activeIndex
        : 0;
    return { codes, activeIndex };
  } catch {
    return EMPTY;
  }
}

function read(): CodesState {
  if (typeof window === "undefined") return EMPTY;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedState = parse(raw);
  }
  return cachedState;
}

function emit() {
  for (const listener of listeners) listener();
}

function write(next: CodesState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode / quota: keep the in-memory state so the session works.
    cachedRaw = JSON.stringify(next);
    cachedState = next;
  }
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Cross-tab: another tab adding/removing a code updates this one too.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function getCodes(): CodesState {
  return read();
}

/** Add (or refresh) a code and make it the active child. Stamps `addedAt`. */
export function addCode(entry: Omit<StoredCode, "addedAt">) {
  const stored: StoredCode = { ...entry, addedAt: Date.now() };
  const state = read();
  const existing = state.codes.findIndex((c) => c.code === stored.code);
  const codes =
    existing >= 0
      ? state.codes.map((c, i) => (i === existing ? stored : c))
      : [...state.codes, stored];
  const activeIndex = existing >= 0 ? existing : codes.length - 1;
  write({ codes, activeIndex });
}

export function removeCode(code: string) {
  const state = read();
  const removedIndex = state.codes.findIndex((c) => c.code === code);
  if (removedIndex < 0) return;
  const codes = state.codes.filter((_, i) => i !== removedIndex);
  let activeIndex = state.activeIndex;
  if (removedIndex < activeIndex) activeIndex -= 1;
  if (activeIndex >= codes.length) activeIndex = 0;
  write({ codes, activeIndex });
}

export function setActive(index: number) {
  const state = read();
  if (index < 0 || index >= state.codes.length) return;
  write({ ...state, activeIndex: index });
}

/** Reactive stored-codes state. SSR renders as "no codes". */
export function useCodes(): CodesState & { active: StoredCode | null } {
  const state = useSyncExternalStore(subscribe, read, () => EMPTY);
  return { ...state, active: state.codes[state.activeIndex] ?? null };
}
