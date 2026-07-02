import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { attendanceFields, attendanceStatusValidator } from "./schema";
import { requireStaff } from "./lib/guard";
import { emitNotifications } from "./lib/notify";
import { todayISO } from "./lib/shared";
import { alreadyProcessed } from "./lib/sync";

const attendanceDoc = v.object({
  _id: v.id("attendance"),
  _creationTime: v.number(),
  ...attendanceFields,
});

export const upsert = mutation({
  args: {
    nurseryId: v.id("nurseries"),
    classroomId: v.id("classrooms"),
    studentId: v.id("students"),
    date: v.string(), // "YYYY-MM-DD"
    status: attendanceStatusValidator,
    note: v.optional(v.string()),
    checkInAt: v.optional(v.number()),
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

    const classroom = await ctx.db.get("classrooms", args.classroomId);
    if (classroom === null || classroom.nurseryId !== args.nurseryId) {
      throw new ConvexError("forbidden");
    }
    const student = await ctx.db.get("students", args.studentId);
    if (student === null || student.nurseryId !== args.nurseryId) {
      throw new ConvexError("forbidden");
    }

    if (membership.role === "teacher") {
      // Teachers: own classrooms only, same-day (Asia/Amman) only.
      if (!classroom.teacherIds.includes(user._id)) {
        throw new ConvexError("forbidden");
      }
      if (args.date !== todayISO()) {
        throw new ConvexError("forbidden");
      }
    }

    if (await alreadyProcessed(ctx, args.clientMutationId)) {
      return { conflict: false }; // idempotent ack for offline replay
    }

    const existing = await ctx.db
      .query("attendance")
      .withIndex("by_student_and_date", (q) =>
        q.eq("studentId", args.studentId).eq("date", args.date),
      )
      .unique();

    // LWW conflict (PRD §8.5): the write still applies, but flag it when the
    // server row changed after the client queued this write.
    const conflict =
      existing !== null &&
      args.clientCreatedAt !== undefined &&
      (existing.updatedAt ?? existing._creationTime) > args.clientCreatedAt;

    const previousStatus = existing?.status ?? null;
    let attendanceId;
    if (existing !== null) {
      attendanceId = existing._id;
      await ctx.db.patch("attendance", existing._id, {
        classroomId: args.classroomId,
        status: args.status,
        note: args.note,
        checkInAt: args.checkInAt,
        recordedBy: user._id,
        updatedAt: Date.now(),
      });
    } else {
      attendanceId = await ctx.db.insert("attendance", {
        nurseryId: args.nurseryId,
        classroomId: args.classroomId,
        studentId: args.studentId,
        date: args.date,
        status: args.status,
        note: args.note,
        checkInAt: args.checkInAt,
        recordedBy: user._id,
        updatedAt: Date.now(),
      });
    }

    // FR-NOT-2: notify on a NEW absence only (absent → absent is a no-op).
    if (args.status === "absent" && previousStatus !== "absent") {
      await emitNotifications(ctx, args.nurseryId, [
        {
          studentId: args.studentId,
          type: "absence",
          // FR-NOT-3: ids + date only, no PII.
          payload: { date: args.date, attendanceId },
        },
      ]);
    }
    return { conflict };
  },
});

export const listForClassroomDate = query({
  args: {
    nurseryId: v.id("nurseries"),
    classroomId: v.id("classrooms"),
    date: v.string(), // "YYYY-MM-DD"
  },
  returns: v.array(attendanceDoc),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId);
    return await ctx.db
      .query("attendance")
      .withIndex("by_nursery_and_classroom_and_date", (q) =>
        q
          .eq("nurseryId", args.nurseryId)
          .eq("classroomId", args.classroomId)
          .eq("date", args.date),
      )
      .take(200);
  },
});
