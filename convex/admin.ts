import { ConvexError, v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { createAuth } from "./auth";
import { feePlanCadenceValidator, localeValidator } from "./schema";
import { academicWeek, todayISO } from "./lib/shared";
import { emitNotifications } from "./lib/notify";
import { generateRawCode, hashCode, normalizeCode } from "./lib/codes";
import {
  generateInvoicesForNursery,
  invoicePaidFils,
  recomputeInvoiceStatus,
  sweepOverdueForNursery,
} from "./lib/finance";

/**
 * Concierge onboarding (FR-TEN-2). Run with:
 *
 * npx convex run admin:createNursery '{"name":"حضانة النموذج","adminEmail":"admin@example.com","adminPassword":"password123","adminName":"مديرة الحضانة","yearId":"2026-2027","yearStart":"2026-09-01","yearEnd":"2027-06-30"}'
 */
export const createNursery = internalAction({
  args: {
    name: v.string(),
    adminEmail: v.string(),
    adminPassword: v.string(),
    adminName: v.string(),
    yearId: v.string(),
    yearStart: v.string(), // "YYYY-MM-DD"
    yearEnd: v.string(), // "YYYY-MM-DD"
  },
  returns: v.object({
    nurseryId: v.id("nurseries"),
    userId: v.id("users"),
  }),
  handler: async (ctx, args) => {
    // Create the Better Auth credential user server-side. The user.onCreate
    // trigger (convex/auth.ts) mirrors it into our `users` table.
    const auth = createAuth(ctx);
    const signUp = await auth.api.signUpEmail({
      body: {
        email: args.adminEmail,
        password: args.adminPassword,
        name: args.adminName,
      },
    });
    const result: { nurseryId: Id<"nurseries">; userId: Id<"users"> } =
      await ctx.runMutation(internal.admin.finishCreateNursery, {
        authId: signUp.user.id,
        name: args.name,
        yearId: args.yearId,
        yearStart: args.yearStart,
        yearEnd: args.yearEnd,
      });
    return result;
  },
});

export const finishCreateNursery = internalMutation({
  args: {
    authId: v.string(),
    name: v.string(),
    yearId: v.string(),
    yearStart: v.string(),
    yearEnd: v.string(),
  },
  returns: v.object({
    nurseryId: v.id("nurseries"),
    userId: v.id("users"),
  }),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", args.authId))
      .unique();
    if (user === null) {
      throw new ConvexError("user_not_created");
    }
    const nurseryId = await ctx.db.insert("nurseries", {
      name: args.name,
      settings: { locale: "ar", weekStart: "sun" },
      activeYear: {
        yearId: args.yearId,
        start: args.yearStart,
        end: args.yearEnd,
      },
    });
    await ctx.db.insert("memberships", {
      userId: user._id,
      nurseryId,
      role: "admin",
    });
    return { nurseryId, userId: user._id };
  },
});

const SPIKE_STUDENTS: Array<{ nameAr: string; sex: "m" | "f" }> = [
  { nameAr: "ليان الخطيب", sex: "f" },
  { nameAr: "عمر الزعبي", sex: "m" },
  { nameAr: "جود العدوان", sex: "f" },
  { nameAr: "كريم النابلسي", sex: "m" },
  { nameAr: "سارة الحموري", sex: "f" },
  { nameAr: "يوسف العمري", sex: "m" },
  { nameAr: "لين أبو زيد", sex: "f" },
  { nameAr: "آدم الرواشدة", sex: "m" },
  { nameAr: "مريم الشريف", sex: "f" },
  { nameAr: "زيد الطراونة", sex: "m" },
  { nameAr: "تالا المجالي", sex: "f" },
  { nameAr: "حمزة العبادي", sex: "m" },
  { nameAr: "جنى الصمادي", sex: "f" },
  { nameAr: "إبراهيم الخصاونة", sex: "m" },
  { nameAr: "ميرا الحياري", sex: "f" },
  { nameAr: "عبدالله البطاينة", sex: "m" },
  { nameAr: "سلمى العزام", sex: "f" },
  { nameAr: "فارس الشوابكة", sex: "m" },
  { nameAr: "نور المومني", sex: "f" },
  { nameAr: "ليث الجراح", sex: "m" },
  { nameAr: "دانة القضاة", sex: "f" },
  { nameAr: "أنس الروسان", sex: "m" },
  { nameAr: "رهف العجلوني", sex: "f" },
  { nameAr: "محمد الكايد", sex: "m" },
  { nameAr: "لارا الحوراني", sex: "f" },
];

