// Shared finance domain logic (FR-FIN-1..6). Money is ALWAYS integer fils
// (JOD × 1000) — never floats. Dates are ALWAYS "YYYY-MM-DD" strings.
//
// This module is shared by the public mutations (convex/invoices.ts,
// convex/payments.ts), the cron entry points (convex/financeCron.ts) and the
// concierge seed helpers (convex/admin.ts) so generation + status logic has
// exactly one implementation.

import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { emitNotifications, type NotificationEvent } from "./notify";
import { todayISO } from "./shared";

export type StoredInvoiceStatus = Doc<"invoices">["status"];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Fils amounts must be positive integers (§3). */
export function assertFils(amountFils: number): void {
  if (!Number.isInteger(amountFils) || amountFils <= 0) {
    throw new ConvexError("invalid_amount");
  }
}

export function assertDateISO(date: string): void {
  if (!DATE_RE.test(date)) {
    throw new ConvexError("invalid_date");
  }
}

export function assertMonthISO(period: string): void {
  if (!MONTH_RE.test(period)) {
    throw new ConvexError("invalid_period");
  }
}

/** ISO date `days` days after the given ISO date (UTC arithmetic). */
export function addDaysISO(dateISO: string, days: number): string {
  const t = new Date(`${dateISO}T00:00:00Z`).getTime();
  return new Date(t + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Whole days between two ISO dates (later − earlier). */
export function daysBetweenISO(earlier: string, later: string): number {
  const a = new Date(`${earlier}T00:00:00Z`).getTime();
  const b = new Date(`${later}T00:00:00Z`).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

/** Exclusive upper bound for a "YYYY-MM" month range on date strings. */
export function nextMonthISO(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 12
    ? `${y + 1}-01-01`
    : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

/**
 * Derived status (NEVER stored): issued/partial with dueDate strictly before
 * today → "overdue"; everything else passes through.
 */
export function computeInvoiceStatus(
  stored: StoredInvoiceStatus,
  dueDate: string,
  today: string,
): StoredInvoiceStatus {
  if ((stored === "issued" || stored === "partial") && dueDate < today) {
    return "overdue";
  }
  return stored;
}

/** Sum of recorded payments on an invoice. Ceiling: 500 payments/invoice. */
export async function invoicePaidFils(
  ctx: QueryCtx,
  invoiceId: Id<"invoices">,
): Promise<number> {
  const payments = await ctx.db
    .query("payments")
    .withIndex("by_invoiceId", (q) => q.eq("invoiceId", invoiceId))
    .take(500);
  return payments.reduce((sum, p) => sum + p.amountFils, 0);
}

/**
 * Recompute a payable invoice's stored status from its payments.
 * Only touches issued/partial/paid — draft/void are never auto-transitioned.
 */
export async function recomputeInvoiceStatus(
  ctx: MutationCtx,
  invoice: Doc<"invoices">,
): Promise<StoredInvoiceStatus> {
  if (
    invoice.status !== "issued" &&
    invoice.status !== "partial" &&
    invoice.status !== "paid"
  ) {
    return invoice.status;
  }
  const paidFils = await invoicePaidFils(ctx, invoice._id);
  const next: StoredInvoiceStatus =
    paidFils >= invoice.amountFils
      ? "paid"
      : paidFils > 0
        ? "partial"
        : "issued";
  if (next !== invoice.status) {
    await ctx.db.patch("invoices", invoice._id, { status: next });
  }
  return next;
}

/** Idempotency key per (enrollment, plan cadence) — see schema comment. */
function planPeriodKey(
  cadence: Doc<"feePlans">["cadence"],
  period: string,
  yearId: string,
): string {
  switch (cadence) {
    case "monthly":
      return period;
    case "term":
    case "annual":
      return yearId;
    case "one_time":
      return `${yearId}-once`;
  }
}

/**
 * FR-FIN-2: generate plan invoices for one nursery + "YYYY-MM" period.
 * Idempotent: an existing invoice with the same (student, plan, period key)
 * — whatever its status — blocks regeneration. Emits one "invoice_issued"
 * notification per created invoice.
 *
 * Ceilings (comment per guidelines): ≤ 2000 active-year enrollments and
 * ≤ 200 invoices per student per read — nursery scale is ~10² students, so
 * both are an order of magnitude of headroom inside the 16K read limit.
 */
export async function generateInvoicesForNursery(
  ctx: MutationCtx,
  nursery: Doc<"nurseries">,
  period: string,
): Promise<{ created: number; skipped: number }> {
  assertMonthISO(period);
  const yearId = nursery.activeYear.yearId;
  const enrollments = await ctx.db
    .query("enrollments")
    .withIndex("by_nursery_and_classroomId_and_yearId", (q) =>
      q.eq("nurseryId", nursery._id),
    )
    .take(2000);

  let created = 0;
  let skipped = 0;
  const events: NotificationEvent[] = [];
  const today = todayISO();

  for (const enrollment of enrollments) {
    if (enrollment.yearId !== yearId || enrollment.feePlanId === undefined) {
      continue;
    }
    const plan = await ctx.db.get("feePlans", enrollment.feePlanId);
    if (plan === null) continue;
    const student = await ctx.db.get("students", enrollment.studentId);
    if (student === null || student.status !== "active") continue;

    const periodKey = planPeriodKey(plan.cadence, period, yearId);
    const existing = await ctx.db
      .query("invoices")
      .withIndex("by_nursery_and_studentId", (q) =>
        q.eq("nurseryId", nursery._id).eq("studentId", enrollment.studentId),
      )
      .take(200);
    if (
      existing.some(
        (i) => i.feePlanId === plan._id && i.period === periodKey,
      )
    ) {
      skipped += 1;
      continue;
    }

    const dueDate =
      plan.cadence === "monthly" ? `${period}-10` : addDaysISO(today, 14);
    const invoiceId = await ctx.db.insert("invoices", {
      nurseryId: nursery._id,
      studentId: enrollment.studentId,
      feePlanId: plan._id,
      amountFils: plan.amountFils,
      dueDate,
      period: periodKey,
      status: "issued",
    });
    created += 1;
    // FR-NOT-3: ids only in payloads — no names or amounts.
    events.push({
      studentId: enrollment.studentId,
      type: "invoice_issued",
      payload: { invoiceId },
    });
  }

  await emitNotifications(ctx, nursery._id, events);
  return { created, skipped };
}

/**
 * FR-NOT-2 daily sweep for one nursery: stored issued/partial invoices past
 * due and never notified before get ONE "invoice_overdue" notification, then
 * overdueNotifiedAt is stamped so they are never notified again.
 * Ceiling: ≤ 1000 open invoices per status per nursery.
 */
export async function sweepOverdueForNursery(
  ctx: MutationCtx,
  nurseryId: Id<"nurseries">,
): Promise<number> {
  const today = todayISO();
  const events: NotificationEvent[] = [];
  for (const status of ["issued", "partial"] as const) {
    const rows = await ctx.db
      .query("invoices")
      .withIndex("by_nurseryId_and_status", (q) =>
        q.eq("nurseryId", nurseryId).eq("status", status),
      )
      .take(1000);
    for (const invoice of rows) {
      if (invoice.dueDate >= today || invoice.overdueNotifiedAt !== undefined) {
        continue;
      }
      await ctx.db.patch("invoices", invoice._id, {
        overdueNotifiedAt: Date.now(),
      });
      events.push({
        studentId: invoice.studentId,
        type: "invoice_overdue",
        payload: { invoiceId: invoice._id },
      });
    }
  }
  await emitNotifications(ctx, nurseryId, events);
  return events.length;
}
