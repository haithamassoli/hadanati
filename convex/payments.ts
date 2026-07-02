import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { invoiceStatusValidator, paymentMethodValidator } from "./schema";
import { requireStaff } from "./lib/guard";
import {
  assertDateISO,
  assertFils,
  invoicePaidFils,
  recomputeInvoiceStatus,
} from "./lib/finance";

// Payments (FR-FIN-2/3). create = admin + accountant; remove = ADMIN only.
// Every write recomputes the invoice's stored status (issued/partial/paid).

export const create = mutation({
  args: {
    nurseryId: v.id("nurseries"),
    invoiceId: v.id("invoices"),
    amountFils: v.number(),
    method: paymentMethodValidator,
    paidAt: v.string(), // "YYYY-MM-DD"
    note: v.optional(v.string()),
  },
  returns: v.id("payments"),
  handler: async (ctx, args) => {
    const { user } = await requireStaff(ctx, args.nurseryId, [
      "admin",
      "accountant",
    ]);
    assertFils(args.amountFils);
    assertDateISO(args.paidAt);
    const invoice = await ctx.db.get("invoices", args.invoiceId);
    if (invoice === null || invoice.nurseryId !== args.nurseryId) {
      throw new ConvexError("forbidden");
    }
    if (invoice.status === "draft" || invoice.status === "void") {
      throw new ConvexError("not_payable");
    }
    const paidFils = await invoicePaidFils(ctx, invoice._id);
    const remainingFils = invoice.amountFils - paidFils;
    if (args.amountFils > remainingFils) {
      throw new ConvexError("exceeds_balance");
    }
    const paymentId = await ctx.db.insert("payments", {
      nurseryId: args.nurseryId,
      invoiceId: args.invoiceId,
      amountFils: args.amountFils,
      method: args.method,
      paidAt: args.paidAt,
      receivedBy: user._id,
      note: args.note,
    });
    await recomputeInvoiceStatus(ctx, invoice);
    return paymentId;
  },
});

/** Receipt data (FR-FIN-3): payment + invoice + student + names for print. */
export const get = query({
  args: {
    nurseryId: v.id("nurseries"),
    paymentId: v.id("payments"),
  },
  returns: v.object({
    payment: v.object({
      _id: v.id("payments"),
      _creationTime: v.number(),
      amountFils: v.number(),
      method: paymentMethodValidator,
      paidAt: v.string(),
      note: v.optional(v.string()),
    }),
    invoice: v.object({
      _id: v.id("invoices"),
      amountFils: v.number(),
      paidFils: v.number(),
      dueDate: v.string(),
      period: v.optional(v.string()),
      description: v.optional(v.string()),
      status: invoiceStatusValidator,
    }),
    student: v.object({ _id: v.id("students"), nameAr: v.string() }),
    nurseryName: v.string(),
    receiverName: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId, ["admin", "accountant"]);
    const payment = await ctx.db.get("payments", args.paymentId);
    if (payment === null || payment.nurseryId !== args.nurseryId) {
      throw new ConvexError("not_found");
    }
    const invoice = await ctx.db.get("invoices", payment.invoiceId);
    if (invoice === null) {
      throw new ConvexError("not_found");
    }
    const student = await ctx.db.get("students", invoice.studentId);
    const nursery = await ctx.db.get("nurseries", args.nurseryId);
    const receiver = await ctx.db.get("users", payment.receivedBy);
    if (student === null || nursery === null) {
      throw new ConvexError("not_found");
    }
    const paidFils = await invoicePaidFils(ctx, invoice._id);
    return {
      payment: {
        _id: payment._id,
        _creationTime: payment._creationTime,
        amountFils: payment.amountFils,
        method: payment.method,
        paidAt: payment.paidAt,
        ...(payment.note !== undefined ? { note: payment.note } : {}),
      },
      invoice: {
        _id: invoice._id,
        amountFils: invoice.amountFils,
        paidFils,
        dueDate: invoice.dueDate,
        ...(invoice.period !== undefined ? { period: invoice.period } : {}),
        ...(invoice.description !== undefined
          ? { description: invoice.description }
          : {}),
        status: invoice.status,
      },
      student: { _id: student._id, nameAr: student.nameAr },
      nurseryName: nursery.name,
      receiverName: receiver?.name ?? "",
    };
  },
});

/** Delete a mistaken payment. ADMIN only (accountants cannot). */
export const remove = mutation({
  args: {
    nurseryId: v.id("nurseries"),
    paymentId: v.id("payments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId, ["admin"]);
    const payment = await ctx.db.get("payments", args.paymentId);
    if (payment === null || payment.nurseryId !== args.nurseryId) {
      throw new ConvexError("forbidden");
    }
    const invoice = await ctx.db.get("invoices", payment.invoiceId);
    await ctx.db.delete("payments", args.paymentId);
    if (invoice !== null) {
      await recomputeInvoiceStatus(ctx, invoice);
    }
    return null;
  },
});