/**
 * Offline-spike seed data (M0). Run with:
 *
 * npx convex run admin:seedSpike '{"nurseryId":"<id from createNursery>"}'
 */
export const seedSpike = internalMutation({
  args: { nurseryId: v.id("nurseries") },
  returns: v.object({
    stageId: v.id("stages"),
    classroomId: v.id("classrooms"),
    studentCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const nursery = await ctx.db.get("nurseries", args.nurseryId);
    if (nursery === null) {
      throw new ConvexError("nursery_not_found");
    }
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_nursery_and_user", (q) => q.eq("nurseryId", args.nurseryId))
      .take(50);
    const admin = memberships.find((m) => m.role === "admin");
    if (admin === undefined) {
      throw new ConvexError("no_admin_membership");
    }

    const stageId = await ctx.db.insert("stages", {
      nurseryId: args.nurseryId,
      name: "التمهيدي",
      order: 1,
    });
    const classroomId = await ctx.db.insert("classrooms", {
      nurseryId: args.nurseryId,
      stageId,
      name: "صف الفراشات",
      teacherIds: [admin.userId],
    });

    const yearId = nursery.activeYear.yearId;
    for (const [i, s] of SPIKE_STUDENTS.entries()) {
      const studentId = await ctx.db.insert("students", {
        nurseryId: args.nurseryId,
        nameAr: s.nameAr,
        dob: `202${2 + (i % 2)}-0${(i % 9) + 1}-15`,
        sex: s.sex,
        guardians: [
          { name: `ولي أمر ${s.nameAr}`, phone: `07900000${String(i).padStart(2, "0")}`, relation: "أب" },
        ],
        consent: { photos: false },
        status: "active",
      });
      await ctx.db.insert("enrollments", {
        nurseryId: args.nurseryId,
        studentId,
        classroomId,
        yearId,
      });
    }

    return { stageId, classroomId, studentCount: SPIKE_STUDENTS.length };
  },
});

const DEMO_STUDENTS: Array<{ nameAr: string; sex: "m" | "f" }> = [
  { nameAr: "هاشم النعيمات", sex: "m" },
  { nameAr: "جوري الفايز", sex: "f" },
  { nameAr: "قصي الدباس", sex: "m" },
  { nameAr: "ريتال الزيود", sex: "f" },
  { nameAr: "أوس الحديد", sex: "m" },
  { nameAr: "ماسة العواملة", sex: "f" },
  { nameAr: "تيم الرحاحلة", sex: "m" },
  { nameAr: "ليليا السعايدة", sex: "f" },
];

/**
 * M1 demo seed: adds a SECOND stage + classroom with 8 students, a teacher
 * account assigned to that classroom, and an accountant account — so UI
 * agents can test role scoping. Run with:
 *
 * npx convex run admin:seedDemo '{"nurseryId":"<id>"}'
 *
 * Credentials: teacher@hadanati.test / TeacherPass2026!
 *              accountant@hadanati.test / AccountantPass2026!
 */
export const seedDemo = internalAction({
  args: { nurseryId: v.id("nurseries") },
  returns: v.object({
    stageId: v.id("stages"),
    classroomId: v.id("classrooms"),
    teacherUserId: v.id("users"),
    accountantUserId: v.id("users"),
    studentCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const auth = createAuth(ctx);
    const teacherSignUp = await auth.api.signUpEmail({
      body: {
        email: "teacher@hadanati.test",
        password: "TeacherPass2026!",
        name: "رنا المعلمة",
      },
    });
    const accountantSignUp = await auth.api.signUpEmail({
      body: {
        email: "accountant@hadanati.test",
        password: "AccountantPass2026!",
        name: "هالة المحاسبة",
      },
    });
    const result: {
      stageId: Id<"stages">;
      classroomId: Id<"classrooms">;
      teacherUserId: Id<"users">;
      accountantUserId: Id<"users">;
      studentCount: number;
    } = await ctx.runMutation(internal.admin.finishSeedDemo, {
      nurseryId: args.nurseryId,
      teacherAuthId: teacherSignUp.user.id,
      accountantAuthId: accountantSignUp.user.id,
    });
    return result;
  },
});

export const finishSeedDemo = internalMutation({
  args: {
    nurseryId: v.id("nurseries"),
    teacherAuthId: v.string(),
    accountantAuthId: v.string(),
  },
  returns: v.object({
    stageId: v.id("stages"),
    classroomId: v.id("classrooms"),
    teacherUserId: v.id("users"),
    accountantUserId: v.id("users"),
    studentCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const nursery = await ctx.db.get("nurseries", args.nurseryId);
    if (nursery === null) {
      throw new ConvexError("nursery_not_found");
    }
    const findUser = async (authId: string) => {
      const user = await ctx.db
        .query("users")
        .withIndex("by_authId", (q) => q.eq("authId", authId))
        .unique();
      if (user === null) {
        throw new ConvexError("user_not_created");
      }
      return user;
    };
    const teacher = await findUser(args.teacherAuthId);
    const accountant = await findUser(args.accountantAuthId);

    await ctx.db.insert("memberships", {
      userId: teacher._id,
      nurseryId: args.nurseryId,
      role: "teacher",
    });
    await ctx.db.insert("memberships", {
      userId: accountant._id,
      nurseryId: args.nurseryId,
      role: "accountant",
    });

    const stageId = await ctx.db.insert("stages", {
      nurseryId: args.nurseryId,
      name: "الروضة",
      order: 2,
    });
    const classroomId = await ctx.db.insert("classrooms", {
      nurseryId: args.nurseryId,
      stageId,
      name: "صف العصافير",
      teacherIds: [teacher._id],
    });

    const yearId = nursery.activeYear.yearId;
    for (const [i, s] of DEMO_STUDENTS.entries()) {
      const studentId = await ctx.db.insert("students", {
        nurseryId: args.nurseryId,
        nameAr: s.nameAr,
        dob: `202${2 + (i % 2)}-0${(i % 9) + 1}-10`,
        sex: s.sex,
        guardians: [
          {
            name: `ولي أمر ${s.nameAr}`,
            phone: `07910000${String(i).padStart(2, "0")}`,
            relation: "أب",
          },
        ],
        consent: { photos: false },
        status: "active",
      });
      await ctx.db.insert("enrollments", {
        nurseryId: args.nurseryId,
        studentId,
        classroomId,
        yearId,
      });
    }

    return {
      stageId,
      classroomId,
      teacherUserId: teacher._id,
      accountantUserId: accountant._id,
      studentCount: DEMO_STUDENTS.length,
    };
  },
});

/**
 * M2 acceptance reset (AC-OFF specs): deletes ONE day's attendance across
 * the nursery plus that academic week's evaluations so the specs rerun
 * cleanly on the same date. syncLog is deliberately untouched — the
 * exactly-once dedupe must survive resets. Run with:
 *
 * npx convex run admin:resetDay '{"nurseryId":"<id>","date":"YYYY-MM-DD"}'
 */
export const resetDay = internalMutation({
  args: { nurseryId: v.id("nurseries"), date: v.string() },
  returns: v.object({
    week: v.number(),
    deletedAttendance: v.number(),
    deletedEvaluations: v.number(),
  }),
  handler: async (ctx, args) => {
    const nursery = await ctx.db.get("nurseries", args.nurseryId);
    if (nursery === null) {
      throw new ConvexError("nursery_not_found");
    }
    const week = academicWeek(args.date, nursery.activeYear.start);
    const classrooms = await ctx.db
      .query("classrooms")
      .withIndex("by_nurseryId", (q) => q.eq("nurseryId", args.nurseryId))
      .take(100);
    let deletedAttendance = 0;
    for (const classroom of classrooms) {
      const rows = await ctx.db
        .query("attendance")
        .withIndex("by_nursery_and_classroom_and_date", (q) =>
          q
            .eq("nurseryId", args.nurseryId)
            .eq("classroomId", classroom._id)
            .eq("date", args.date),
        )
        .take(500);
      for (const row of rows) {
        await ctx.db.delete("attendance", row._id);
        deletedAttendance += 1;
      }
    }
    // Acceptance-scale scan (dev deployment): evaluations lack a week index.
    const evaluationIds: Id<"evaluations">[] = [];
    for await (const row of ctx.db.query("evaluations")) {
      if (
        row.nurseryId === args.nurseryId &&
        row.yearId === nursery.activeYear.yearId &&
        row.week === week
      ) {
        evaluationIds.push(row._id);
      }
    }
    for (const id of evaluationIds) {
      await ctx.db.delete("evaluations", id);
    }
    return { week, deletedAttendance, deletedEvaluations: evaluationIds.length };
  },
});

/**
 * AC-OFF verification: every attendance row for a date + that week's
 * evaluations. Run with:
 *
 * npx convex run admin:dayReport '{"nurseryId":"<id>","date":"YYYY-MM-DD"}'
 */
export const dayReport = internalQuery({
  args: { nurseryId: v.id("nurseries"), date: v.string() },
  returns: v.object({
    week: v.number(),
    attendance: v.array(
      v.object({
        studentId: v.string(),
        classroomId: v.string(),
        status: v.string(),
      }),
    ),
    evaluations: v.array(
      v.object({
        studentId: v.string(),
        scores: v.object({
          academic: v.number(),
          social: v.number(),
          motor: v.number(),
          behavioral: v.number(),
        }),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const nursery = await ctx.db.get("nurseries", args.nurseryId);
    if (nursery === null) {
      throw new ConvexError("nursery_not_found");
    }
    const week = academicWeek(args.date, nursery.activeYear.start);
    const classrooms = await ctx.db
      .query("classrooms")
      .withIndex("by_nurseryId", (q) => q.eq("nurseryId", args.nurseryId))
      .take(100);
    const attendance = [];
    for (const classroom of classrooms) {
      const rows = await ctx.db
        .query("attendance")
        .withIndex("by_nursery_and_classroom_and_date", (q) =>
          q
            .eq("nurseryId", args.nurseryId)
            .eq("classroomId", classroom._id)
            .eq("date", args.date),
        )
        .take(500);
      for (const row of rows) {
        attendance.push({
          studentId: row.studentId as string,
          classroomId: row.classroomId as string,
          status: row.status as string,
        });
      }
    }
    const evaluations = [];
    for await (const row of ctx.db.query("evaluations")) {
      if (
        row.nurseryId === args.nurseryId &&
        row.yearId === nursery.activeYear.yearId &&
        row.week === week
      ) {
        evaluations.push({
          studentId: row.studentId as string,
          scores: row.scores,
        });
      }
    }
    return { week, attendance, evaluations };
  },
});

/**
 * M2 acceptance: newest notifications, optionally scoped to one student.
 * Run with:
 *
 * npx convex run admin:latestNotifications '{"nurseryId":"<id>","studentId":"<id>"}'
 */
export const latestNotifications = internalQuery({
  args: {
    nurseryId: v.id("nurseries"),
    studentId: v.optional(v.id("students")),
  },
  returns: v.array(
    v.object({
      _id: v.string(),
      type: v.string(),
      studentId: v.optional(v.string()),
      read: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const rows =
      args.studentId !== undefined
        ? await ctx.db
            .query("notifications")
            .withIndex("by_target_studentId", (q) =>
              q.eq("target.studentId", args.studentId),
            )
            .order("desc")
            .take(50)
        : await ctx.db
            .query("notifications")
            .withIndex("by_nurseryId", (q) => q.eq("nurseryId", args.nurseryId))
            .order("desc")
            .take(50);
    return rows
      .filter((row) => row.nurseryId === args.nurseryId)
      .map((row) => ({
        _id: row._id as string,
        type: row.type,
        studentId: row.target.studentId as string | undefined,
        read: row.readAt !== undefined,
      }));
  },
});

/**
 * M2 acceptance: emit ONE absence notification through the real pipeline
 * (insert + scheduled push delivery) so the portal markRead E2E always has
 * a fresh unread item, however often it reruns. Run with:
 *
 * npx convex run admin:emitTestNotification '{"nurseryId":"<id>","studentId":"<id>"}'
 */
export const emitTestNotification = internalMutation({
  args: { nurseryId: v.id("nurseries"), studentId: v.id("students") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const student = await ctx.db.get("students", args.studentId);
    if (student === null || student.nurseryId !== args.nurseryId) {
      throw new ConvexError("student_not_found");
    }
    const [notificationId] = await emitNotifications(ctx, args.nurseryId, [
      {
        studentId: args.studentId,
        type: "absence",
        payload: { date: todayISO() },
      },
    ]);
    return notificationId as string;
  },
});

/**
 * Concierge cleanup: fully removes a student and every dependent record
 * (enrollments, attendance, evaluations, access codes + their push subs,
 * notifications). Used to clear leftover UI-test students from dev data.
 *
 * npx convex run admin:removeStudent '{"nurseryId":"<id>","studentId":"<id>"}'
 */
export const removeStudent = internalMutation({
  args: { nurseryId: v.id("nurseries"), studentId: v.id("students") },
  returns: v.record(v.string(), v.number()),
  handler: async (ctx, args) => {
    const student = await ctx.db.get("students", args.studentId);
    if (student === null || student.nurseryId !== args.nurseryId) {
      throw new ConvexError("student_not_found");
    }
    const deleted: Record<string, number> = {
      enrollments: 0,
      attendance: 0,
      evaluations: 0,
      accessCodes: 0,
      pushSubs: 0,
      notifications: 0,
    };
    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_nursery_and_studentId", (q) =>
        q.eq("nurseryId", args.nurseryId).eq("studentId", args.studentId),
      )
      .take(100);
    for (const row of enrollments) {
      await ctx.db.delete("enrollments", row._id);
      deleted.enrollments += 1;
    }
    const attendance = await ctx.db
      .query("attendance")
      .withIndex("by_student_and_date", (q) => q.eq("studentId", args.studentId))
      .take(1000);
    for (const row of attendance) {
      await ctx.db.delete("attendance", row._id);
      deleted.attendance += 1;
    }
    const evaluations = await ctx.db
      .query("evaluations")
      .withIndex("by_student_and_yearId_and_week", (q) =>
        q.eq("studentId", args.studentId),
      )
      .take(1000);
    for (const row of evaluations) {
      await ctx.db.delete("evaluations", row._id);
      deleted.evaluations += 1;
    }
    const accessCodes = await ctx.db
      .query("accessCodes")
      .withIndex("by_studentId", (q) => q.eq("studentId", args.studentId))
      .take(1000);
    for (const code of accessCodes) {
      const subs = await ctx.db
        .query("pushSubs")
        .withIndex("by_owner_accessCodeId", (q) =>
          q.eq("owner.accessCodeId", code._id),
        )
        .take(100);
      for (const sub of subs) {
        await ctx.db.delete("pushSubs", sub._id);
        deleted.pushSubs += 1;
      }
      await ctx.db.delete("accessCodes", code._id);
      deleted.accessCodes += 1;
    }
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_target_studentId", (q) =>
        q.eq("target.studentId", args.studentId),
      )
      .take(1000);
    for (const row of notifications) {
      await ctx.db.delete("notifications", row._id);
      deleted.notifications += 1;
    }
    await ctx.db.delete("students", args.studentId);
    return deleted;
  },
});

/**
 * M2 acceptance-test verification. Run with:
 *
 * npx convex run admin:portalReport '{"nurseryId":"<id>"}'
 */
export const portalReport = internalQuery({
  args: { nurseryId: v.id("nurseries") },
  returns: v.object({
    accessCodeCount: v.number(),
    notificationCount: v.number(),
    pushSubCount: v.number(),
    announcementCount: v.number(),
  }),
  handler: async (ctx, args) => {
    // Acceptance-scale bounded counts (dev deployment).
    const accessCodes = await ctx.db
      .query("accessCodes")
      .withIndex("by_nurseryId", (q) => q.eq("nurseryId", args.nurseryId))
      .take(4000);
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_nurseryId", (q) => q.eq("nurseryId", args.nurseryId))
      .take(4000);
    const pushSubs = await ctx.db
      .query("pushSubs")
      .withIndex("by_nurseryId", (q) => q.eq("nurseryId", args.nurseryId))
      .take(4000);
    const announcements = await ctx.db
      .query("announcements")
      .withIndex("by_nurseryId", (q) => q.eq("nurseryId", args.nurseryId))
      .take(4000);
    return {
      accessCodeCount: accessCodes.length,
      notificationCount: notifications.length,
      pushSubCount: pushSubs.length,
      announcementCount: announcements.length,
    };
  },
});

const onboardStudentValidator = v.object({
  nameAr: v.string(),
  dob: v.string(), // "YYYY-MM-DD"
  sex: v.union(v.literal("m"), v.literal("f")),
  guardianName: v.string(),
  guardianPhone: v.string(),
  guardianRelation: v.string(),
});

const onboardCodesValidator = v.array(
  v.object({ studentNameAr: v.string(), code: v.string() }),
);

/**
 * ≤1h concierge onboarding (PRD §4): creates the WHOLE tenant in one call —
 * nursery + admin credential user + stages + classrooms + students (with
 * guardian + consent=false) + active-year enrollments (with the fee plan,
 * when given) + one parent access code PER student. Returns the nurseryId
 * and every raw code (shown once, never stored — only hashes persist).
 *
 * NOT idempotent: Better Auth rejects a duplicate adminEmail, so a rerun
 * with the same email fails before writing anything — acceptable; use a
 * fresh email (or delete the auth user) to retry.
 *
 * Ceiling: each student costs ~3 writes (student + enrollment + code);
 * keep one call under ~1500 students to stay inside the 8K write limit.
 *
 * Run with:
 *
 * npx convex run admin:onboardNursery '{
 *   "name": "حضانة البراعم",
 *   "adminEmail": "admin@baraem.example",
 *   "adminPassword": "StrongPass2026!",
 *   "adminName": "مديرة الحضانة",
 *   "yearId": "2026-2027",
 *   "yearStart": "2026-09-01",
 *   "yearEnd": "2027-06-30",
 *   "locale": "ar",
 *   "stages": [
 *     { "name": "التمهيدي", "classrooms": [
 *       { "name": "صف الفراشات", "students": [
 *         { "nameAr": "ليان الخطيب", "dob": "2023-04-15", "sex": "f",
 *           "guardianName": "أحمد الخطيب", "guardianPhone": "0790000001",
 *           "guardianRelation": "أب" }
 *       ] }
 *     ] }
 *   ],
 *   "feePlan": { "name": "قسط شهري", "amountFils": 85000, "cadence": "monthly" }
 * }'
 */
export const onboardNursery = internalAction({
  args: {
    name: v.string(),
    adminEmail: v.string(),
    adminPassword: v.string(),
    adminName: v.string(),
    yearId: v.string(),
    yearStart: v.string(), // "YYYY-MM-DD"
    yearEnd: v.string(), // "YYYY-MM-DD"
    locale: v.optional(localeValidator),
    stages: v.array(
      v.object({
        name: v.string(),
        classrooms: v.array(
          v.object({
            name: v.string(),
            students: v.array(onboardStudentValidator),
          }),
        ),
      }),
    ),
    feePlan: v.optional(
      v.object({
        name: v.string(),
        amountFils: v.number(),
        cadence: feePlanCadenceValidator,
      }),
    ),
  },
  returns: v.object({
    nurseryId: v.id("nurseries"),
    codes: onboardCodesValidator,
  }),
  handler: async (ctx, args) => {
    // Better Auth credential user first (throws on duplicate email — see
    // the docstring). user.onCreate mirrors it into our `users` table.
    const auth = createAuth(ctx);
    const signUp = await auth.api.signUpEmail({
      body: {
        email: args.adminEmail,
        password: args.adminPassword,
        name: args.adminName,
      },
    });
    const result: {
      nurseryId: Id<"nurseries">;
      codes: Array<{ studentNameAr: string; code: string }>;
    } = await ctx.runMutation(internal.admin.finishOnboardNursery, {
      authId: signUp.user.id,
      name: args.name,
      yearId: args.yearId,
      yearStart: args.yearStart,
      yearEnd: args.yearEnd,
      locale: args.locale,
      stages: args.stages,
      feePlan: args.feePlan,
    });
    return result;
  },
});

export const finishOnboardNursery = internalMutation({
  args: {
    authId: v.string(),
    name: v.string(),
    yearId: v.string(),
    yearStart: v.string(),
    yearEnd: v.string(),
    locale: v.optional(localeValidator),
    stages: v.array(
      v.object({
        name: v.string(),
        classrooms: v.array(
          v.object({
            name: v.string(),
            students: v.array(onboardStudentValidator),
          }),
        ),
      }),
    ),
    feePlan: v.optional(
      v.object({
        name: v.string(),
        amountFils: v.number(),
        cadence: feePlanCadenceValidator,
      }),
    ),
  },
  returns: v.object({
    nurseryId: v.id("nurseries"),
    codes: onboardCodesValidator,
  }),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", args.authId))
      .unique();
    if (user === null) {
      throw new ConvexError("user_not_created");
    }
    if (
      args.feePlan !== undefined &&
      (!Number.isInteger(args.feePlan.amountFils) ||
        args.feePlan.amountFils <= 0)
    ) {
      throw new ConvexError("invalid_amount");
    }

    const nurseryId = await ctx.db.insert("nurseries", {
      name: args.name,
      settings: { locale: args.locale ?? "ar", weekStart: "sun" },
      activeYear: {
        yearId: args.yearId,
        start: args.yearStart,
        end: args.yearEnd,
      },
    });
    await ctx.db.insert("memberships", {
      userId: user._id,
      nurseryId,
      role: "admin",
    });

    const feePlanId =
      args.feePlan !== undefined
        ? await ctx.db.insert("feePlans", {
            nurseryId,
            name: args.feePlan.name,
            amountFils: args.feePlan.amountFils,
            cadence: args.feePlan.cadence,
          })
        : undefined;

    const codes: Array<{ studentNameAr: string; code: string }> = [];
    for (const [stageIndex, stage] of args.stages.entries()) {
      const stageId = await ctx.db.insert("stages", {
        nurseryId,
        name: stage.name,
        order: stageIndex + 1,
      });
      for (const classroom of stage.classrooms) {
        const classroomId = await ctx.db.insert("classrooms", {
          nurseryId,
          stageId,
          name: classroom.name,
          teacherIds: [],
        });
        for (const s of classroom.students) {
          const studentId = await ctx.db.insert("students", {
            nurseryId,
            nameAr: s.nameAr,
            dob: s.dob,
            sex: s.sex,
            guardians: [
              {
                name: s.guardianName,
                phone: s.guardianPhone,
                relation: s.guardianRelation,
              },
            ],
            consent: { photos: false },
            status: "active",
          });
          await ctx.db.insert("enrollments", {
            nurseryId,
            studentId,
            classroomId,
            yearId: args.yearId,
            feePlanId,
          });
          const raw = generateRawCode();
          await ctx.db.insert("accessCodes", {
            nurseryId,
            studentId,
            codeHash: await hashCode(normalizeCode(raw)),
            active: true,
          });
          codes.push({ studentNameAr: s.nameAr, code: raw });
        }
      }
    }

    return { nurseryId, codes };
  },
});

/**
 * M3 dev-tenant finance seed (data setup for the UI agents). Deterministic
 * and safe to rerun:
 *  1. finds/creates the monthly fee plan "قسط شهري" (85.000 JOD),
 *  2. attaches it to 3 active-year enrollments (لينا الاختبار first),
 *  3. generates the CURRENT month's invoices (idempotent),
 *  4. records ONE 30.000 JOD cash partial payment on لينا's invoice
 *     (skipped when the invoice already has payments),
 *  5. creates one manual invoice (50.000 JOD, "رسوم أنشطة") due the 10th of
 *     LAST month on the second plan student (skipped when it exists),
 *  6. runs the overdue-notifier sweep once (stamps overdueNotifiedAt, so a
 *     rerun emits nothing new).
 *
 * npx convex run admin:seedFinanceDemo '{"nurseryId":"<id>"}'
 */
export const seedFinanceDemo = internalMutation({
  args: { nurseryId: v.id("nurseries") },
  returns: v.object({
    feePlanId: v.id("feePlans"),
    planStudents: v.array(
      v.object({ studentId: v.id("students"), nameAr: v.string() }),
    ),
    generated: v.object({ created: v.number(), skipped: v.number() }),
    linaInvoiceId: v.union(v.id("invoices"), v.null()),
    paymentId: v.union(v.id("payments"), v.null()),
    overdueInvoiceId: v.union(v.id("invoices"), v.null()),
    overdueNotified: v.number(),
  }),
  handler: async (ctx, args) => {
    const nursery = await ctx.db.get("nurseries", args.nurseryId);
    if (nursery === null) {
      throw new ConvexError("nursery_not_found");
    }
    const yearId = nursery.activeYear.yearId;
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_nursery_and_user", (q) => q.eq("nurseryId", args.nurseryId))
      .take(50);
    const adminMembership = memberships.find((m) => m.role === "admin");
    if (adminMembership === undefined) {
      throw new ConvexError("no_admin_membership");
    }

    // 1. Fee plan.
    const plans = await ctx.db
      .query("feePlans")
      .withIndex("by_nurseryId", (q) => q.eq("nurseryId", args.nurseryId))
      .take(200);
    let plan = plans.find((p) => p.name === "قسط شهري") ?? null;
    if (plan === null) {
      const feePlanId = await ctx.db.insert("feePlans", {
        nurseryId: args.nurseryId,
        name: "قسط شهري",
        amountFils: 85000,
        cadence: "monthly",
      });
      plan = await ctx.db.get("feePlans", feePlanId);
      if (plan === null) throw new ConvexError("plan_not_created");
    }

    // 2. Pick لينا الاختبار + 2 more active students with active-year
    // enrollments; attach the plan.
    const students = await ctx.db
      .query("students")
      .withIndex("by_nurseryId_and_status", (q) =>
        q.eq("nurseryId", args.nurseryId).eq("status", "active"),
      )
      .take(300);
    const ordered = [
      ...students.filter((s) => s.nameAr.includes("لينا الاختبار")),
      ...students.filter((s) => !s.nameAr.includes("لينا الاختبار")),
    ];
    const planStudents: Array<{ student: Doc<"students">; enrollment: Doc<"enrollments"> }> = [];
    for (const student of ordered) {
      if (planStudents.length >= 3) break;
      const enrollments = await ctx.db
        .query("enrollments")
        .withIndex("by_nursery_and_studentId", (q) =>
          q.eq("nurseryId", args.nurseryId).eq("studentId", student._id),
        )
        .take(20);
      const enrollment = enrollments.find((e) => e.yearId === yearId);
      if (enrollment === undefined) continue;
      // Already on ANOTHER plan → leave alone unless we still need students.
      if (
        enrollment.feePlanId !== undefined &&
        enrollment.feePlanId !== plan._id
      ) {
        continue;
      }
      if (enrollment.feePlanId !== plan._id) {
        await ctx.db.patch("enrollments", enrollment._id, {
          feePlanId: plan._id,
        });
      }
      planStudents.push({ student, enrollment });
    }
    if (planStudents.length === 0) {
      throw new ConvexError("no_enrollable_students");
    }

    // 3. Generate the current month (idempotent).
    const period = todayISO().slice(0, 7);
    const generated = await generateInvoicesForNursery(ctx, nursery, period);

    // 4. Partial 30.000 JOD cash payment on the first (لينا) invoice.
    const lina = planStudents[0].student;
    const linaInvoices = await ctx.db
      .query("invoices")
      .withIndex("by_nursery_and_studentId", (q) =>
        q.eq("nurseryId", args.nurseryId).eq("studentId", lina._id),
      )
      .take(200);
    const linaInvoice =
      linaInvoices.find(
        (i) => i.feePlanId === plan._id && i.period === period,
      ) ?? null;
    let paymentId: Id<"payments"> | null = null;
    if (linaInvoice !== null) {
      const alreadyPaid = await invoicePaidFils(ctx, linaInvoice._id);
      if (alreadyPaid === 0) {
        paymentId = await ctx.db.insert("payments", {
          nurseryId: args.nurseryId,
          invoiceId: linaInvoice._id,
          amountFils: 30000,
          method: "cash",
          paidAt: todayISO(),
          receivedBy: adminMembership.userId,
        });
        await recomputeInvoiceStatus(ctx, linaInvoice);
      }
    }

    // 5. Manual invoice due the 10th of LAST month (→ overdue today).
    const overdueStudent =
      planStudents.length > 1 ? planStudents[1].student : lina;
    const [y, m] = period.split("-").map(Number);
    const prevMonth =
      m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
    const existingManual = (
      await ctx.db
        .query("invoices")
        .withIndex("by_nursery_and_studentId", (q) =>
          q.eq("nurseryId", args.nurseryId).eq("studentId", overdueStudent._id),
        )
        .take(200)
    ).find((i) => i.description === "رسوم أنشطة");
    let overdueInvoiceId: Id<"invoices"> | null =
      existingManual?._id ?? null;
    if (overdueInvoiceId === null) {
      overdueInvoiceId = await ctx.db.insert("invoices", {
        nurseryId: args.nurseryId,
        studentId: overdueStudent._id,
        amountFils: 50000,
        dueDate: `${prevMonth}-10`,
        description: "رسوم أنشطة",
        status: "issued",
      });
      await emitNotifications(ctx, args.nurseryId, [
        {
          studentId: overdueStudent._id,
          type: "invoice_issued",
          payload: { invoiceId: overdueInvoiceId },
        },
      ]);
    }

    // 6. Overdue sweep (once per invoice, ever).
    const overdueNotified = await sweepOverdueForNursery(ctx, args.nurseryId);

    return {
      feePlanId: plan._id,
      planStudents: planStudents.map(({ student }) => ({
        studentId: student._id,
        nameAr: student.nameAr,
      })),
      generated,
      linaInvoiceId: linaInvoice?._id ?? null,
      paymentId,
      overdueInvoiceId,
      overdueNotified,
    };
  },
});

/**
 * M3 acceptance: bounded finance row counts for the E2E idempotency
 * assertions (tests/finance.spec.ts). Run with:
 *
 * npx convex run admin:financeReport '{"nurseryId":"<id>"}'
 */
export const financeReport = internalQuery({
  args: { nurseryId: v.id("nurseries") },
  returns: v.object({
    invoiceCount: v.number(),
    paymentCount: v.number(),
  }),
  handler: async (ctx, args) => {
    // Acceptance-scale counts (dev deployment) — bounded.
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_nurseryId", (q) => q.eq("nurseryId", args.nurseryId))
      .take(4000);
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_nurseryId", (q) => q.eq("nurseryId", args.nurseryId))
      .take(4000);
    return { invoiceCount: invoices.length, paymentCount: payments.length };
  },
});
