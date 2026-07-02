"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { Direction } from "radix-ui";
import { ar } from "./ar";
import { en } from "./en";
import { students } from "./ns/students";
import { classrooms } from "./ns/classrooms";
import { staff } from "./ns/staff";
import { attendance } from "./ns/attendance";
import { evaluations } from "./ns/evaluations";
import { dashboard } from "./ns/dashboard";
import { finance } from "./ns/finance";
import { portal } from "./ns/portal";
import { announcements } from "./ns/announcements";

export type Locale = "ar" | "en";

// Feature namespaces live in ns/* — one file per feature, parallel-edit safe.
const ns = [
  students,
  classrooms,
  staff,
  attendance,
  evaluations,
  dashboard,
  finance,
  portal,
  announcements,
];

const dictionaries: Record<Locale, Record<string, string>> = {
  ar: Object.assign({ ...ar }, ...ns.map((n) => n.ar)),
  en: Object.assign({ ...en }, ...ns.map((n) => n.en)),
};

type LocaleContextValue = {
  locale: Locale;
  t: (key: string) => string;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function setLocale(locale: Locale) {
  document.cookie = `locale=${locale};path=/;max-age=31536000;samesite=lax`;
  // A dir flip (rtl ↔ ltr) needs a full document reload.
  window.location.reload();
}

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key) => dictionaries[locale][key] ?? dictionaries.ar[key] ?? key,
    }),
    [locale],
  );
  return (
    <LocaleContext.Provider value={value}>
      <Direction.Provider dir={locale === "ar" ? "rtl" : "ltr"}>
        {children}
      </Direction.Provider>
    </LocaleContext.Provider>
  );
}

export function useT(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (ctx === null) {
    throw new Error("useT must be used within a LocaleProvider");
  }
  return ctx;
}
