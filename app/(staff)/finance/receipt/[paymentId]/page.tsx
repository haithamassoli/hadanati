"use client";

// Payment receipt — إيصال قبض (FR-FIN-3, §5 print stylesheet).

import { use } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { useT } from "@/lib/i18n";
import { Spinner } from "@/components/ui/spinner";
import { FinanceGate, isolateDates, ltr, Money } from "../../shared";
import { PrintDocument, PrintToolbar } from "../../print-document";

export default function ReceiptPage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const { paymentId } = use(params);
  return (
    <FinanceGate>
      {({ nurseryId }) => (
        <Receipt
          nurseryId={nurseryId}
          paymentId={paymentId as Id<"payments">}
        />
      )}
    </FinanceGate>
  );
}

function Receipt({
  nurseryId,
  paymentId,
}: {
  nurseryId: Id<"nurseries">;
  paymentId: Id<"payments">;
}) {
  const { t } = useT();
  const data = useCachedQuery(api.payments.get, { nurseryId, paymentId }).data;

  if (data === undefined) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center">
        <Spinner className="size-6 text-primary" />
      </div>
    );
  }

  const { payment, invoice, student, nurseryName, receiverName } = data;
  const description =
    invoice.description !== undefined
      ? isolateDates(invoice.description)
      : invoice.period !== undefined
        ? `${t("finance.receipt.invoiceDefault")} — ${ltr(invoice.period)}`
        : t("finance.receipt.invoiceDefault");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 md:p-8 print:max-w-none print:p-0">
      <PrintToolbar backHref="/finance/invoices" />

      <PrintDocument
        nurseryName={nurseryName}
        title={t("finance.receipt.title")}
        meta={[
          {
            label: t("finance.receipt.number"),
            value: (
              <span dir="ltr" className="font-mono text-xs">
                {payment._id}
              </span>
            ),
          },
          {
            label: t("finance.receipt.date"),
            value: (
              <span dir="ltr" className="tabular-nums">
                {payment.paidAt}
              </span>
            ),
          },
          { label: t("finance.receipt.student"), value: student.nameAr },
          {
            label: t("finance.receipt.method"),
            value: t(`finance.method.${payment.method}`),
          },
          { label: t("finance.receipt.receivedBy"), value: receiverName },
        ]}
      >
        <table className="w-full border-collapse text-sm">
          <tbody>
            <tr className="border-b border-foreground/20">
              <th className="py-2 text-start font-normal text-muted-foreground print:text-foreground">
                {t("finance.receipt.for")}
              </th>
              <td className="py-2 text-end">{description}</td>
            </tr>
            <tr className="border-b border-foreground/20">
              <th className="py-2 text-start font-normal text-muted-foreground print:text-foreground">
                {t("finance.receipt.invoiceAmount")}
              </th>
              <td className="py-2 text-end">
                <Money fils={invoice.amountFils} />
              </td>
            </tr>
            <tr className="border-b border-foreground/20">
              <th className="py-3 text-start font-medium">
                {t("finance.receipt.paymentAmount")}
              </th>
              <td className="py-3 text-end">
                <Money
                  fils={payment.amountFils}
                  className="font-heading text-lg"
                />
              </td>
            </tr>
            <tr className="border-b border-foreground/20">
              <th className="py-2 text-start font-normal text-muted-foreground print:text-foreground">
                {t("finance.receipt.totalPaid")}
              </th>
              <td className="py-2 text-end">
                <Money fils={invoice.paidFils} />
              </td>
            </tr>
            <tr>
              <th className="py-2 text-start font-normal text-muted-foreground print:text-foreground">
                {t("finance.receipt.remaining")}
              </th>
              <td className="py-2 text-end">
                <Money fils={invoice.amountFils - invoice.paidFils} />
              </td>
            </tr>
            {payment.note !== undefined && (
              <tr className="border-t border-foreground/20">
                <th className="py-2 text-start font-normal text-muted-foreground print:text-foreground">
                  {t("finance.receipt.note")}
                </th>
                <td className="py-2 text-end">{payment.note}</td>
              </tr>
            )}
          </tbody>
        </table>
      </PrintDocument>
    </div>
  );
}
