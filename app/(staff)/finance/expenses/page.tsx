"use client";

// Expenses (FR-FIN-4): month picker + list + create/edit/delete.
// admin + accountant; writes online-only (FR-FIN-6).

import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  filsToJodInput,
  FinanceGate,
  FinanceNav,
  FinanceOfflineNote,
  Money,
  parseJodOrNull,
} from "../shared";

const CATEGORY_KEYS = [
  "finance.expenseCat.salaries",
  "finance.expenseCat.rent",
  "finance.expenseCat.supplies",
  "finance.expenseCat.maintenance",
  "finance.expenseCat.catering",
  "finance.expenseCat.other",
] as const;

type Expense = {
  _id: Id<"expenses">;
  date: string;
  category: string;
  amountFils: number;
  note?: string;
};

export default function ExpensesPage() {
  const { t } = useT();
  return (
    <FinanceGate>
      {({ nurseryId }) => (
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-4 md:p-8">
          <header data-print-hidden>
            <h1 className="text-2xl">{t("finance.expenses.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("finance.subtitle")}
            </p>
          </header>
          <FinanceNav />
          <ExpensesView nurseryId={nurseryId} />
        </div>
      )}
    </FinanceGate>
  );
}

function ExpensesView({ nurseryId }: { nurseryId: Id<"nurseries"> }) {
  const { t } = useT();
  const online = useOnline();
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const listQ = useCachedQuery(api.expenses.list, { nurseryId, month });
  const expenses = listQ.data;
  const removeExpense = useMutation(api.expenses.remove);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  async function onDelete(expenseId: Id<"expenses">) {
    try {
      await removeExpense({ nurseryId, expenseId });
      toast.success(t("finance.toast.expenseDeleted"));
    } catch {
      toast.error(t("finance.error.generic"));
    }
  }

  const totalFils = (expenses ?? []).reduce((sum, e) => sum + e.amountFils, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="expenses-month" className="text-muted-foreground">
            {t("finance.expenses.month")}
          </Label>
          <Input
            id="expenses-month"
            type="month"
            dir="ltr"
            className="w-40 tabular-nums"
            value={month}
            onChange={(e) => {
              if (e.target.value !== "") setMonth(e.target.value);
            }}
          />
        </div>
        <Button
          disabled={!online}
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus data-icon="inline-start" />
          {t("finance.expenses.add")}
        </Button>
      </div>
      <FinanceOfflineNote className="-mt-2" />
      <DataAge
        isStale={listQ.isStale}
        updatedAt={listQ.updatedAt}
        className="self-start"
      />

      {expenses === undefined ? (
        <div className="flex justify-center py-12">
          <Spinner className="size-6 text-primary" />
        </div>
      ) : expenses.length === 0 ? (
        <p className="rounded-xl border bg-card py-8 text-center text-sm text-muted-foreground">
          {t("finance.expenses.empty")}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("finance.expenses.table.date")}</TableHead>
                <TableHead>{t("finance.expenses.table.category")}</TableHead>
                <TableHead>{t("finance.expenses.table.amount")}</TableHead>
                <TableHead className="hidden sm:table-cell">
                  {t("finance.expenses.table.note")}
                </TableHead>
                <TableHead className="sr-only">
                  {t("finance.table.actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense) => (
                <TableRow key={expense._id}>
                  <TableCell>
                    <span dir="ltr" className="tabular-nums">
                      {expense.date}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">
                    {expense.category}
                  </TableCell>
                  <TableCell>
                    <Money fils={expense.amountFils} />
                  </TableCell>
                  <TableCell className="hidden max-w-48 truncate text-muted-foreground sm:table-cell">
                    {expense.note ?? ""}
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("finance.expenses.edit")}
                        disabled={!online}
                        onClick={() => {
                          setEditing(expense);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t("finance.expenses.delete")}
                            className="text-destructive hover:text-destructive"
                            disabled={!online}
                          >
                            <Trash2 />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {t("finance.expenses.deleteTitle")}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("finance.expenses.deleteDesc")}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>
                              {t("staff.cancel")}
                            </AlertDialogCancel>
                            <AlertDialogAction
                              variant="destructive"
                              onClick={() => onDelete(expense._id)}
                            >
                              {t("finance.expenses.deleteConfirm")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t bg-muted/40 px-4 py-2 text-sm">
            <span className="text-muted-foreground">
              {t("finance.expenses.total")}
            </span>
            <Money fils={totalFils} className="font-medium" />
          </div>
        </div>
      )}

      <ExpenseFormDialog
        key={`${String(formOpen)}-${editing?._id ?? "new"}`}
        open={formOpen}
        onOpenChange={setFormOpen}
        nurseryId={nurseryId}
        expense={editing}
      />
    </div>
  );
}

function ExpenseFormDialog({
  open,
  onOpenChange,
  nurseryId,
  expense,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nurseryId: Id<"nurseries">;
  expense: Expense | null;
}) {
  const { t } = useT();
  const online = useOnline();
  const createExpense = useMutation(api.expenses.create);
  const updateExpense = useMutation(api.expenses.update);

  const [date, setDate] = useState(expense?.date ?? todayISO());
  const [category, setCategory] = useState(expense?.category ?? "");
  const [amount, setAmount] = useState(
    expense !== null ? filsToJodInput(expense.amountFils) : "",
  );
  const [note, setNote] = useState(expense?.note ?? "");
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
      const common = {
        nurseryId,
        date,
        category: category.trim(),
        amountFils,
        note: note.trim() === "" ? undefined : note.trim(),
      };
      if (expense !== null) {
        await updateExpense({ ...common, expenseId: expense._id });
        toast.success(t("finance.toast.expenseUpdated"));
      } else {
        await createExpense(common);
        toast.success(t("finance.toast.expenseCreated"));
      }
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
          <DialogTitle>
            {expense !== null
              ? t("finance.expenses.form.editTitle")
              : t("finance.expenses.form.newTitle")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("finance.expenses.title")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="expense-date">
                {t("finance.expenses.form.date")}
              </Label>
              <Input
                id="expense-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="expense-amount">
                {t("finance.expenses.form.amount")}
              </Label>
              <Input
                id="expense-amount"
                dir="ltr"
                inputMode="decimal"
                placeholder="12.500"
                required
                className="text-start tabular-nums"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="expense-category">
              {t("finance.expenses.form.category")}
            </Label>
            <Input
              id="expense-category"
              required
              list="expense-categories"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
            <datalist id="expense-categories">
              {CATEGORY_KEYS.map((key) => (
                <option key={key} value={t(key)} />
              ))}
            </datalist>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="expense-note">
              {t("finance.expenses.form.note")}
            </Label>
            <Input
              id="expense-note"
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
              {saving
                ? t("finance.expenses.form.saving")
                : t("finance.expenses.form.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
