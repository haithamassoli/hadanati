import type { Locale } from "@/lib/i18n";

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** "25" → "٢٥" for the Arabic locale, unchanged otherwise. */
export function localizeNumber(n: number, locale: Locale): string {
  const s = String(n);
  return locale === "ar" ? s.replace(/\d/g, (d) => AR_DIGITS[Number(d)]) : s;
}

/** Arabic plural category (zero/one/two/few/many) mapped to i18n subkeys. */
function pluralKey(n: number): "zero" | "one" | "two" | "few" | "many" {
  if (n === 0) return "zero";
  if (n === 1) return "one";
  if (n === 2) return "two";
  const mod = n % 100;
  if (mod >= 3 && mod <= 10) return "few";
  return "many";
}

type T = (key: string) => string;

/** Pluralized count string from keys `<base>.zero|one|two|few|many` ({n} placeholder). */
export function formatCount(
  n: number,
  base: string,
  t: T,
  locale: Locale,
): string {
  return t(`${base}.${pluralKey(n)}`).replace(
    "{n}",
    localizeNumber(n, locale),
  );
}

/** Whole years + leftover months between dob ("YYYY-MM-DD") and today. */
function ageParts(dob: string): { years: number; months: number } {
  const [y, m, d] = dob.split("-").map(Number);
  const now = new Date();
  let months =
    (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
  if (now.getDate() < d) months -= 1;
  if (months < 0) months = 0;
  return { years: Math.floor(months / 12), months: months % 12 };
}

/** Natural age string, e.g. "٣ سنوات" or "٨ أشهر". */
export function formatAge(dob: string, t: T, locale: Locale): string {
  const { years, months } = ageParts(dob);
  if (years === 0) {
    if (months === 0) return t("students.age.lessThanMonth");
    if (months === 1) return t("students.age.month1");
    if (months === 2) return t("students.age.month2");
    const key = months <= 10 ? "students.age.monthsFew" : "students.age.monthsMany";
    return t(key).replace("{n}", localizeNumber(months, locale));
  }
  if (years === 1) return t("students.age.year1");
  if (years === 2) return t("students.age.year2");
  const key = years <= 10 ? "students.age.yearsFew" : "students.age.yearsMany";
  return t(key).replace("{n}", localizeNumber(years, locale));
}
