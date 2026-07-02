// Small pure helpers for the parent portal.

/**
 * Format raw keyboard/paste input as an access code: strip everything but
 * letters/digits, uppercase, cap at 12 chars, group as XXXX-XXXX-XXXX.
 * Paste-tolerant: spaces, dashes and mixed case all normalize away.
 */
export function formatCodeInput(raw: string): string {
  const chars = raw
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .slice(0, 12);
  const groups: string[] = [];
  for (let i = 0; i < chars.length; i += 4) {
    groups.push(chars.slice(i, i + 4));
  }
  return groups.join("-");
}

/** True when the input has all 12 characters (ready to submit). */
export function isCompleteCode(formatted: string): boolean {
  return formatted.replace(/-/g, "").length === 12;
}

const RELATIVE_STEPS: { limit: number; divisor: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { limit: 60_000, divisor: 1000, unit: "second" },
  { limit: 3_600_000, divisor: 60_000, unit: "minute" },
  { limit: 86_400_000, divisor: 3_600_000, unit: "hour" },
  { limit: 7 * 86_400_000, divisor: 86_400_000, unit: "day" },
  { limit: 30 * 86_400_000, divisor: 7 * 86_400_000, unit: "week" },
  { limit: 365 * 86_400_000, divisor: 30 * 86_400_000, unit: "month" },
  { limit: Infinity, divisor: 365 * 86_400_000, unit: "year" },
];

/** "قبل ٥ دقائق" / "5 minutes ago" — locale-aware relative timestamp. */
export function formatRelativeTime(
  timestamp: number,
  locale: "ar" | "en",
  now = Date.now(),
): string {
  const elapsed = Math.max(0, now - timestamp);
  const rtf = new Intl.RelativeTimeFormat(locale === "ar" ? "ar-JO" : "en-US", {
    numeric: "auto",
  });
  const step =
    RELATIVE_STEPS.find((s) => elapsed < s.limit) ??
    RELATIVE_STEPS[RELATIVE_STEPS.length - 1];
  return rtf.format(-Math.round(elapsed / step.divisor), step.unit);
}
