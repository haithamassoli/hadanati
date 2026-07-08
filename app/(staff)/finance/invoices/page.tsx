"use client";

// Invoices (FR-FIN-2): filter tabs, student search, bulk month generation,
// manual invoices, detail sheet with payments / void / print links.

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "convex/react";
import { Ban, Plus, Printer, Receipt } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { todayISO } from "@/convex/lib/shared";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { useOnline } from "@/lib/offline/use-online";
import { useT } from "@/lib/i18n";
import { DataAge } from "@/components/data-age";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  errorCode,
  filsToJodInput,
  FinanceGate,
  FinanceNav,
  FinanceOfflineNote,
  GenerateMonthButton,
  InvoiceStatusBadge,
  isolateDates,
  ltr,
  ManualInvoiceDialog,
  Money,
  parseJodOrNull,
} from "../shared";

type Filter = "all" | "open" | "overdue" | "paid" | "draft" | "void";

const FILTERS: Filter[] = ["all", "open", "overdue", "paid", "draft", "void"];

const METHODS = ["cash", "cliq", "transfer", "cheque"] as const;

export default function InvoicesPage() {
  const { t } = useT();
  return (
    <FinanceGate>
      {({ nurseryId }) => (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 md:p-8">
          <header data-print-hidden>
            <h1 className="text-2xl">{t("finance.nav.invoices")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("finance.subtitle")}
            </p>
          </header>
          <FinanceNav />
          {/* useSearchParams needs a Suspense boundary for prerendering */}
          <Suspense fallback={<Skeleton className="h-40 rounded-xl" />}>
            <InvoicesView nurseryId={nurseryId} />
          </Suspense>
        </div>
      )}
    </FinanceGate>
  );
}

