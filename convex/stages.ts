import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireStaff } from "./lib/guard";

const stageDoc = v.object({
  _id: v.id("stages"),
  _creationTime: v.number(),
  nurseryId: v.id("nurseries"),
  name: v.string(),
  order: v.number(),
});

export const list = query({
  args: { nurseryId: v.id("nurseries") },
  returns: v.array(stageDoc),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId);
    const stages = await ctx.db
      .query("stages")
      .withIndex("by_nurseryId", (q) => q.eq("nurseryId", args.nurseryId))
      .take(100);
    return stages.sort((a, b) => a.order - b.order);
  },
});

export const create = mutation({
  args: {
    nurseryId: v.id("nurseries"),
    name: v.string(),
  },
  returns: v.id("stages"),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId, ["admin"]);
    const stages = await ctx.db
      .query("stages")
      .withIndex("by_nurseryId", (q) => q.eq("nurseryId", args.nurseryId))
      .take(100);
    const maxOrder = stages.reduce((max, s) => Math.max(max, s.order), 0);
    return await ctx.db.insert("stages", {
      nurseryId: args.nurseryId,
      name: args.name,
      order: maxOrder + 1,
    });
  },
});

export const update = mutation({
  args: {
    nurseryId: v.id("nurseries"),
    stageId: v.id("stages"),
    name: v.optional(v.string()),
    order: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId, ["admin"]);
    const stage = await ctx.db.get("stages", args.stageId);
    if (stage === null || stage.nurseryId !== args.nurseryId) {
      throw new ConvexError("forbidden");
    }
    const updates: { name?: string; order?: number } = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.order !== undefined) updates.order = args.order;
    await ctx.db.patch("stages", args.stageId, updates);
    return null;
  },
});

export const remove = mutation({
  args: {
    nurseryId: v.id("nurseries"),
    stageId: v.id("stages"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId, ["admin"]);
    const stage = await ctx.db.get("stages", args.stageId);
    if (stage === null || stage.nurseryId !== args.nurseryId) {
      throw new ConvexError("forbidden");
    }
    const classroom = await ctx.db
      .query("classrooms")
      .withIndex("by_nurseryId_and_stageId", (q) =>
        q.eq("nurseryId", args.nurseryId).eq("stageId", args.stageId),
      )
      .first();
    if (classroom !== null) {
      throw new ConvexError("stage_has_classrooms");
    }
    await ctx.db.delete("stages", args.stageId);
    return null;
  },
});
