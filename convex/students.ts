import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { studentFields } from "./schema";
import { requireStaff, teacherClassrooms } from "./lib/guard";

const studentDoc = v.object({
  _id: v.id("students"),
  _creationTime: v.number(),
  ...studentFields,
});

const guardiansValidator = v.array(
  v.object({
    name: v.string(),
    phone: v.string(),
    relation: v.string(),
  }),
);

const statusValidator = v.union(v.literal("active"), v.literal("archived"));

export const listForClassroom = query({
  args: {
    nurseryId: v.id("nurseries"),
    classroomId: v.id("classrooms"),
    yearId: v.string(),
  },
  returns: v.array(studentDoc),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId);
    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_nursery_and_classroomId_and_yearId", (q) =>
        q
          .eq("nurseryId", args.nurseryId)
          .eq("classroomId", args.classroomId)
          .eq("yearId", args.yearId),
      )
      .take(200);
    const students: Doc<"students">[] = [];
    for (const enrollment of enrollments) {
      const student = await ctx.db.get("students", enrollment.studentId);
      if (student !== null && student.nurseryId === args.nurseryId) {
        students.push(student);
      }
    }
    return students;
  },
});

export const list = query({
  args: {
    nurseryId: v.id("nurseries"),
    status: v.optional(statusValidator),
  },
  returns: v.array(studentDoc),
  handler: async (ctx, args) => {
    const { user, membership } = await requireStaff(ctx, args.nurseryId);

    if (membership.role === "teacher") {
      // Teachers see only students enrolled (active year) in their classrooms.
      const nursery = await ctx.db.get("nurseries", args.nurseryId);
      if (nursery === null) {
        throw new ConvexError("forbidden");
      }
      const yearId = nursery.activeYear.yearId;
      const classrooms = await teacherClassrooms(ctx, args.nurseryId, user._id);
      const seen = new Set<Id<"students">>();
      const students: Doc<"students">[] = [];
      for (const classroom of classrooms) {
        const enrollments = await ctx.db
          .query("enrollments")
          .withIndex("by_nursery_and_classroomId_and_yearId", (q) =>
            q
              .eq("nurseryId", args.nurseryId)
              .eq("classroomId", classroom._id)
              .eq("yearId", yearId),
          )
          .take(200);
        for (const enrollment of enrollments) {
          if (seen.has(enrollment.studentId)) continue;
          seen.add(enrollment.studentId);
          const student = await ctx.db.get("students", enrollment.studentId);
          if (
            student !== null &&
            student.nurseryId === args.nurseryId &&
            (args.status === undefined || student.status === args.status)
          ) {
            students.push(student);
          }
        }
        if (students.length >= 500) break;
      }
      return students.slice(0, 500);
    }

    if (args.status !== undefined) {
      const status = args.status;
      return await ctx.db
        .query("students")
        .withIndex("by_nurseryId_and_status", (q) =>
          q.eq("nurseryId", args.nurseryId).eq("status", status),
        )
        .take(500);
    }
    return await ctx.db
      .query("students")
      .withIndex("by_nurseryId", (q) => q.eq("nurseryId", args.nurseryId))
      .take(500);
  },
});

/** Active-year enrollment for a student, or null. */
async function activeYearEnrollment(
  ctx: QueryCtx,
  nurseryId: Id<"nurseries">,
  studentId: Id<"students">,
): Promise<{ enrollment: Doc<"enrollments"> | null; yearId: string }> {
  const nursery = await ctx.db.get("nurseries", nurseryId);
  if (nursery === null) {
    throw new ConvexError("forbidden");
  }
  const yearId = nursery.activeYear.yearId;
  const enrollments = await ctx.db
    .query("enrollments")
    .withIndex("by_nursery_and_studentId", (q) =>
      q.eq("nurseryId", nurseryId).eq("studentId", studentId),
    )
    .take(50);
  return { enrollment: enrollments.find((e) => e.yearId === yearId) ?? null, yearId };
}

