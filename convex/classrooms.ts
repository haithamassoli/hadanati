import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { requireStaff } from "./lib/guard";

const classroomDoc = v.object({
  _id: v.id("classrooms"),
  _creationTime: v.number(),
  nurseryId: v.id("nurseries"),
  stageId: v.id("stages"),
  name: v.string(),
  teacherIds: v.array(v.id("users")),
});

export const list = query({
  args: { nurseryId: v.id("nurseries") },
  returns: v.array(classroomDoc),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId);
    return await ctx.db
      .query("classrooms")
      .withIndex("by_nurseryId", (q) => q.eq("nurseryId", args.nurseryId))
      .take(100);
  },
});

/** Every teacherId must be a member of the nursery (prevents cross-tenant ids). */
async function assertTeachersAreMembers(
  ctx: MutationCtx,
  nurseryId: Id<"nurseries">,
  teacherIds: Id<"users">[],
): Promise<void> {
  for (const teacherId of teacherIds) {
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_nursery_and_user", (q) =>
        q.eq("nurseryId", nurseryId).eq("userId", teacherId),
      )
      .unique();
    if (membership === null) {
      throw new ConvexError("forbidden");
    }
  }
}

export const create = mutation({
  args: {
    nurseryId: v.id("nurseries"),
    stageId: v.id("stages"),
    name: v.string(),
    teacherIds: v.array(v.id("users")),
  },
  returns: v.id("classrooms"),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId, ["admin"]);
    const stage = await ctx.db.get("stages", args.stageId);
    if (stage === null || stage.nurseryId !== args.nurseryId) {
      throw new ConvexError("forbidden");
    }
    await assertTeachersAreMembers(ctx, args.nurseryId, args.teacherIds);
    return await ctx.db.insert("classrooms", {
      nurseryId: args.nurseryId,
      stageId: args.stageId,
      name: args.name,
      teacherIds: args.teacherIds,
    });
  },
});

export const update = mutation({
  args: {
    nurseryId: v.id("nurseries"),
    classroomId: v.id("classrooms"),
    stageId: v.optional(v.id("stages")),
    name: v.optional(v.string()),
    teacherIds: v.optional(v.array(v.id("users"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId, ["admin"]);
    const classroom = await ctx.db.get("classrooms", args.classroomId);
    if (classroom === null || classroom.nurseryId !== args.nurseryId) {
      throw new ConvexError("forbidden");
    }
    const updates: {
      stageId?: Id<"stages">;
      name?: string;
      teacherIds?: Id<"users">[];
    } = {};
    if (args.stageId !== undefined) {
      const stage = await ctx.db.get("stages", args.stageId);
      if (stage === null || stage.nurseryId !== args.nurseryId) {
        throw new ConvexError("forbidden");
      }
      updates.stageId = args.stageId;
    }
    if (args.name !== undefined) updates.name = args.name;
    if (args.teacherIds !== undefined) {
      await assertTeachersAreMembers(ctx, args.nurseryId, args.teacherIds);
      updates.teacherIds = args.teacherIds;
    }
    await ctx.db.patch("classrooms", args.classroomId, updates);
    return null;
  },
});

export const remove = mutation({
  args: {
    nurseryId: v.id("nurseries"),
    classroomId: v.id("classrooms"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId, ["admin"]);
    const classroom = await ctx.db.get("classrooms", args.classroomId);
    if (classroom === null || classroom.nurseryId !== args.nurseryId) {
      throw new ConvexError("forbidden");
    }
    const enrollment = await ctx.db
      .query("enrollments")
      .withIndex("by_nursery_and_classroomId_and_yearId", (q) =>
        q.eq("nurseryId", args.nurseryId).eq("classroomId", args.classroomId),
      )
      .first();
    if (enrollment !== null) {
      throw new ConvexError("classroom_has_enrollments");
    }
    await ctx.db.delete("classrooms", args.classroomId);
    return null;
  },
});