function InvoicesView({ nurseryId }: { nurseryId: Id<"nurseries"> }) {
  const { t } = useT();
  const online = useOnline();
  const searchParams = useSearchParams();
  const router = useRouter();

  const paramFilter = searchParams.get("filter");
  const [filter, setFilter] = useState<Filter>(
    FILTERS.includes(paramFilter as Filter) ? (paramFilter as Filter) : "all",
  );
  const [search, setSearch] = useState("");
  const [newInvoiceOpen, setNewInvoiceOpen] = useState(false);
  // Deep link: /finance/invoices?invoice=<id> opens the detail sheet.
  const [openInvoiceId, setOpenInvoiceId] = useState<Id<"invoices"> | null>(
    (searchParams.get("invoice") as Id<"invoices"> | null) ?? null,
  );

  const listQ = useCachedQuery(api.invoices.list, { nurseryId, filter });
  const rows = listQ.data;

  const visible =
    rows === undefined
      ? undefined
      : search.trim() === ""
        ? rows
        : rows.filter((row) => row.studentNameAr.includes(search.trim()));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={!online} onClick={() => setNewInvoiceOpen(true)}>
          <Plus data-icon="inline-start" />
          {t("finance.actions.newInvoice")}
        </Button>
        <GenerateMonthButton nurseryId={nurseryId} variant="outline" />
        <DataAge isStale={listQ.isStale} updatedAt={listQ.updatedAt} />
      </div>
      <FinanceOfflineNote className="-mt-2" />

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          {FILTERS.map((f) => (
            <TabsTrigger key={f} value={f}>
              {t(`finance.filter.${f}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Input
        value={search}
        placeholder={t("finance.invoices.search")}
        className="max-w-sm"
        onChange={(e) => setSearch(e.target.value)}
      />

      {visible === undefined ? (
        <div className="flex justify-center py-12">
          <Spinner className="size-6 text-primary" />
        </div>
      ) : visible.length === 0 ? (
        <p className="rounded-xl border bg-card py-8 text-center text-sm text-muted-foreground">
          {t("finance.invoices.empty")}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("finance.table.student")}</TableHead>
                <TableHead className="hidden md:table-cell">
                  {t("finance.table.description")}
                </TableHead>
                <TableHead>{t("finance.table.amount")}</TableHead>
                <TableHead className="hidden sm:table-cell">
                  {t("finance.table.paid")}
                </TableHead>
                <TableHead>{t("finance.table.status")}</TableHead>
                <TableHead className="hidden lg:table-cell">
                  {t("finance.table.dueDate")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row) => {
                const voided = row.computedStatus === "void";
                return (
                  <TableRow
                    key={row._id}
                    className="cursor-pointer"
                    onClick={() => setOpenInvoiceId(row._id)}
                  >
                    <TableCell
                      className={
                        voided
                          ? "text-muted-foreground line-through"
                          : "font-medium"
                      }
                    >
                      {row.studentNameAr}
                    </TableCell>
                    <TableCell className="hidden max-w-48 truncate text-muted-foreground md:table-cell">
                      {row.description !== undefined
                        ? isolateDates(row.description)
                        : row.planName !== undefined
                          ? row.period !== undefined
                            ? `${row.planName} — ${ltr(row.period)}`
                            : row.planName
                          : "—"}
                    </TableCell>
                    <TableCell
                      className={voided ? "text-muted-foreground line-through" : ""}
                    >
                      <Money fils={row.amountFils} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Money fils={row.paidFils} className="text-muted-foreground" />
                    </TableCell>
                    <TableCell>
                      <InvoiceStatusBadge status={row.computedStatus} />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span dir="ltr" className="tabular-nums">
                        {row.dueDate}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <ManualInvoiceDialog
        open={newInvoiceOpen}
        onOpenChange={setNewInvoiceOpen}
        nurseryId={nurseryId}
      />

      <Sheet
        open={openInvoiceId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setOpenInvoiceId(null);
            // Drop the ?invoice= deep-link once closed.
            if (searchParams.get("invoice") !== null) {
              router.replace("/finance/invoices");
            }
          }
        }}
      >
        <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-md">
          {openInvoiceId !== null && (
            <InvoiceDetail
              nurseryId={nurseryId}
              invoiceId={openInvoiceId}
              onVoided={() => setOpenInvoiceId(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function InvoiceDetail({
  nurseryId,
  invoiceId,
  onVoided,
}: {
  nurseryId: Id<"nurseries">;
  invoiceId: Id<"invoices">;
  onVoided: () => void;
}) {
  const { t } = useT();
  const online = useOnline();
  const detailQ = useCachedQuery(api.invoices.get, { nurseryId, invoiceId });
  const detail = detailQ.data;
  const voidInvoice = useMutation(api.invoices.voidInvoice);
  const [payOpen, setPayOpen] = useState(false);

  if (detail === undefined) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>{t("finance.invoice.title")}</SheetTitle>
          <SheetDescription className="sr-only">
            {t("finance.invoice.title")}
          </SheetDescription>
        </SheetHeader>
        <div className="flex justify-center py-12">
          <Spinner className="size-6 text-primary" />
        </div>
      </>
    );
  }

  const { invoice, computedStatus, paidFils, payments, student, plan } = detail;
  const remainingFils = invoice.amountFils - paidFils;
  const payable =
    computedStatus !== "paid" &&
    computedStatus !== "void" &&
    computedStatus !== "draft" &&
    remainingFils > 0;

  async function onVoid() {
    try {
      await voidInvoice({ nurseryId, invoiceId });
      toast.success(t("finance.toast.voided"));
      onVoided();
    } catch (error) {
      toast.error(
        errorCode(error) === "has_payments"
          ? t("finance.error.hasPayments")
          : t("finance.error.generic"),
      );
    }
  }

  const description =
    invoice.description !== undefined
      ? isolateDates(invoice.description)
      : plan !== undefined
        ? invoice.period !== undefined
          ? `${plan.name} — ${ltr(invoice.period)}`
          : plan.name
        : "—";

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          {t("finance.invoice.title")}
          <InvoiceStatusBadge status={computedStatus} />
        </SheetTitle>
        <SheetDescription>{student.nameAr}</SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-4 px-4 pb-6">
        <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 text-sm">
          <Row label={t("finance.table.description")} value={description} />
          <Row
            label={t("finance.invoice.amount")}
            value={<Money fils={invoice.amountFils} />}
          />
          <Row
            label={t("finance.invoice.paid")}
            value={<Money fils={paidFils} />}
          />
          <Row
            label={t("finance.invoice.remaining")}
            value={<Money fils={remainingFils} className="font-medium" />}
          />
          <Row
            label={t("finance.invoice.dueDate")}
            value={
              <span dir="ltr" className="tabular-nums">
                {invoice.dueDate}
              </span>
            }
          />
          {invoice.period !== undefined && (
            <Row
              label={t("finance.invoice.period")}
              value={
                <span dir="ltr" className="tabular-nums">
                  {invoice.period}
                </span>
              }
            />
          )}
          {plan !== undefined && (
            <Row label={t("finance.invoice.plan")} value={plan.name} />
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {payable && (
            <Button size="sm" disabled={!online} onClick={() => setPayOpen(true)}>
              <Receipt data-icon="inline-start" />
              {t("finance.invoice.pay")}
            </Button>
          )}
          <Button asChild size="sm" variant="outline">
            <Link href={`/finance/statement/${student._id}`}>
              <Printer data-icon="inline-start" />
              {t("finance.invoice.statement")}
            </Link>
          </Button>
          {computedStatus !== "void" && payments.length === 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!online}
                  className="text-destructive hover:text-destructive"
                >
                  <Ban data-icon="inline-start" />
                  {t("finance.invoice.void")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t("finance.invoice.voidTitle")}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("finance.invoice.voidDesc")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("staff.cancel")}</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={onVoid}>
                    {t("finance.invoice.voidConfirm")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
        <FinanceOfflineNote />

        <Separator />

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            {t("finance.invoice.payments")}
          </h3>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("finance.invoice.noPayments")}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {payments.map((payment) => (
                <li
                  key={payment._id}
                  className="flex flex-col gap-1 rounded-lg bg-muted/40 p-2.5 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Money fils={payment.amountFils} className="font-medium" />
                    <span className="text-xs text-muted-foreground">
                      {t(`finance.method.${payment.method}`)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      dir="ltr"
                      className="text-xs text-muted-foreground tabular-nums"
                    >
                      {payment.paidAt}
                    </span>
                    <Button asChild variant="ghost" size="sm" className="h-7">
                      <Link href={`/finance/receipt/${payment._id}`}>
                        <Printer data-icon="inline-start" />
                        {t("finance.invoice.receipt")}
                      </Link>
                    </Button>
                  </div>
                  {payment.receiverName !== "" && (
                    <p className="text-xs text-muted-foreground">
                      {t("finance.invoice.receivedBy")}: {payment.receiverName}
                    </p>
                  )}
                  {payment.note !== undefined && (
                    <p className="text-xs text-muted-foreground">
                      {payment.note}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <PaymentDialog
        key={`${String(payOpen)}-${remainingFils}`}
        open={payOpen}
        onOpenChange={setPayOpen}
        nurseryId={nurseryId}
        invoiceId={invoiceId}
        remainingFils={remainingFils}
      />
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-end">{value}</span>
    </div>
  );
}

function PaymentDialog({
  open,
  onOpenChange,
  nurseryId,
  invoiceId,
  remainingFils,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nurseryId: Id<"nurseries">;
  invoiceId: Id<"invoices">;
  remainingFils: number;
}) {
  const { t } = useT();
  const online = useOnline();
  const createPayment = useMutation(api.payments.create);

  // Prefill: the remaining balance as editable JOD text.
  const [amount, setAmount] = useState(filsToJodInput(remainingFils));
  const [method, setMethod] = useState<(typeof METHODS)[number]>("cash");
  const [paidAt, setPaidAt] = useState(todayISO());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amountFils = parseJodOrNull(amount);
    if (amountFils === null) {
      toast.error(t("finance.error.invalidAmount"));
      return;
    }
    setSaving(true);
    try {
      await createPayment({
        nurseryId,
        invoiceId,
        amountFils,
        method,
        paidAt,
        note: note.trim() === "" ? undefined : note.trim(),
      });
      toast.success(t("finance.toast.paymentRecorded"));
      onOpenChange(false);
    } catch (error) {
      const code = errorCode(error);
      toast.error(
        code === "exceeds_balance"
          ? t("finance.error.exceedsBalance")
          : code === "not_payable"
            ? t("finance.error.notPayable")
            : code === "invalid_amount"
              ? t("finance.error.invalidAmount")
              : t("finance.error.generic"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("finance.payment.title")}</DialogTitle>
          <DialogDescription>{t("finance.payment.desc")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="payment-amount">
                {t("finance.payment.amount")}
              </Label>
              <Input
                id="payment-amount"
                dir="ltr"
                inputMode="decimal"
                placeholder="85.000"
                required
                className="text-start tabular-nums"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t("finance.payment.method")}</Label>
              <Select
                value={method}
                onValueChange={(v) => setMethod(v as (typeof METHODS)[number])}
              >
                <SelectTrigger
                  className="w-full"
                  aria-label={t("finance.payment.method")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {t(`finance.method.${m}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="payment-paidAt">{t("finance.payment.paidAt")}</Label>
            <Input
              id="payment-paidAt"
              type="date"
              required
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="payment-note">{t("finance.payment.note")}</Label>
            <Input
              id="payment-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <FinanceOfflineNote />
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("staff.cancel")}
            </Button>
            <Button type="submit" disabled={saving || !online}>
              {saving && <Spinner data-icon="inline-start" />}
              {saving ? t("finance.payment.saving") : t("finance.payment.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
