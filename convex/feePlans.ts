import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { feePlanCadenceValidator } from "./schema";
import { requireStaff } from "./lib/guard";
import { assertFils } from "./lib/finance";

// Fee plans (FR-FIN-1). CRUD = admin + accountant. list is readable by ANY
// staff role because the enrollment UI shows plan names in its plan Select.

const feePlanShape = v.object({
  _id: v.id("feePlans"),
  _creationTime: v.number(),
  name: v.string(),
  amountFils: v.number(),
  cadence: feePlanCadenceValidator,
});

export const list = query({
  args: { nurseryId: v.id("nurseries") },
  returns: v.array(feePlanShape),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId);
    const rows = await ctx.db
      .query("feePlans")
      .withIndex("by_nurseryId", (q) => q.eq("nurseryId", args.nurseryId))
      .take(200);
    return rows.map((row) => ({
      _id: row._id,
      _creationTime: row._creationTime,
      name: row.name,
      amountFils: row.amountFils,
      cadence: row.cadence,
    }));
  },
});

export const create = mutation({
  args: {
    nurseryId: v.id("nurseries"),
    name: v.string(),
    amountFils: v.number(),
    cadence: feePlanCadenceValidator,
  },
  returns: v.id("feePlans"),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId, ["admin", "accountant"]);
    assertFils(args.amountFils);
    return await ctx.db.insert("feePlans", {
      nurseryId: args.nurseryId,
      name: args.name,
      amountFils: args.amountFils,
      cadence: args.cadence,
    });
  },
});

export const update = mutation({
  args: {
    nurseryId: v.id("nurseries"),
    feePlanId: v.id("feePlans"),
    name: v.optional(v.string()),
    amountFils: v.optional(v.number()),
    cadence: v.optional(feePlanCadenceValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId, ["admin", "accountant"]);
    const plan = await ctx.db.get("feePlans", args.feePlanId);
    if (plan === null || plan.nurseryId !== args.nurseryId) {
      throw new ConvexError("forbidden");
    }
    const updates: Partial<{
      name: string;
      amountFils: number;
      cadence: typeof args.cadence;
    }> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.amountFils !== undefined) {
      assertFils(args.amountFils);
      updates.amountFils = args.amountFils;
    }
    if (args.cadence !== undefined) updates.cadence = args.cadence;
    if (Object.keys(updates).length > 0) {
      await ctx.db.patch("feePlans", args.feePlanId, updates);
    }
    return null;
  },
});

export const remove = mutation({
  args: {
    nurseryId: v.id("nurseries"),
    feePlanId: v.id("feePlans"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId, ["admin", "accountant"]);
    const plan = await ctx.db.get("feePlans", args.feePlanId);
    if (plan === null || plan.nurseryId !== args.nurseryId) {
      throw new ConvexError("forbidden");
    }
    // A plan referenced by ANY enrollment (any year) cannot be deleted.
    // Ceiling: ≤ 4000 enrollments per nursery (nursery scale ~10² students).
    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_nursery_and_classroomId_and_yearId", (q) =>
        q.eq("nurseryId", args.nurseryId),
      )
      .take(4000);
    if (enrollments.some((e) => e.feePlanId === args.feePlanId)) {
      throw new ConvexError("plan_in_use");
    }
    await ctx.db.delete("feePlans", args.feePlanId);
    return null;
  },
});
