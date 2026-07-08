"use client";

// Shared building blocks for the finance area (money desk): role gate,
// section nav, status badges, JOD input helpers and the write dialogs that
// are reachable from more than one page. All money values are INTEGER FILS —
// JOD only ever exists as text in inputs (parseJodToFils on submit).

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMutation } from "convex/react";
import { FilePlus2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatFils, parseJodToFils, todayISO } from "@/convex/lib/shared";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { useOnline } from "@/lib/offline/use-online";
import { useT, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { formatCount } from "@/app/(staff)/students/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { Spinner } from "@/components/ui/spinner";

export type FinanceRole = "admin" | "accountant";

export { errorCode } from "@/lib/utils";

/**
 * Wrap an LTR fragment (dates, periods like "2026-07") in FSI…PDI isolates
 * so it doesn't get bidi-reordered inside Arabic sentences.
 */
export function ltr(s: string): string {
  return `\u2066${s}\u2069`; // LRI ... PDI
}

/** Bidi-isolate every "YYYY-MM"/"YYYY-MM-DD"-shaped run inside mixed text. */
export function isolateDates(s: string): string {
  return s.replace(/\d{4}-\d{2}(-\d{2})?/g, (m) => ltr(m));
}

/** Integer fils → editable JOD text ("85000" fils → "85.000"). */
export function filsToJodInput(fils: number): string {
  return (fils / 1000).toFixed(3);
}

/** Lenient user input → integer fils, or null when unparseable/non-positive. */
export function parseJodOrNull(input: string): number | null {
  try {
    const fils = parseJodToFils(input);
    return fils > 0 ? fils : null;
  } catch {
    return null;
  }
}

/** "متأخرة ١٢ يوماً" — Arabic-plural days-late label. */
export function daysLateLabel(
  days: number,
  t: (key: string) => string,
  locale: Locale,
): string {
  return formatCount(days, "finance.daysLate", t, locale);
}

// ---------------------------------------------------------------------------
// Role gate — teachers (or anyone non-finance) get the /staff-style card.
// Server functions deny them anyway; this is the friendly layer.
// ---------------------------------------------------------------------------

export function FinanceGate({
  children,
}: {
  children: (ctx: {
    nurseryId: Id<"nurseries">;
    role: FinanceRole;
    yearId: string;
    nurseryName: string;
  }) => ReactNode;
}) {
  const { t } = useT();
  const mine = useCachedQuery(api.nurseries.getMine, {});

  if (mine.data === undefined) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center">
        <Spinner className="size-6 text-primary" />
      </div>
    );
  }
  if (
    mine.data === null ||
    (mine.data.role !== "admin" && mine.data.role !== "accountant")
  ) {
    return (
      <div className="mx-auto w-full max-w-4xl p-4 md:p-8">
        <Alert>
          <ShieldAlert />
          <AlertTitle>{t("finance.gate.title")}</AlertTitle>
          <AlertDescription>{t("finance.gate.desc")}</AlertDescription>
        </Alert>
      </div>
    );
  }
  return (
    <>
      {children({
        nurseryId: mine.data.nursery._id,
        role: mine.data.role,
        yearId: mine.data.nursery.activeYear.yearId,
        nurseryName: mine.data.nursery.name,
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Section nav — overview / invoices / expenses / plans.
// ---------------------------------------------------------------------------

const SECTIONS = [
  { href: "/finance", key: "finance.nav.overview" },
  { href: "/finance/invoices", key: "finance.nav.invoices" },
  { href: "/finance/expenses", key: "finance.nav.expenses" },
  { href: "/finance/plans", key: "finance.nav.plans" },
] as const;

export function FinanceNav() {
  const { t } = useT();
  const pathname = usePathname();
  return (
    <nav
      data-print-hidden
      className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1"
    >
      {SECTIONS.map(({ href, key }) => {
        const active =
          href === "/finance" ? pathname === "/finance" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors",
              active
                ? "bg-background font-medium text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// FR-FIN-6 — visible message next to disabled finance write controls.
// ---------------------------------------------------------------------------

export function FinanceOfflineNote({ className }: { className?: string }) {
  const { t } = useT();
  const online = useOnline();
  if (online) return null;
  return (
    <p
      data-testid="finance-offline"
      className={cn("text-xs text-muted-foreground", className)}
    >
      {t("finance.offline")}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Invoice status badge — status/soft tokens from the attendance palette.
// ---------------------------------------------------------------------------

const STATUS_CLASSES: Record<string, string> = {
  overdue: "border-absent/40 bg-absent-soft text-foreground",
  paid: "border-present/40 bg-present-soft text-foreground",
  partial: "border-late/40 bg-late-soft text-foreground",
};

export function InvoiceStatusBadge({ status }: { status: string }) {
  const { t } = useT();
  const custom = STATUS_CLASSES[status];
  if (custom !== undefined) {
    return (
      <Badge variant="outline" className={custom}>
        {t(`finance.status.${status}`)}
      </Badge>
    );
  }
  if (status === "void") {
    return (
      <Badge variant="outline" className="text-muted-foreground line-through">
        {t("finance.status.void")}
      </Badge>
    );
  }
  // issued / draft
  return (
    <Badge variant={status === "draft" ? "outline" : "secondary"}>
      {t(`finance.status.${status}`)}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// "إصدار فواتير الشهر" — bulk generate for the current Asia/Amman month.
// ---------------------------------------------------------------------------

export function GenerateMonthButton({
  nurseryId,
  variant = "outline",
}: {
  nurseryId: Id<"nurseries">;
  variant?: "outline" | "secondary" | "default";
}) {
  const { t, locale } = useT();
  const online = useOnline();
  const generate = useMutation(api.invoices.generateForPeriod);
  const [running, setRunning] = useState(false);

  async function onGenerate() {
    setRunning(true);
    try {
      const period = todayISO().slice(0, 7); // "YYYY-MM"
      const { created } = await generate({ nurseryId, period });
      toast.success(formatCount(created, "finance.generated", t, locale));
    } catch {
      toast.error(t("finance.error.generic"));
    } finally {
      setRunning(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      disabled={!online || running}
      onClick={onGenerate}
    >
      {running ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <FilePlus2 data-icon="inline-start" />
      )}
      {running ? t("finance.actions.generating") : t("finance.actions.generate")}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Manual invoice dialog (FR-FIN-2) — student select, JOD amount, due date.
// ---------------------------------------------------------------------------

export function ManualInvoiceDialog({
  open,
  onOpenChange,
  nurseryId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nurseryId: Id<"nurseries">;
}) {
  const { t } = useT();
  const online = useOnline();
  const students = useCachedQuery(
    api.students.list,
    open ? { nurseryId, status: "active" as const } : "skip",
  ).data;
  const createManual = useMutation(api.invoices.createManual);

  const [studentId, setStudentId] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(todayISO());
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setStudentId("");
    setAmount("");
    setDueDate(todayISO());
    setDescription("");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (studentId === "") {
      toast.error(t("finance.error.selectStudent"));
      return;
    }
    const amountFils = parseJodOrNull(amount);
    if (amountFils === null) {
      toast.error(t("finance.error.invalidAmount"));
      return;
    }
    setSaving(true);
    try {
      await createManual({
        nurseryId,
        studentId: studentId as Id<"students">,
        amountFils,
        dueDate,
        description:
          description.trim() === "" ? undefined : description.trim(),
      });
      toast.success(t("finance.toast.invoiceCreated"));
      reset();
      onOpenChange(false);
    } catch {
      toast.error(t("finance.error.generic"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("finance.newInvoice.title")}</DialogTitle>
          <DialogDescription>{t("finance.newInvoice.desc")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>{t("finance.newInvoice.student")}</Label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger
                className="w-full"
                aria-label={t("finance.newInvoice.student")}
              >
                <SelectValue
                  placeholder={t("finance.newInvoice.selectStudent")}
                />
              </SelectTrigger>
              <SelectContent>
                {students?.map((student) => (
                  <SelectItem key={student._id} value={student._id}>
                    {student.nameAr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="invoice-amount">
                {t("finance.newInvoice.amount")}
              </Label>
              <Input
                id="invoice-amount"
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
              <Label htmlFor="invoice-dueDate">
                {t("finance.newInvoice.dueDate")}
              </Label>
              <Input
                id="invoice-dueDate"
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="invoice-description">
              {t("finance.newInvoice.description")}
            </Label>
            <Input
              id="invoice-description"
              placeholder={t("finance.newInvoice.descriptionPlaceholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
              {saving
                ? t("finance.newInvoice.creating")
                : t("finance.newInvoice.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Money cell — LTR tabular fils rendering, shared by tables.
// ---------------------------------------------------------------------------

export function Money({
  fils,
  className,
}: {
  fils: number;
  className?: string;
}) {
  const { locale } = useT();
  // en amounts ("JOD 12.500") need an LTR run inside RTL text; Arabic
  // amounts are native RTL and must not be forced.
  return (
    <span
      dir={locale === "en" ? "ltr" : undefined}
      className={cn("whitespace-nowrap tabular-nums", className)}
    >
      {formatFils(fils, locale)}
    </span>
  );
}
