"use client";

// Fee plans (FR-FIN-1): CRUD for tuition plans. admin + accountant.
// Deleting a plan referenced by any enrollment fails with plan_in_use.

import { useState } from "react";
import { z } from "zod";
import { useMutation } from "convex/react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { useOnline } from "@/lib/offline/use-online";
import { useAppForm } from "@/lib/form";
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
  errorCode,
  filsToJodInput,
  FinanceGate,
  FinanceNav,
  FinanceOfflineNote,
  Money,
  parseJodOrNull,
} from "../shared";

const CADENCES = ["monthly", "term", "annual", "one_time"] as const;
type Cadence = (typeof CADENCES)[number];

type Plan = {
  _id: Id<"feePlans">;
  name: string;
  amountFils: number;
  cadence: Cadence;
};

export default function PlansPage() {
  const { t } = useT();
  return (
    <FinanceGate>
      {({ nurseryId }) => (
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-4 md:p-8">
          <header data-print-hidden>
            <h1 className="text-2xl">{t("finance.plans.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("finance.subtitle")}
            </p>
          </header>
          <FinanceNav />
          <PlansView nurseryId={nurseryId} />
        </div>
      )}
    </FinanceGate>
  );
}

function PlansView({ nurseryId }: { nurseryId: Id<"nurseries"> }) {
  const { t } = useT();
  const online = useOnline();
  const listQ = useCachedQuery(api.feePlans.list, { nurseryId });
  const plans = listQ.data;
  const removePlan = useMutation(api.feePlans.remove);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);

  async function onDelete(feePlanId: Id<"feePlans">) {
    try {
      await removePlan({ nurseryId, feePlanId });
      toast.success(t("finance.toast.planDeleted"));
    } catch (error) {
      toast.error(
        errorCode(error) === "plan_in_use"
          ? t("finance.error.planInUse")
          : t("finance.error.generic"),
      );
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <DataAge isStale={listQ.isStale} updatedAt={listQ.updatedAt} />
        <Button
          className="ms-auto"
          disabled={!online}
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus data-icon="inline-start" />
          {t("finance.plans.add")}
        </Button>
      </div>
      <FinanceOfflineNote className="-mt-2" />

      {plans === undefined ? (
        <div className="flex justify-center py-12">
          <Spinner className="size-6 text-primary" />
        </div>
      ) : plans.length === 0 ? (
        <p className="rounded-xl border bg-card py-8 text-center text-sm text-muted-foreground">
          {t("finance.plans.empty")}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("finance.plans.table.name")}</TableHead>
                <TableHead>{t("finance.plans.table.amount")}</TableHead>
                <TableHead>{t("finance.plans.table.cadence")}</TableHead>
                <TableHead className="sr-only">
                  {t("finance.table.actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan._id}>
                  <TableCell className="font-medium">{plan.name}</TableCell>
                  <TableCell>
                    <Money fils={plan.amountFils} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {t(`finance.cadence.${plan.cadence}`)}
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("finance.plans.edit")}
                        disabled={!online}
                        onClick={() => {
                          setEditing(plan);
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
                            aria-label={t("finance.plans.delete")}
                            className="text-destructive hover:text-destructive"
                            disabled={!online}
                          >
                            <Trash2 />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {t("finance.plans.deleteTitle")}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("finance.plans.deleteDesc")}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>
                              {t("staff.cancel")}
                            </AlertDialogCancel>
                            <AlertDialogAction
                              variant="destructive"
                              onClick={() => onDelete(plan._id)}
                            >
                              {t("finance.plans.deleteConfirm")}
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
        </div>
      )}

      <PlanFormDialog
        key={`${String(formOpen)}-${editing?._id ?? "new"}`}
        open={formOpen}
        onOpenChange={setFormOpen}
        nurseryId={nurseryId}
        plan={editing}
      />
    </div>
  );
}

function PlanFormDialog({
  open,
  onOpenChange,
  nurseryId,
  plan,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nurseryId: Id<"nurseries">;
  plan: Plan | null;
}) {
  const { t } = useT();
  const online = useOnline();
  const createPlan = useMutation(api.feePlans.create);
  const updatePlan = useMutation(api.feePlans.update);

  const schema = z.object({
    name: z.string(),
    amount: z.string().refine((v) => parseJodOrNull(v) !== null, {
      message: t("finance.error.invalidAmount"),
    }),
    cadence: z.enum(CADENCES),
  });

  const form = useAppForm({
    defaultValues: {
      name: plan?.name ?? "",
      amount: plan !== null ? filsToJodInput(plan.amountFils) : "",
      cadence: plan?.cadence ?? "monthly",
    },
    validators: { onChange: schema },
    onSubmit: async ({ value }) => {
      const amountFils = parseJodOrNull(value.amount);
      if (amountFils === null) return;
      try {
        if (plan !== null) {
          await updatePlan({
            nurseryId,
            feePlanId: plan._id,
            name: value.name.trim(),
            amountFils,
            cadence: value.cadence,
          });
          toast.success(t("finance.toast.planUpdated"));
        } else {
          await createPlan({
            nurseryId,
            name: value.name.trim(),
            amountFils,
            cadence: value.cadence,
          });
          toast.success(t("finance.toast.planCreated"));
        }
        onOpenChange(false);
      } catch {
        toast.error(t("finance.error.generic"));
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {plan !== null
              ? t("finance.plans.form.editTitle")
              : t("finance.plans.form.newTitle")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("finance.plans.title")}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
          className="flex flex-col gap-4"
        >
          <form.AppField name="name">
            {(field) => (
              <field.TextField
                id="plan-name"
                required
                label={t("finance.plans.form.name")}
                placeholder={t("finance.plans.form.namePlaceholder")}
              />
            )}
          </form.AppField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <form.AppField name="amount">
              {(field) => (
                <field.TextField
                  id="plan-amount"
                  dir="ltr"
                  inputMode="decimal"
                  placeholder="85.000"
                  required
                  className="text-start tabular-nums"
                  label={t("finance.plans.form.amount")}
                />
              )}
            </form.AppField>
            <form.AppField name="cadence">
              {(field) => (
                <field.SelectField
                  label={t("finance.plans.form.cadence")}
                  ariaLabel={t("finance.plans.form.cadence")}
                  options={CADENCES.map((c) => ({
                    value: c,
                    label: t(`finance.cadence.${c}`),
                  }))}
                />
              )}
            </form.AppField>
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
            <form.AppForm>
              <form.SubmitButton disabled={!online}>
                {t("finance.plans.form.save")}
              </form.SubmitButton>
            </form.AppForm>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
