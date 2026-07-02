import { ConvexError, v } from "convex/values";
import { query } from "./_generated/server";
import { requireStaff } from "./lib/guard";

const countsShape = {
  present: v.number(),
  absent: v.number(),
  late: v.number(),
  excused: v.number(),
  unmarked: v.number(),
};

export const todayOverview = query({
  args: {
    nurseryId: v.id("nurseries"),
    date: v.string(), // "YYYY-MM-DD"
  },
  returns: v.object({
    totals: v.object({ students: v.number(), ...countsShape }),
    classrooms: v.array(
      v.object({
        classroomId: v.id("classrooms"),
        name: v.string(),
        stageName: v.string(),
        total: v.number(),
        ...countsShape,
      }),
    ),
    absentees: v.array(
      v.object({
        studentId: v.id("students"),
        nameAr: v.string(),
        classroomName: v.string(),
        note: v.optional(v.string()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const { user, membership } = await requireStaff(ctx, args.nurseryId);
    const nursery = await ctx.db.get("nurseries", args.nurseryId);
    if (nursery === null) {
      throw new ConvexError("forbidden");
    }
    const yearId = nursery.activeYear.yearId;

    let classrooms = await ctx.db
      .query("classrooms")
      .withIndex("by_nurseryId", (q) => q.eq("nurseryId", args.nurseryId))
      .take(100);
    if (membership.role === "teacher") {
      // Teacher reads are scoped to own classrooms (PRD §6).
      classrooms = classrooms.filter((c) => c.teacherIds.includes(user._id));
    }

    const totals = {
      students: 0,
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      unmarked: 0,
    };
    const classroomRows = [];
    const absentees = [];

    for (const classroom of classrooms) {
      const stage = await ctx.db.get("stages", classroom.stageId);
      const enrollments = await ctx.db
        .query("enrollments")
        .withIndex("by_nursery_and_classroomId_and_yearId", (q) =>
          q
            .eq("nurseryId", args.nurseryId)
            .eq("classroomId", classroom._id)
            .eq("yearId", yearId),
        )
        .take(200);
      const roster = new Set(enrollments.map((e) => e.studentId));

      // Bounded read via by_nursery_and_classroom_and_date, per classroom.
      const attendanceRows = await ctx.db
        .query("attendance")
        .withIndex("by_nursery_and_classroom_and_date", (q) =>
          q
            .eq("nurseryId", args.nurseryId)
            .eq("classroomId", classroom._id)
            .eq("date", args.date),
        )
        .take(200);

      const counts = { present: 0, absent: 0, late: 0, excused: 0 };
      let marked = 0;
      for (const row of attendanceRows) {
        if (!roster.has(row.studentId)) continue;
        counts[row.status] += 1;
        marked += 1;
        if (row.status === "absent") {
          const student = await ctx.db.get("students", row.studentId);
          if (student !== null) {
            absentees.push({
              studentId: student._id,
              nameAr: student.nameAr,
              classroomName: classroom.name,
              ...(row.note !== undefined ? { note: row.note } : {}),
            });
          }
        }
      }
      const total = roster.size;
      const unmarked = Math.max(0, total - marked);

      classroomRows.push({
        classroomId: classroom._id,
        name: classroom.name,
        stageName: stage?.name ?? "",
        total,
        ...counts,
        unmarked,
      });

      totals.students += total;
      totals.present += counts.present;
      totals.absent += counts.absent;
      totals.late += counts.late;
      totals.excused += counts.excused;
      totals.unmarked += unmarked;
    }

    return { totals, classrooms: classroomRows, absentees };
  },
});
