"use client";

// Finance overview (FR-FIN-5): month stats, overdue list, quick actions.
// admin + accountant only — FinanceGate shows the teacher card otherwise.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Receipt } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { useOnline } from "@/lib/offline/use-online";
import { useT } from "@/lib/i18n";
import { formatCount } from "@/app/(staff)/students/format";
import { DataAge } from "@/components/data-age";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  daysLateLabel,
  FinanceGate,
  FinanceNav,
  FinanceOfflineNote,
  GenerateMonthButton,
  ManualInvoiceDialog,
  Money,
} from "./shared";

export default function FinanceOverviewPage() {
  const { t } = useT();
  return (
    <FinanceGate>
      {({ nurseryId }) => (
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-4 md:p-8">
          <header data-print-hidden>
            <h1 className="text-2xl">{t("finance.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("finance.subtitle")}
            </p>
          </header>
          <FinanceNav />
          <Overview nurseryId={nurseryId} />
        </div>
      )}
    </FinanceGate>
  );
}

function Overview({ nurseryId }: { nurseryId: Id<"nurseries"> }) {
  const { t, locale } = useT();
  const online = useOnline();
  const router = useRouter();
  const overviewQ = useCachedQuery(api.finance.overview, { nurseryId });
  const overview = overviewQ.data;
  const [newInvoiceOpen, setNewInvoiceOpen] = useState(false);

  if (overview === undefined) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  const overdueSumFils = overview.overdueList.reduce(
    (sum, row) => sum + (row.amountFils - row.paidFils),
    0,
  );

  const stats = [
    {
      key: "collected",
      label: t("finance.stats.collected"),
      fils: overview.collectedMTDFils,
      cardClass: "border-present/30 bg-present-soft",
    },
    {
      key: "outstanding",
      label: t("finance.stats.outstanding"),
      fils: overview.outstandingFils,
      cardClass: "border-late/30 bg-late-soft",
    },
    {
      key: "overdue",
      label: t("finance.stats.overdue"),
      fils: overdueSumFils,
      sub: formatCount(
        overview.overdueList.length,
        "finance.stats.overdueCount",
        t,
        locale,
      ),
      cardClass: "border-absent/30 bg-absent-soft",
    },
    {
      key: "expenses",
      label: t("finance.stats.expenses"),
      fils: overview.expensesMTDFils,
      cardClass: "bg-card",
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <DataAge
        isStale={overviewQ.isStale}
        updatedAt={overviewQ.updatedAt}
        className="self-start"
      />

      <section className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.key}
            className={`rounded-xl border p-3 ${stat.cardClass}`}
          >
            <p className="text-xs font-medium text-muted-foreground">
              {stat.label}
            </p>
            <p className="mt-1 font-heading text-xl text-foreground">
              <Money fils={stat.fils} />
            </p>
            {stat.sub !== undefined && (
              <p className="mt-0.5 text-xs text-muted-foreground">{stat.sub}</p>
            )}
          </div>
        ))}
      </section>

      {/* Quick actions — all finance writes require a connection (FR-FIN-6) */}
      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={!online} onClick={() => setNewInvoiceOpen(true)}>
            <Plus data-icon="inline-start" />
            {t("finance.actions.newInvoice")}
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/finance/invoices?filter=open")}
          >
            <Receipt data-icon="inline-start" />
            {t("finance.actions.recordPayment")}
          </Button>
          <GenerateMonthButton nurseryId={nurseryId} />
        </div>
        <FinanceOfflineNote />
      </section>

      {/* Overdue invoices */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          {t("finance.overdue.title")}
        </h2>
        {overview.overdueList.length === 0 ? (
          <p className="rounded-xl border bg-card py-8 text-center text-sm text-muted-foreground">
            {t("finance.overdue.empty")}
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("finance.table.student")}</TableHead>
                  <TableHead>{t("finance.table.remaining")}</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    {t("finance.table.dueDate")}
                  </TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.overdueList.map((row) => (
                  <TableRow
                    key={row.invoiceId}
                    className="cursor-pointer"
                    onClick={() =>
                      router.push(`/finance/invoices?invoice=${row.invoiceId}`)
                    }
                  >
                    <TableCell className="font-medium">
                      {row.studentNameAr}
                    </TableCell>
                    <TableCell>
                      <Money fils={row.amountFils - row.paidFils} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span dir="ltr" className="tabular-nums">
                        {row.dueDate}
                      </span>
                    </TableCell>
                    <TableCell className="text-end">
                      <Badge
                        variant="outline"
                        className="border-absent/40 bg-absent-soft"
                      >
                        {daysLateLabel(row.daysLate, t, locale)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <ManualInvoiceDialog
        open={newInvoiceOpen}
        onOpenChange={setNewInvoiceOpen}
        nurseryId={nurseryId}
      />
    </div>
  );
}
