import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { invoiceStatusValidator, paymentMethodValidator } from "./schema";
import { requireStaff } from "./lib/guard";
import { emitNotifications } from "./lib/notify";
import { todayISO } from "./lib/shared";
import {
  assertDateISO,
  assertFils,
  computeInvoiceStatus,
  generateInvoicesForNursery,
  invoicePaidFils,
} from "./lib/finance";

// Invoices (FR-FIN-2). All reads/writes admin + accountant only (PRD §6 —
// teachers see NOTHING financial). Stored status is one of
// draft/issued/partial/paid/void; "overdue" is ALWAYS derived, never stored.

const filterValidator = v.union(
  v.literal("open"),
  v.literal("overdue"),
  v.literal("paid"),
  v.literal("draft"),
  v.literal("void"),
  v.literal("all"),
);

const listItemShape = v.object({
  _id: v.id("invoices"),
  _creationTime: v.number(),
  studentId: v.id("students"),
  feePlanId: v.optional(v.id("feePlans")),
  amountFils: v.number(),
  paidFils: v.number(),
  dueDate: v.string(),
  period: v.optional(v.string()),
  description: v.optional(v.string()),
  status: invoiceStatusValidator,
  computedStatus: invoiceStatusValidator,
  studentNameAr: v.string(),
  planName: v.optional(v.string()),
});

const invoiceDocShape = v.object({
  _id: v.id("invoices"),
  _creationTime: v.number(),
  nurseryId: v.id("nurseries"),
  studentId: v.id("students"),
  feePlanId: v.optional(v.id("feePlans")),
  amountFils: v.number(),
  dueDate: v.string(),
  period: v.optional(v.string()),
  description: v.optional(v.string()),
  status: invoiceStatusValidator,
  overdueNotifiedAt: v.optional(v.number()),
});

async function enrichInvoices(
  ctx: Parameters<typeof invoicePaidFils>[0],
  invoices: Doc<"invoices">[],
) {
  const today = todayISO();
  const studentNames = new Map<Id<"students">, string>();
  const planNames = new Map<Id<"feePlans">, string>();
  const result = [];
  for (const invoice of invoices) {
    if (!studentNames.has(invoice.studentId)) {
      const student = await ctx.db.get("students", invoice.studentId);
      studentNames.set(invoice.studentId, student?.nameAr ?? "");
    }
    let planName: string | undefined;
    if (invoice.feePlanId !== undefined) {
      if (!planNames.has(invoice.feePlanId)) {
        const plan = await ctx.db.get("feePlans", invoice.feePlanId);
        planNames.set(invoice.feePlanId, plan?.name ?? "");
      }
      planName = planNames.get(invoice.feePlanId);
    }
    const paidFils = await invoicePaidFils(ctx, invoice._id);
    result.push({
      _id: invoice._id,
      _creationTime: invoice._creationTime,
      studentId: invoice.studentId,
      ...(invoice.feePlanId !== undefined
        ? { feePlanId: invoice.feePlanId }
        : {}),
      amountFils: invoice.amountFils,
      paidFils,
      dueDate: invoice.dueDate,
      ...(invoice.period !== undefined ? { period: invoice.period } : {}),
      ...(invoice.description !== undefined
        ? { description: invoice.description }
        : {}),
      status: invoice.status,
      computedStatus: computeInvoiceStatus(
        invoice.status,
        invoice.dueDate,
        today,
      ),
      studentNameAr: studentNames.get(invoice.studentId) ?? "",
      ...(planName !== undefined && planName !== ""
        ? { planName }
        : {}),
    });
  }
  return result;
}

export const list = query({
  args: {
    nurseryId: v.id("nurseries"),
    filter: filterValidator,
    studentId: v.optional(v.id("students")),
  },
  returns: v.array(listItemShape),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId, ["admin", "accountant"]);
    const today = todayISO();
    const { filter } = args;

    let rows: Doc<"invoices">[];
    if (args.studentId !== undefined) {
      const studentId = args.studentId;
      rows = await ctx.db
        .query("invoices")
        .withIndex("by_nursery_and_studentId", (q) =>
          q.eq("nurseryId", args.nurseryId).eq("studentId", studentId),
        )
        .order("desc")
        .take(200);
    } else if (filter === "all") {
      rows = await ctx.db
        .query("invoices")
        .withIndex("by_nurseryId", (q) => q.eq("nurseryId", args.nurseryId))
        .order("desc")
        .take(200);
    } else if (filter === "open" || filter === "overdue") {
      // Open = stored issued|partial. Overdue is the past-due subset.
      const parts: Doc<"invoices">[] = [];
      for (const status of ["issued", "partial"] as const) {
        parts.push(
          ...(await ctx.db
            .query("invoices")
            .withIndex("by_nurseryId_and_status", (q) =>
              q.eq("nurseryId", args.nurseryId).eq("status", status),
            )
            .order("desc")
            .take(200)),
        );
      }
      rows = parts
        .sort((a, b) => b._creationTime - a._creationTime)
        .slice(0, 200);
    } else {
      rows = await ctx.db
        .query("invoices")
        .withIndex("by_nurseryId_and_status", (q) =>
          q.eq("nurseryId", args.nurseryId).eq("status", filter),
        )
        .order("desc")
        .take(200);
    }

    // Post-filter by DERIVED status when needed.
    if (filter === "overdue") {
      rows = rows.filter(
        (i) =>
          computeInvoiceStatus(i.status, i.dueDate, today) === "overdue",
      );
    } else if (args.studentId !== undefined && filter !== "all") {
      rows = rows.filter((i) => {
        const computed = computeInvoiceStatus(i.status, i.dueDate, today);
        if (filter === "open") {
          return i.status === "issued" || i.status === "partial";
        }
        return computed === filter;
      });
    }

    return await enrichInvoices(ctx, rows);
  },
});

