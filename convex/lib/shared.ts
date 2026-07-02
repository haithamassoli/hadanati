// PURE helpers — no Convex imports; safe to import from client code.

export const STATUS_CYCLE = ["present", "absent", "late", "excused"] as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/**
 * Format integer fils (JOD × 1000) as a currency string.
 * ar → Arabic-Indic digits via Intl ("د.أ." style), en → "JOD 12.500".
 */
export function formatFils(fils: number, locale: "ar" | "en"): string {
  const jod = fils / 1000;
  if (locale === "ar") {
    return new Intl.NumberFormat("ar-JO", {
      style: "currency",
      currency: "JOD",
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }).format(jod);
  }
  const amount = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(jod);
  return `JOD ${amount}`;
}

/**
 * Parse a user-entered JOD amount ("12.5", "١٢٫٥٠٠", "12,500.250") into
 * integer fils. Throws on unparseable input.
 */
export function parseJodToFils(s: string): number {
  const normalized = s
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/٫/g, ".")
    .replace(/[^0-9.-]/g, "");
  const value = Number(normalized);
  if (normalized === "" || !Number.isFinite(value)) {
    throw new Error(`invalid JOD amount: ${s}`);
  }
  return Math.round(value * 1000);
}

/** UTC midnight Date of the Sunday of the week containing the given ISO date. */
function sundayOf(dateISO: string): number {
  const d = new Date(`${dateISO}T00:00:00Z`);
  return d.getTime() - d.getUTCDay() * DAY_MS;
}

/**
 * Academic week number (Sunday-start school week).
 * Week 1 = the week containing yearStart. Dates before that week
 * yield 0 or negative numbers.
 */
export function academicWeek(dateISO: string, yearStartISO: string): number {
  return Math.floor((sundayOf(dateISO) - sundayOf(yearStartISO)) / WEEK_MS) + 1;
}

/**
 * Today's date in Asia/Amman as "YYYY-MM-DD".
 * Simplification: Jordan is UTC+3 year-round (no DST since 2022),
 * so we offset Date.now() by +3h instead of using a TZ database.
 */
export function todayISO(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
