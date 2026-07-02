import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertTeacherOfStudent, requireStaff } from "./lib/guard";

const enrollmentWithNames = v.object({
  _id: v.id("enrollments"),
  _creationTime: v.number(),
  studentId: v.id("students"),
  classroomId: v.id("classrooms"),
  yearId: v.string(),
  feePlanId: v.optional(v.id("feePlans")),
  classroomName: v.string(),
  stageName: v.string(),
});

export const forStudent = query({
  args: {
    nurseryId: v.id("nurseries"),
    studentId: v.id("students"),
  },
  returns: v.array(enrollmentWithNames),
  handler: async (ctx, args) => {
    const { user, membership } = await requireStaff(ctx, args.nurseryId);
    const student = await ctx.db.get("students", args.studentId);
    if (student === null || student.nurseryId !== args.nurseryId) {
      throw new ConvexError("forbidden");
    }
    if (membership.role === "teacher") {
      const nursery = await ctx.db.get("nurseries", args.nurseryId);
      if (nursery === null) {
        throw new ConvexError("forbidden");
      }
      await assertTeacherOfStudent(
        ctx,
        user._id,
        args.nurseryId,
        args.studentId,
        nursery.activeYear.yearId,
      );
    }
    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_nursery_and_studentId", (q) =>
        q.eq("nurseryId", args.nurseryId).eq("studentId", args.studentId),
      )
      .order("desc")
      .take(50);
    const result = [];
    for (const enrollment of enrollments) {
      const classroom = await ctx.db.get("classrooms", enrollment.classroomId);
      const stage =
        classroom !== null
          ? await ctx.db.get("stages", classroom.stageId)
          : null;
      result.push({
        _id: enrollment._id,
        _creationTime: enrollment._creationTime,
        studentId: enrollment.studentId,
        classroomId: enrollment.classroomId,
        yearId: enrollment.yearId,
        ...(enrollment.feePlanId !== undefined
          ? { feePlanId: enrollment.feePlanId }
          : {}),
        classroomName: classroom?.name ?? "",
        stageName: stage?.name ?? "",
      });
    }
    return result;
  },
});

export const enroll = mutation({
  args: {
    nurseryId: v.id("nurseries"),
    studentId: v.id("students"),
    classroomId: v.id("classrooms"),
    yearId: v.string(),
    feePlanId: v.optional(v.id("feePlans")),
  },
  returns: v.id("enrollments"),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId, ["admin"]);
    const student = await ctx.db.get("students", args.studentId);
    if (student === null || student.nurseryId !== args.nurseryId) {
      throw new ConvexError("forbidden");
    }
    const classroom = await ctx.db.get("classrooms", args.classroomId);
    if (classroom === null || classroom.nurseryId !== args.nurseryId) {
      throw new ConvexError("forbidden");
    }
    if (args.feePlanId !== undefined) {
      const feePlan = await ctx.db.get("feePlans", args.feePlanId);
      if (feePlan === null || feePlan.nurseryId !== args.nurseryId) {
        throw new ConvexError("forbidden");
      }
    }
    const existing = await ctx.db
      .query("enrollments")
      .withIndex("by_nursery_and_studentId", (q) =>
        q.eq("nurseryId", args.nurseryId).eq("studentId", args.studentId),
      )
      .take(50);
    if (existing.some((e) => e.yearId === args.yearId)) {
      throw new ConvexError("already_enrolled");
    }
    return await ctx.db.insert("enrollments", {
      nurseryId: args.nurseryId,
      studentId: args.studentId,
      classroomId: args.classroomId,
      yearId: args.yearId,
      feePlanId: args.feePlanId,
    });
  },
});

export const move = mutation({
  args: {
    nurseryId: v.id("nurseries"),
    enrollmentId: v.id("enrollments"),
    classroomId: v.id("classrooms"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId, ["admin"]);
    const enrollment = await ctx.db.get("enrollments", args.enrollmentId);
    if (enrollment === null || enrollment.nurseryId !== args.nurseryId) {
      throw new ConvexError("forbidden");
    }
    const classroom = await ctx.db.get("classrooms", args.classroomId);
    if (classroom === null || classroom.nurseryId !== args.nurseryId) {
      throw new ConvexError("forbidden");
    }
    await ctx.db.patch("enrollments", args.enrollmentId, {
      classroomId: args.classroomId,
    });
    return null;
  },
});

export const unenroll = mutation({
  args: {
    nurseryId: v.id("nurseries"),
    enrollmentId: v.id("enrollments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId, ["admin"]);
    const enrollment = await ctx.db.get("enrollments", args.enrollmentId);
    if (enrollment === null || enrollment.nurseryId !== args.nurseryId) {
      throw new ConvexError("forbidden");
    }
    await ctx.db.delete("enrollments", args.enrollmentId);
    return null;
  },
});
