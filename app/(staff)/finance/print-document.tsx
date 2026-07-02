"use client";

// PRD §5 — print stylesheet, NOT PDF export. A PrintDocument renders a clean
// A4-friendly paper: everything else on the page carries data-print-hidden
// (the staff layout chrome already does). globals.css maps
// [data-print-hidden]{display:none} and flips tokens to black-on-white
// under @media print.

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Printer } from "lucide-react";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export function PrintToolbar({ backHref }: { backHref: string }) {
  const { t } = useT();
  return (
    <div
      data-print-hidden
      className="flex items-center justify-between gap-2"
    >
      <Link
        href={backHref}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="size-4 rtl:rotate-0 ltr:rotate-180" />
        {t("finance.print.back")}
      </Link>
      <Button type="button" onClick={() => window.print()}>
        <Printer data-icon="inline-start" />
        {t("finance.print")}
      </Button>
    </div>
  );
}

/**
 * The paper itself: nursery header, document title, meta rows, body,
 * signature/stamp footer. Soft colors are avoided — the document must stay
 * legible in pure black-on-white (§5).
 */
export function PrintDocument({
  nurseryName,
  title,
  meta,
  children,
}: {
  nurseryName: string;
  title: string;
  meta: Array<{ label: string; value: ReactNode }>;
  children: ReactNode;
}) {
  const { t } = useT();
  return (
    <article className="rounded-xl border bg-card p-6 text-foreground print:rounded-none print:border-0 print:bg-transparent print:p-0 print:shadow-none">
      <header className="flex items-start justify-between gap-4 border-b-2 border-foreground/80 pb-4">
        <div>
          <p className="font-heading text-2xl">{nurseryName}</p>
          <p className="mt-1 text-sm text-muted-foreground print:text-foreground">
            {t("app.name")}
          </p>
        </div>
        <h1 className="font-heading text-xl">{title}</h1>
      </header>

      <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
        {meta.map(({ label, value }) => (
          <div
            key={label}
            className="flex items-baseline justify-between gap-3"
          >
            <dt className="shrink-0 text-muted-foreground print:text-foreground">
              {label}
            </dt>
            <dd className="min-w-0 text-end font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5">{children}</div>

      <footer className="mt-10 flex items-end justify-between gap-4">
        <div className="w-48 border-t border-foreground/70 pt-1.5 text-sm text-muted-foreground print:text-foreground">
          {t("finance.print.signature")}
        </div>
        <p className="text-xs text-muted-foreground print:text-foreground">
          {t("finance.print.footer")}
        </p>
      </footer>
    </article>
  );
}