export const get = query({
  args: {
    nurseryId: v.id("nurseries"),
    invoiceId: v.id("invoices"),
  },
  returns: v.object({
    invoice: invoiceDocShape,
    computedStatus: invoiceStatusValidator,
    paidFils: v.number(),
    payments: v.array(
      v.object({
        _id: v.id("payments"),
        _creationTime: v.number(),
        amountFils: v.number(),
        method: paymentMethodValidator,
        paidAt: v.string(),
        note: v.optional(v.string()),
        receiverName: v.string(),
      }),
    ),
    student: v.object({ _id: v.id("students"), nameAr: v.string() }),
    plan: v.optional(
      v.object({
        _id: v.id("feePlans"),
        name: v.string(),
        amountFils: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId, ["admin", "accountant"]);
    const invoice = await ctx.db.get("invoices", args.invoiceId);
    if (invoice === null || invoice.nurseryId !== args.nurseryId) {
      throw new ConvexError("not_found");
    }
    const student = await ctx.db.get("students", invoice.studentId);
    if (student === null) {
      throw new ConvexError("not_found");
    }
    const plan =
      invoice.feePlanId !== undefined
        ? await ctx.db.get("feePlans", invoice.feePlanId)
        : null;

    const paymentRows = await ctx.db
      .query("payments")
      .withIndex("by_invoiceId", (q) => q.eq("invoiceId", invoice._id))
      .take(500);
    let paidFils = 0;
    const payments = [];
    for (const p of paymentRows) {
      paidFils += p.amountFils;
      const receiver = await ctx.db.get("users", p.receivedBy);
      payments.push({
        _id: p._id,
        _creationTime: p._creationTime,
        amountFils: p.amountFils,
        method: p.method,
        paidAt: p.paidAt,
        ...(p.note !== undefined ? { note: p.note } : {}),
        receiverName: receiver?.name ?? "",
      });
    }

    return {
      invoice: {
        _id: invoice._id,
        _creationTime: invoice._creationTime,
        nurseryId: invoice.nurseryId,
        studentId: invoice.studentId,
        ...(invoice.feePlanId !== undefined
          ? { feePlanId: invoice.feePlanId }
          : {}),
        amountFils: invoice.amountFils,
        dueDate: invoice.dueDate,
        ...(invoice.period !== undefined ? { period: invoice.period } : {}),
        ...(invoice.description !== undefined
          ? { description: invoice.description }
          : {}),
        status: invoice.status,
        ...(invoice.overdueNotifiedAt !== undefined
          ? { overdueNotifiedAt: invoice.overdueNotifiedAt }
          : {}),
      },
      computedStatus: computeInvoiceStatus(
        invoice.status,
        invoice.dueDate,
        todayISO(),
      ),
      paidFils,
      payments,
      student: { _id: student._id, nameAr: student.nameAr },
      ...(plan !== null
        ? {
            plan: {
              _id: plan._id,
              name: plan.name,
              amountFils: plan.amountFils,
            },
          }
        : {}),
    };
  },
});

export const createManual = mutation({
  args: {
    nurseryId: v.id("nurseries"),
    studentId: v.id("students"),
    amountFils: v.number(),
    dueDate: v.string(), // "YYYY-MM-DD"
    description: v.optional(v.string()),
  },
  returns: v.id("invoices"),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId, ["admin", "accountant"]);
    assertFils(args.amountFils);
    assertDateISO(args.dueDate);
    const student = await ctx.db.get("students", args.studentId);
    if (student === null || student.nurseryId !== args.nurseryId) {
      throw new ConvexError("forbidden");
    }
    const invoiceId = await ctx.db.insert("invoices", {
      nurseryId: args.nurseryId,
      studentId: args.studentId,
      amountFils: args.amountFils,
      dueDate: args.dueDate,
      description: args.description,
      status: "issued",
    });
    await emitNotifications(ctx, args.nurseryId, [
      // FR-NOT-3: ids only — no names or amounts.
      { studentId: args.studentId, type: "invoice_issued", payload: { invoiceId } },
    ]);
    return invoiceId;
  },
});

/**
 * FR-FIN-2 bulk issue for one "YYYY-MM" period. Idempotent — rerunning for
 * the same period creates nothing new (see lib/finance.ts).
 */
export const generateForPeriod = mutation({
  args: {
    nurseryId: v.id("nurseries"),
    period: v.string(), // "YYYY-MM"
  },
  returns: v.object({ created: v.number(), skipped: v.number() }),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId, ["admin", "accountant"]);
    const nursery = await ctx.db.get("nurseries", args.nurseryId);
    if (nursery === null) {
      throw new ConvexError("not_found");
    }
    return await generateInvoicesForNursery(ctx, nursery, args.period);
  },
});

export const voidInvoice = mutation({
  args: {
    nurseryId: v.id("nurseries"),
    invoiceId: v.id("invoices"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId, ["admin", "accountant"]);
    const invoice = await ctx.db.get("invoices", args.invoiceId);
    if (invoice === null || invoice.nurseryId !== args.nurseryId) {
      throw new ConvexError("forbidden");
    }
    const payment = await ctx.db
      .query("payments")
      .withIndex("by_invoiceId", (q) => q.eq("invoiceId", invoice._id))
      .first();
    if (payment !== null) {
      throw new ConvexError("has_payments");
    }
    if (invoice.status !== "void") {
      await ctx.db.patch("invoices", invoice._id, { status: "void" });
    }
    return null;
  },
});
