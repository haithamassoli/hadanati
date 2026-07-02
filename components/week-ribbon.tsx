"use client";

import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { todayISO } from "@/convex/lib/shared";

const DAY_KEYS = [
  "days.sun",
  "days.mon",
  "days.tue",
  "days.wed",
  "days.thu",
  "days.fri",
  "days.sat",
] as const;

function parseISO(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * The "week ribbon" — a Sun→Thu day strip (Fri/Sat visually muted) showing
 * the week containing `selectedDate`. Pure presentational.
 */
export function WeekRibbon({
  selectedDate,
  onSelect,
  className,
  isDayDisabled,
}: {
  selectedDate: string;
  onSelect?: (date: string) => void;
  className?: string;
  /** Optional per-day gate: return true to disable a day (e.g. teachers → non-today). */
  isDayDisabled?: (date: string) => boolean;
}) {
  const { t, locale } = useT();
  const dayNumber = new Intl.NumberFormat(locale === "ar" ? "ar-JO" : "en-US");
  const selected = parseISO(selectedDate);
  const weekStart = new Date(selected);
  weekStart.setDate(selected.getDate() - selected.getDay());
  const today = todayISO();

  return (
    <div className={cn("grid grid-cols-7 gap-1.5", className)}>
      {DAY_KEYS.map((key, i) => {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + i);
        const iso = toISO(day);
        const isSchoolDay = i <= 4;
        const isToday = iso === today;
        const isSelected = iso === selectedDate;
        const dayDisabled = isDayDisabled?.(iso) === true;
        return (
          <button
            key={iso}
            type="button"
            disabled={onSelect === undefined || dayDisabled}
            onClick={() => {
              if (!dayDisabled) onSelect?.(iso);
            }}
            aria-pressed={isSelected}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-xl border py-2 text-xs transition-colors",
              isSchoolDay
                ? "border-border bg-card"
                : "border-transparent bg-muted opacity-45",
              isSchoolDay &&
                onSelect !== undefined &&
                !isSelected &&
                "hover:bg-muted",
              isSelected &&
                isSchoolDay &&
                "border-primary bg-primary text-primary-foreground",
              isToday && "ring-2 ring-primary ring-offset-2 ring-offset-background",
              dayDisabled && !isSelected && "opacity-40",
            )}
          >
            <span>{t(key)}</span>
            <span className="font-heading text-base leading-tight">
              {dayNumber.format(day.getDate())}
            </span>
          </button>
        );
      })}
    </div>
  );
}
