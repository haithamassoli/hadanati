import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireStaff } from "./lib/guard";
import {
  assertDateISO,
  assertFils,
  assertMonthISO,
  nextMonthISO,
} from "./lib/finance";

// Expenses (FR-FIN-4). admin + accountant only.

const expenseShape = v.object({
  _id: v.id("expenses"),
  _creationTime: v.number(),
  date: v.string(),
  category: v.string(),
  amountFils: v.number(),
  note: v.optional(v.string()),
});

export const list = query({
  args: {
    nurseryId: v.id("nurseries"),
    month: v.optional(v.string()), // "YYYY-MM"
  },
  returns: v.array(expenseShape),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId, ["admin", "accountant"]);
    let rows;
    if (args.month !== undefined) {
      const month = args.month;
      assertMonthISO(month);
      rows = await ctx.db
        .query("expenses")
        .withIndex("by_nurseryId_and_date", (q) =>
          q
            .eq("nurseryId", args.nurseryId)
            .gte("date", `${month}-01`)
            .lt("date", nextMonthISO(month)),
        )
        .order("desc")
        .take(200);
    } else {
      rows = await ctx.db
        .query("expenses")
        .withIndex("by_nurseryId", (q) => q.eq("nurseryId", args.nurseryId))
        .order("desc")
        .take(200);
    }
    return rows.map((row) => ({
      _id: row._id,
      _creationTime: row._creationTime,
      date: row.date,
      category: row.category,
      amountFils: row.amountFils,
      ...(row.note !== undefined ? { note: row.note } : {}),
    }));
  },
});

export const create = mutation({
  args: {
    nurseryId: v.id("nurseries"),
    date: v.string(), // "YYYY-MM-DD"
    category: v.string(),
    amountFils: v.number(),
    note: v.optional(v.string()),
  },
  returns: v.id("expenses"),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId, ["admin", "accountant"]);
    assertFils(args.amountFils);
    assertDateISO(args.date);
    return await ctx.db.insert("expenses", {
      nurseryId: args.nurseryId,
      date: args.date,
      category: args.category,
      amountFils: args.amountFils,
      note: args.note,
    });
  },
});

export const update = mutation({
  args: {
    nurseryId: v.id("nurseries"),
    expenseId: v.id("expenses"),
    date: v.optional(v.string()),
    category: v.optional(v.string()),
    amountFils: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId, ["admin", "accountant"]);
    const expense = await ctx.db.get("expenses", args.expenseId);
    if (expense === null || expense.nurseryId !== args.nurseryId) {
      throw new ConvexError("forbidden");
    }
    const updates: Partial<{
      date: string;
      category: string;
      amountFils: number;
      note: string;
    }> = {};
    if (args.date !== undefined) {
      assertDateISO(args.date);
      updates.date = args.date;
    }
    if (args.category !== undefined) updates.category = args.category;
    if (args.amountFils !== undefined) {
      assertFils(args.amountFils);
      updates.amountFils = args.amountFils;
    }
    if (args.note !== undefined) updates.note = args.note;
    if (Object.keys(updates).length > 0) {
      await ctx.db.patch("expenses", args.expenseId, updates);
    }
    return null;
  },
});

export const remove = mutation({
  args: {
    nurseryId: v.id("nurseries"),
    expenseId: v.id("expenses"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId, ["admin", "accountant"]);
    const expense = await ctx.db.get("expenses", args.expenseId);
    if (expense === null || expense.nurseryId !== args.nurseryId) {
      throw new ConvexError("forbidden");
    }
    await ctx.db.delete("expenses", args.expenseId);
    return null;
  },
});