export const get = query({
  args: {
    nurseryId: v.id("nurseries"),
    studentId: v.id("students"),
  },
  returns: v.object({
    student: studentDoc,
    photoUrl: v.union(v.string(), v.null()),
    enrollment: v.union(
      v.null(),
      v.object({
        _id: v.id("enrollments"),
        classroomId: v.id("classrooms"),
        classroomName: v.string(),
        stageName: v.string(),
        yearId: v.string(),
        feePlanId: v.optional(v.id("feePlans")),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const { user, membership } = await requireStaff(ctx, args.nurseryId);
    const student = await ctx.db.get("students", args.studentId);
    if (student === null || student.nurseryId !== args.nurseryId) {
      throw new ConvexError("forbidden");
    }
    const { enrollment } = await activeYearEnrollment(
      ctx,
      args.nurseryId,
      args.studentId,
    );

    let classroom: Doc<"classrooms"> | null = null;
    let stage: Doc<"stages"> | null = null;
    if (enrollment !== null) {
      classroom = await ctx.db.get("classrooms", enrollment.classroomId);
      if (classroom !== null) {
        stage = await ctx.db.get("stages", classroom.stageId);
      }
    }

    if (membership.role === "teacher") {
      // Teachers: only students in their own classrooms (active year).
      if (classroom === null || !classroom.teacherIds.includes(user._id)) {
        throw new ConvexError("forbidden");
      }
    }

    const photoUrl =
      student.photoId !== undefined
        ? await ctx.storage.getUrl(student.photoId)
        : null;

    return {
      student,
      photoUrl,
      enrollment:
        enrollment === null || classroom === null
          ? null
          : {
              _id: enrollment._id,
              classroomId: enrollment.classroomId,
              classroomName: classroom.name,
              stageName: stage?.name ?? "",
              yearId: enrollment.yearId,
              ...(enrollment.feePlanId !== undefined
                ? { feePlanId: enrollment.feePlanId }
                : {}),
            },
    };
  },
});

export const create = mutation({
  args: {
    nurseryId: v.id("nurseries"),
    nameAr: v.string(),
    nameEn: v.optional(v.string()),
    dob: v.string(), // "YYYY-MM-DD"
    sex: v.union(v.literal("m"), v.literal("f")),
    guardians: guardiansValidator,
    health: v.optional(v.string()),
    consentPhotos: v.boolean(),
    classroomId: v.optional(v.id("classrooms")),
  },
  returns: v.id("students"),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId, ["admin"]);
    const nursery = await ctx.db.get("nurseries", args.nurseryId);
    if (nursery === null) {
      throw new ConvexError("forbidden");
    }
    if (args.classroomId !== undefined) {
      const classroom = await ctx.db.get("classrooms", args.classroomId);
      if (classroom === null || classroom.nurseryId !== args.nurseryId) {
        throw new ConvexError("forbidden");
      }
    }
    const studentId = await ctx.db.insert("students", {
      nurseryId: args.nurseryId,
      nameAr: args.nameAr,
      nameEn: args.nameEn,
      dob: args.dob,
      sex: args.sex,
      guardians: args.guardians,
      health: args.health,
      consent: { photos: args.consentPhotos },
      status: "active",
    });
    if (args.classroomId !== undefined) {
      await ctx.db.insert("enrollments", {
        nurseryId: args.nurseryId,
        studentId,
        classroomId: args.classroomId,
        yearId: nursery.activeYear.yearId,
      });
    }
    return studentId;
  },
});

export const update = mutation({
  args: {
    nurseryId: v.id("nurseries"),
    studentId: v.id("students"),
    nameAr: v.optional(v.string()),
    nameEn: v.optional(v.string()),
    dob: v.optional(v.string()),
    sex: v.optional(v.union(v.literal("m"), v.literal("f"))),
    guardians: v.optional(guardiansValidator),
    health: v.optional(v.string()),
    consentPhotos: v.optional(v.boolean()),
    classroomId: v.optional(v.id("classrooms")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId, ["admin"]);
    const student = await ctx.db.get("students", args.studentId);
    if (student === null || student.nurseryId !== args.nurseryId) {
      throw new ConvexError("forbidden");
    }
    const updates: Partial<Doc<"students">> = {};
    if (args.nameAr !== undefined) updates.nameAr = args.nameAr;
    if (args.nameEn !== undefined) updates.nameEn = args.nameEn;
    if (args.dob !== undefined) updates.dob = args.dob;
    if (args.sex !== undefined) updates.sex = args.sex;
    if (args.guardians !== undefined) updates.guardians = args.guardians;
    if (args.health !== undefined) updates.health = args.health;
    if (args.consentPhotos !== undefined) {
      updates.consent = { photos: args.consentPhotos };
    }
    if (Object.keys(updates).length > 0) {
      await ctx.db.patch("students", args.studentId, updates);
    }

    if (args.classroomId !== undefined) {
      const classroom = await ctx.db.get("classrooms", args.classroomId);
      if (classroom === null || classroom.nurseryId !== args.nurseryId) {
        throw new ConvexError("forbidden");
      }
      const { enrollment, yearId } = await activeYearEnrollment(
        ctx,
        args.nurseryId,
        args.studentId,
      );
      if (enrollment !== null) {
        if (enrollment.classroomId !== args.classroomId) {
          await ctx.db.patch("enrollments", enrollment._id, {
            classroomId: args.classroomId,
          });
        }
      } else {
        await ctx.db.insert("enrollments", {
          nurseryId: args.nurseryId,
          studentId: args.studentId,
          classroomId: args.classroomId,
          yearId,
        });
      }
    }
    return null;
  },
});

export const setStatus = mutation({
  args: {
    nurseryId: v.id("nurseries"),
    studentId: v.id("students"),
    status: statusValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId, ["admin"]);
    const student = await ctx.db.get("students", args.studentId);
    if (student === null || student.nurseryId !== args.nurseryId) {
      throw new ConvexError("forbidden");
    }
    await ctx.db.patch("students", args.studentId, { status: args.status });
    return null;
  },
});

export const generateUploadUrl = mutation({
  args: { nurseryId: v.id("nurseries") },
  returns: v.string(),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId, ["admin"]);
    return await ctx.storage.generateUploadUrl();
  },
});

export const setPhoto = mutation({
  args: {
    nurseryId: v.id("nurseries"),
    studentId: v.id("students"),
    storageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId, ["admin"]);
    const student = await ctx.db.get("students", args.studentId);
    if (student === null || student.nurseryId !== args.nurseryId) {
      throw new ConvexError("forbidden");
    }
    if (!student.consent.photos) {
      throw new ConvexError("no_photo_consent");
    }
    if (student.photoId !== undefined && student.photoId !== args.storageId) {
      await ctx.storage.delete(student.photoId);
    }
    await ctx.db.patch("students", args.studentId, { photoId: args.storageId });
    return null;
  },
});

export const removePhoto = mutation({
  args: {
    nurseryId: v.id("nurseries"),
    studentId: v.id("students"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId, ["admin"]);
    const student = await ctx.db.get("students", args.studentId);
    if (student === null || student.nurseryId !== args.nurseryId) {
      throw new ConvexError("forbidden");
    }
    if (student.photoId !== undefined) {
      await ctx.storage.delete(student.photoId);
      await ctx.db.patch("students", args.studentId, { photoId: undefined });
    }
    return null;
  },
});
