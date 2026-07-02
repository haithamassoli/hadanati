import { ConvexError, v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { todayISO } from "./lib/shared";
import {
  generateInvoicesForNursery,
  sweepOverdueForNursery,
} from "./lib/finance";

// Cron workers (see convex/crons.ts for the schedules). Both entry points
// fan out one scheduled mutation PER NURSERY so each nursery's work is its
// own transaction, and self-continue over the nurseries table in pages of 25
// — the pattern scales far past the ~16K read / 8K write per-function limits
// (ceiling: any number of nurseries; per-nursery ceilings live in
// lib/finance.ts).

const PAGE_SIZE = 25;

/** Monthly (1st, 02:00 UTC): issue the current month's plan invoices. */
export const generateAll = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("nurseries")
      .paginate({ numItems: PAGE_SIZE, cursor: args.cursor ?? null });
    const period = todayISO().slice(0, 7); // Asia/Amman current month
    for (const nursery of page.page) {
      await ctx.scheduler.runAfter(0, internal.financeCron.generateForNursery, {
        nurseryId: nursery._id,
        period,
      });
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.financeCron.generateAll, {
        cursor: page.continueCursor,
      });
    }
    return null;
  },
});

export const generateForNursery = internalMutation({
  args: {
    nurseryId: v.id("nurseries"),
    period: v.string(), // "YYYY-MM"
  },
  returns: v.object({ created: v.number(), skipped: v.number() }),
  handler: async (ctx, args) => {
    const nursery = await ctx.db.get("nurseries", args.nurseryId);
    if (nursery === null) {
      throw new ConvexError("nursery_not_found");
    }
    return await generateInvoicesForNursery(ctx, nursery, args.period);
  },
});

/** Daily (03:00 UTC): notify newly overdue invoices — once per invoice ever. */
export const notifyOverdueAll = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("nurseries")
      .paginate({ numItems: PAGE_SIZE, cursor: args.cursor ?? null });
    for (const nursery of page.page) {
      await ctx.scheduler.runAfter(
        0,
        internal.financeCron.notifyOverdueForNursery,
        { nurseryId: nursery._id },
      );
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.financeCron.notifyOverdueAll, {
        cursor: page.continueCursor,
      });
    }
    return null;
  },
});

export const notifyOverdueForNursery = internalMutation({
  args: { nurseryId: v.id("nurseries") },
  returns: v.object({ notified: v.number() }),
  handler: async (ctx, args) => {
    const notified = await sweepOverdueForNursery(ctx, args.nurseryId);
    return { notified };
  },
});
