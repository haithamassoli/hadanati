"use client";

// Student account statement — كشف حساب (FR-FIN-5, §5 print stylesheet).
// Chronological invoice (+) / payment (−) lines with an exact running
// balance in integer fils.

import { use } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { todayISO } from "@/convex/lib/shared";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { useT } from "@/lib/i18n";
import { Spinner } from "@/components/ui/spinner";
import { FinanceGate, isolateDates, Money } from "../../shared";
import { PrintDocument, PrintToolbar } from "../../print-document";

export default function StatementPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = use(params);
  return (
    <FinanceGate>
      {({ nurseryId }) => (
        <Statement
          nurseryId={nurseryId}
          studentId={studentId as Id<"students">}
        />
      )}
    </FinanceGate>
  );
}

function Statement({
  nurseryId,
  studentId,
}: {
  nurseryId: Id<"nurseries">;
  studentId: Id<"students">;
}) {
  const { t } = useT();
  const data = useCachedQuery(api.finance.statement, {
    nurseryId,
    studentId,
  }).data;

  if (data === undefined) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center">
        <Spinner className="size-6 text-primary" />
      </div>
    );
  }

  const { student, nurseryName, yearId, lines, totals } = data;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 md:p-8 print:max-w-none print:p-0">
      <PrintToolbar backHref={`/students/${student._id}`} />

      <PrintDocument
        nurseryName={nurseryName}
        title={t("finance.statement.title")}
        meta={[
          { label: t("finance.receipt.student"), value: student.nameAr },
          {
            label: t("finance.statement.year"),
            value: (
              <span dir="ltr" className="tabular-nums">
                {yearId}
              </span>
            ),
          },
          {
            label: t("finance.statement.generatedOn"),
            value: (
              <span dir="ltr" className="tabular-nums">
                {todayISO()}
              </span>
            ),
          },
        ]}
      >
        {lines.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground print:text-foreground">
            {t("finance.statement.empty")}
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-foreground/60 text-start">
                <th className="py-2 text-start font-medium">
                  {t("finance.statement.table.date")}
                </th>
                <th className="py-2 text-start font-medium">
                  {t("finance.statement.table.description")}
                </th>
                <th className="py-2 text-end font-medium">
                  {t("finance.statement.table.amount")}
                </th>
                <th className="py-2 text-end font-medium">
                  {t("finance.statement.table.balance")}
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={index} className="border-b border-foreground/15">
                  <td className="py-2">
                    <span dir="ltr" className="tabular-nums">
                      {line.date}
                    </span>
                  </td>
                  <td className="py-2">
                    {t(`finance.kind.${line.kind}`)}
                    {line.kind === "payment" && line.method !== undefined
                      ? ` — ${t(`finance.method.${line.method}`)}`
                      : ""}
                    {line.description !== ""
                      ? ` — ${isolateDates(line.description)}`
                      : ""}
                  </td>
                  <td className="py-2 text-end">
                    <Money fils={line.amountFils} />
                  </td>
                  <td className="py-2 text-end">
                    <Money fils={line.runningBalanceFils} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} className="pt-3" />
                <td className="pt-3 text-end text-muted-foreground print:text-foreground">
                  {t("finance.statement.totalInvoiced")}
                </td>
                <td className="pt-3 text-end">
                  <Money fils={totals.invoicedFils} />
                </td>
              </tr>
              <tr>
                <td colSpan={2} />
                <td className="py-1 text-end text-muted-foreground print:text-foreground">
                  {t("finance.statement.totalPaid")}
                </td>
                <td className="py-1 text-end">
                  <Money fils={totals.paidFils} />
                </td>
              </tr>
              <tr className="border-t border-foreground/60">
                <td colSpan={2} />
                <td className="py-2 text-end font-medium">
                  {t("finance.statement.balance")}
                </td>
                <td className="py-2 text-end">
                  <Money fils={totals.balanceFils} className="font-heading" />
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </PrintDocument>
    </div>
  );
}
