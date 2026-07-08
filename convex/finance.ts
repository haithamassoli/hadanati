import { ConvexError, v } from "convex/values";
import { query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { paymentMethodValidator } from "./schema";
import { requireStaff } from "./lib/guard";
import { todayISO } from "./lib/shared";
import { daysBetweenISO, invoicePaidFils, nextMonthISO } from "./lib/finance";

// Finance dashboard + statement (FR-FIN-5). admin + accountant only.

export const overview = query({
  args: { nurseryId: v.id("nurseries") },
  returns: v.object({
    collectedMTDFils: v.number(),
    outstandingFils: v.number(),
    expensesMTDFils: v.number(),
    overdueList: v.array(
      v.object({
        invoiceId: v.id("invoices"),
        studentId: v.id("students"),
        studentNameAr: v.string(),
        amountFils: v.number(),
        paidFils: v.number(),
        dueDate: v.string(),
        daysLate: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId, ["admin", "accountant"]);
    const today = todayISO();
    const month = today.slice(0, 7);

    // Collected this month (Asia/Amman calendar month, by paidAt).
    // Ceiling: ≤ 2000 payments/month/nursery — ~20× nursery scale.
    const monthPayments = await ctx.db
      .query("payments")
      .withIndex("by_nurseryId_and_paidAt", (q) =>
        q
          .eq("nurseryId", args.nurseryId)
          .gte("paidAt", `${month}-01`)
          .lt("paidAt", nextMonthISO(month)),
      )
      .take(2000);
    const collectedMTDFils = monthPayments.reduce(
      (sum, p) => sum + p.amountFils,
      0,
    );

    // Outstanding = remaining over ALL stored issued/partial invoices
    // (overdue is a derived subset of these). Ceiling: ≤ 1000 per status.
    let outstandingFils = 0;
    const overdue: Array<{
      invoiceId: Doc<"invoices">["_id"];
      studentId: Doc<"invoices">["studentId"];
      studentNameAr: string;
      amountFils: number;
      paidFils: number;
      dueDate: string;
      daysLate: number;
    }> = [];
    const studentNames = new Map<Doc<"invoices">["studentId"], string>();
    for (const status of ["issued", "partial"] as const) {
      const rows = await ctx.db
        .query("invoices")
        .withIndex("by_nurseryId_and_status", (q) =>
          q.eq("nurseryId", args.nurseryId).eq("status", status),
        )
        .take(1000);
      for (const invoice of rows) {
        const paidFils = await invoicePaidFils(ctx, invoice._id);
        outstandingFils += invoice.amountFils - paidFils;
        if (invoice.dueDate < today) {
          if (!studentNames.has(invoice.studentId)) {
            const student = await ctx.db.get("students", invoice.studentId);
            studentNames.set(invoice.studentId, student?.nameAr ?? "");
          }
          overdue.push({
            invoiceId: invoice._id,
            studentId: invoice.studentId,
            studentNameAr: studentNames.get(invoice.studentId) ?? "",
            amountFils: invoice.amountFils,
            paidFils,
            dueDate: invoice.dueDate,
            daysLate: daysBetweenISO(invoice.dueDate, today),
          });
        }
      }
    }
    // Most-late first.
    overdue.sort((a, b) => b.daysLate - a.daysLate);

    const monthExpenses = await ctx.db
      .query("expenses")
      .withIndex("by_nurseryId_and_date", (q) =>
        q
          .eq("nurseryId", args.nurseryId)
          .gte("date", `${month}-01`)
          .lt("date", nextMonthISO(month)),
      )
      .take(2000);
    const expensesMTDFils = monthExpenses.reduce(
      (sum, e) => sum + e.amountFils,
      0,
    );

    return {
      collectedMTDFils,
      outstandingFils,
      expensesMTDFils,
      overdueList: overdue.slice(0, 100),
    };
  },
});

/**
 * Student account statement (FR-FIN-5, print view). Strictly chronological:
 * invoices (+) and payments (−) with an exact running balance in fils.
 * Draft and void invoices are excluded — they are not part of the account.
 */
export const statement = query({
  args: {
    nurseryId: v.id("nurseries"),
    studentId: v.id("students"),
  },
  returns: v.object({
    student: v.object({ _id: v.id("students"), nameAr: v.string() }),
    nurseryName: v.string(),
    yearId: v.string(),
    lines: v.array(
      v.object({
        date: v.string(),
        kind: v.union(v.literal("invoice"), v.literal("payment")),
        description: v.string(),
        method: v.optional(paymentMethodValidator),
        amountFils: v.number(), // +invoice / −payment
        runningBalanceFils: v.number(),
      }),
    ),
    totals: v.object({
      invoicedFils: v.number(),
      paidFils: v.number(),
      balanceFils: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId, ["admin", "accountant"]);
    const student = await ctx.db.get("students", args.studentId);
    if (student === null || student.nurseryId !== args.nurseryId) {
      throw new ConvexError("forbidden");
    }
    const nursery = await ctx.db.get("nurseries", args.nurseryId);
    if (nursery === null) {
      throw new ConvexError("not_found");
    }

    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_nursery_and_studentId", (q) =>
        q.eq("nurseryId", args.nurseryId).eq("studentId", args.studentId),
      )
      .take(500);

    type Entry = {
      date: string;
      kind: "invoice" | "payment";
      description: string;
      method?: Doc<"payments">["method"];
      amountFils: number;
      createdAt: number;
    };
    const entries: Entry[] = [];
    const planNames = new Map<string, string>();

    for (const invoice of invoices) {
      if (invoice.status === "draft" || invoice.status === "void") continue;
      let planName: string | undefined;
      if (invoice.feePlanId !== undefined) {
        if (!planNames.has(invoice.feePlanId)) {
          const plan = await ctx.db.get("feePlans", invoice.feePlanId);
          planNames.set(invoice.feePlanId, plan?.name ?? "");
        }
        planName = planNames.get(invoice.feePlanId);
      }
      // Invoice line date = issue date (creation, Asia/Amman = UTC+3).
      const issuedDate = new Date(invoice._creationTime + 3 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const description =
        invoice.description ??
        (planName !== undefined && planName !== ""
          ? invoice.period !== undefined
            ? `${planName} — ${invoice.period}`
            : planName
          : "");
      entries.push({
        date: issuedDate,
        kind: "invoice",
        description,
        amountFils: invoice.amountFils,
        createdAt: invoice._creationTime,
      });
      const payments = await ctx.db
        .query("payments")
        .withIndex("by_invoiceId", (q) => q.eq("invoiceId", invoice._id))
        .take(500);
      for (const p of payments) {
        entries.push({
          date: p.paidAt,
          kind: "payment",
          description: p.note ?? "",
          method: p.method,
          amountFils: -p.amountFils,
          createdAt: p._creationTime,
        });
      }
    }

    // Chronological; ties: invoice before payment, then insertion order.
    entries.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      if (a.kind !== b.kind) return a.kind === "invoice" ? -1 : 1;
      return a.createdAt - b.createdAt;
    });

    let running = 0;
    let invoicedFils = 0;
    let paidFils = 0;
    const lines = entries.map((e) => {
      running += e.amountFils;
      if (e.kind === "invoice") invoicedFils += e.amountFils;
      else paidFils += -e.amountFils;
      return {
        date: e.date,
        kind: e.kind,
        description: e.description,
        ...(e.method !== undefined ? { method: e.method } : {}),
        amountFils: e.amountFils,
        runningBalanceFils: running,
      };
    });

    return {
      student: { _id: student._id, nameAr: student.nameAr },
      nurseryName: nursery.name,
      yearId: nursery.activeYear.yearId,
      lines,
      totals: {
        invoicedFils,
        paidFils,
        balanceFils: invoicedFils - paidFils,
      },
    };
  },
});
