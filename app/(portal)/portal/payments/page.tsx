"use client";

// Payments tab (FR-PAR-3): read-only invoices + recorded payments for the
// active child, warm Arabic-first. Money is integer fils end-to-end and
// only formatted for display via formatFils.

import { useState } from "react";
import { ChevronDown, PartyPopper, Receipt, Wallet } from "lucide-react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { formatFils } from "@/convex/lib/shared";
import { useT, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { localizeNumber } from "@/app/(staff)/students/format";
import { useCodes } from "@/lib/portal/codes";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { DataAge } from "@/components/data-age";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

type T = (key: string) => string;

type InvoiceItem = FunctionReturnType<
  typeof api.portal.invoices
>["invoices"][number];

/** "YYYY-MM-DD" → localized long date ("١٠ تموز ٢٠٢٦"). */
function formatDay(iso: string, locale: Locale): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(
    locale === "ar" ? "ar-JO" : "en-US",
    { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" },
  );
}

function statusBadge(invoice: InvoiceItem, t: T, locale: Locale) {
  if (invoice.computedStatus === "paid") {
    return (
      <Badge className="bg-present-soft text-present">
        {t("portal.payments.status.paid")}
      </Badge>
    );
  }
  if (invoice.computedStatus === "overdue") {
    return (
      <Badge className="bg-absent-soft text-absent">
        {t("portal.payments.status.overdue")}
      </Badge>
    );
  }
  // issued / partial → how much is still due
  return (
    <Badge className="bg-late-soft text-late-foreground">
      {t("portal.payments.status.remaining").replace(
        "{amount}",
        formatFils(invoice.amountFils - invoice.paidFils, locale),
      )}
    </Badge>
  );
}

export default function PortalPaymentsPage() {
  const { active } = useCodes();
  if (active === null) return null;
  return <Payments key={active.code} code={active.code} />;
}

function Payments({ code }: { code: string }) {
  const { t, locale } = useT();
  const { data, isStale, updatedAt } = useCachedQuery(api.portal.invoices, {
    code,
  });

  if (data === undefined) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  const balance = data.totals.balanceFils;

  return (
    <div className="flex flex-col gap-4">
      <DataAge updatedAt={updatedAt} isStale={isStale} />
      <h1 className="font-heading text-2xl">{t("portal.payments.title")}</h1>

      {/* Totals header — the one number a parent came for */}
      {balance > 0 ? (
        <Card className="border-late/40 bg-late-soft/40">
          <CardContent className="flex items-center gap-3.5 py-5">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-late-soft text-late-foreground">
              <Wallet className="size-6" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">
                {t("portal.payments.balanceTitle")}
              </p>
              <p className="font-heading text-3xl leading-tight text-late-foreground">
                {formatFils(balance, locale)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("portal.payments.balanceDesc")}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-present/40 bg-present-soft/40">
          <CardContent className="flex items-center gap-3.5 py-5">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-present-soft text-present">
              <PartyPopper className="size-6" />
            </div>
            <div className="min-w-0">
              <p className="font-heading text-2xl leading-tight text-present">
                {t("portal.payments.noBalance")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("portal.payments.noBalanceDesc")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {data.invoices.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Receipt />
            </EmptyMedia>
            <EmptyTitle>{t("portal.payments.empty")}</EmptyTitle>
            <EmptyDescription>{t("portal.payments.emptyDesc")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.invoices.map((invoice) => (
            <li key={invoice._id}>
              <InvoiceCard invoice={invoice} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InvoiceCard({ invoice }: { invoice: InvoiceItem }) {
  const { t, locale } = useT();
  const [open, setOpen] = useState(false);

  const title =
    invoice.description ??
    invoice.planName ??
    t("portal.payments.invoiceFallback");

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <h2 className="min-w-0 font-heading text-lg leading-snug">{title}</h2>
          {statusBadge(invoice, t, locale)}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-muted/40 px-1 py-2.5">
            <p className="text-[0.65rem] text-muted-foreground">
              {t("portal.payments.amount")}
            </p>
            <p className="mt-0.5 text-sm font-medium">
              {formatFils(invoice.amountFils, locale)}
            </p>
          </div>
          <div className="rounded-xl bg-muted/40 px-1 py-2.5">
            <p className="text-[0.65rem] text-muted-foreground">
              {t("portal.payments.paid")}
            </p>
            <p className="mt-0.5 text-sm font-medium">
              {formatFils(invoice.paidFils, locale)}
            </p>
          </div>
          <div className="rounded-xl bg-muted/40 px-1 py-2.5">
            <p className="text-[0.65rem] text-muted-foreground">
              {t("portal.payments.dueDate")}
            </p>
            <p className="mt-0.5 text-sm font-medium">
              {formatDay(invoice.dueDate, locale)}
            </p>
          </div>
        </div>

        {invoice.payments.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="flex min-h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-medium text-primary transition-colors hover:bg-muted/50"
            >
              {open
                ? t("portal.payments.hidePayments")
                : t("portal.payments.showPayments").replace(
                    "{n}",
                    localizeNumber(invoice.payments.length, locale),
                  )}
              <ChevronDown
                className={cn(
                  "size-4 transition-transform",
                  open && "rotate-180",
                )}
                aria-hidden
              />
            </button>
            {open && (
              <div className="flex flex-col rounded-xl border">
                {invoice.payments.map((payment, index) => (
                  <div key={`${payment.paidAt}-${index}`}>
                    {index > 0 && <Separator />}
                    <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm">
                      <span className="text-muted-foreground">
                        {formatDay(payment.paidAt, locale)}
                      </span>
                      <span className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {t(`portal.payments.method.${payment.method}`)}
                        </Badge>
                        <span className="font-medium">
                          {formatFils(payment.amountFils, locale)}
                        </span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
