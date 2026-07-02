import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { evaluationFields } from "./schema";
import { assertTeacherOfStudent, requireStaff } from "./lib/guard";
import { emitNotifications } from "./lib/notify";
import { alreadyProcessed } from "./lib/sync";

const evaluationDoc = v.object({
  _id: v.id("evaluations"),
  _creationTime: v.number(),
  ...evaluationFields,
});

export const upsert = mutation({
  args: {
    nurseryId: v.id("nurseries"),
    studentId: v.id("students"),
    yearId: v.string(),
    week: v.number(),
    scores: v.object({
      academic: v.number(),
      social: v.number(),
      motor: v.number(),
      behavioral: v.number(),
    }),
    note: v.optional(v.string()),
    clientMutationId: v.optional(v.string()),
    // When the client queued this write (offline outbox). Used for the LWW
    // conflict flag (PRD §8.5); direct online writes pass ≈ Date.now().
    clientCreatedAt: v.optional(v.number()),
  },
  returns: v.object({ conflict: v.boolean() }),
  handler: async (ctx, args) => {
    const { user, membership } = await requireStaff(ctx, args.nurseryId, [
      "admin",
      "teacher",
    ]);

    const student = await ctx.db.get("students", args.studentId);
    if (student === null || student.nurseryId !== args.nurseryId) {
      throw new ConvexError("forbidden");
    }

    for (const score of Object.values(args.scores)) {
      if (!Number.isInteger(score) || score < 1 || score > 5) {
        throw new ConvexError("invalid_score");
      }
    }

    if (membership.role === "teacher") {
      await assertTeacherOfStudent(
        ctx,
        user._id,
        args.nurseryId,
        args.studentId,
        args.yearId,
      );
    }

    if (await alreadyProcessed(ctx, args.clientMutationId)) {
      return { conflict: false }; // idempotent ack for offline replay
    }

    const existing = await ctx.db
      .query("evaluations")
      .withIndex("by_student_and_yearId_and_week", (q) =>
        q
          .eq("studentId", args.studentId)
          .eq("yearId", args.yearId)
          .eq("week", args.week),
      )
      .unique();

    // LWW conflict (PRD §8.5): the write still applies, but flag it when the
    // server row changed after the client queued this write.
    const conflict =
      existing !== null &&
      args.clientCreatedAt !== undefined &&
      (existing.updatedAt ?? existing._creationTime) > args.clientCreatedAt;

    if (existing !== null) {
      await ctx.db.patch("evaluations", existing._id, {
        scores: args.scores,
        note: args.note,
        recordedBy: user._id,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("evaluations", {
        nurseryId: args.nurseryId,
        studentId: args.studentId,
        yearId: args.yearId,
        week: args.week,
        scores: args.scores,
        note: args.note,
        recordedBy: user._id,
        updatedAt: Date.now(),
      });
    }

    // FR-NOT-2: evaluation saved (create or update) → notify the parent.
    await emitNotifications(ctx, args.nurseryId, [
      {
        studentId: args.studentId,
        type: "evaluation",
        // FR-NOT-3: ids/keys only, no scores or note text.
        payload: { week: String(args.week), yearId: args.yearId },
      },
    ]);
    return { conflict };
  },
});

export const listForStudent = query({
  args: {
    nurseryId: v.id("nurseries"),
    studentId: v.id("students"),
    yearId: v.string(),
  },
  returns: v.array(evaluationDoc),
  handler: async (ctx, args) => {
    // Accountants have no access to evaluations (PRD §6).
    const { user, membership } = await requireStaff(ctx, args.nurseryId, [
      "admin",
      "teacher",
    ]);
    const student = await ctx.db.get("students", args.studentId);
    if (student === null || student.nurseryId !== args.nurseryId) {
      throw new ConvexError("forbidden");
    }
    if (membership.role === "teacher") {
      await assertTeacherOfStudent(
        ctx,
        user._id,
        args.nurseryId,
        args.studentId,
        args.yearId,
      );
    }
    return await ctx.db
      .query("evaluations")
      .withIndex("by_student_and_yearId_and_week", (q) =>
        q.eq("studentId", args.studentId).eq("yearId", args.yearId),
      )
      .take(60);
  },
});

export const listForClassroomWeek = query({
  args: {
    nurseryId: v.id("nurseries"),
    classroomId: v.id("classrooms"),
    yearId: v.string(),
    week: v.number(),
  },
  returns: v.array(
    v.object({
      studentId: v.id("students"),
      evaluation: v.union(evaluationDoc, v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    // Accountants have no access to evaluations (PRD §6).
    const { user, membership } = await requireStaff(ctx, args.nurseryId, [
      "admin",
      "teacher",
    ]);
    const classroom = await ctx.db.get("classrooms", args.classroomId);
    if (classroom === null || classroom.nurseryId !== args.nurseryId) {
      throw new ConvexError("forbidden");
    }
    if (
      membership.role === "teacher" &&
      !classroom.teacherIds.includes(user._id)
    ) {
      throw new ConvexError("forbidden");
    }
    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_nursery_and_classroomId_and_yearId", (q) =>
        q
          .eq("nurseryId", args.nurseryId)
          .eq("classroomId", args.classroomId)
          .eq("yearId", args.yearId),
      )
      .take(200);
    const rows = [];
    for (const enrollment of enrollments) {
      const evaluation = await ctx.db
        .query("evaluations")
        .withIndex("by_student_and_yearId_and_week", (q) =>
          q
            .eq("studentId", enrollment.studentId)
            .eq("yearId", args.yearId)
            .eq("week", args.week),
        )
        .unique();
      rows.push({ studentId: enrollment.studentId, evaluation });
    }
    return rows;
  },
});
