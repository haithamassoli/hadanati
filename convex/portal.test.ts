/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import rateLimiterSchema from "../node_modules/@convex-dev/rate-limiter/src/component/schema";
import schema from "./schema";
import { todayISO } from "./lib/shared";

const modules = import.meta.glob("./**/*.ts");
const rateLimiterModules = import.meta.glob(
  "../node_modules/@convex-dev/rate-limiter/src/component/**/*.ts",
);

const AUTH_ID = "ba_user_admin";

/** Two students (A, B) in one classroom, with data + a code for each. */
async function setup() {
  const t = convexTest(schema, modules);
  t.registerComponent("rateLimiter", rateLimiterSchema, rateLimiterModules);
  const seeded = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      authId: AUTH_ID,
      name: "Admin",
      locale: "ar",
    });
    const nurseryId = await ctx.db.insert("nurseries", {
      name: "حضانة الاختبار",
      settings: { locale: "ar", weekStart: "sun" },
      activeYear: { yearId: "2026-2027", start: "2026-06-01", end: "2027-06-30" },
    });
    await ctx.db.insert("memberships", { userId, nurseryId, role: "admin" });
    const stageId = await ctx.db.insert("stages", {
      nurseryId,
      name: "Stage",
      order: 1,
    });
    const classroomId = await ctx.db.insert("classrooms", {
      nurseryId,
      stageId,
      name: "صف القمر",
      teacherIds: [userId],
    });
    const makeStudent = async (nameAr: string) => {
      const studentId = await ctx.db.insert("students", {
        nurseryId,
        nameAr,
        dob: "2023-01-01",
        sex: "f",
        guardians: [],
        consent: { photos: false },
        status: "active",
      });
      await ctx.db.insert("enrollments", {
        nurseryId,
        studentId,
        classroomId,
        yearId: "2026-2027",
      });
      return studentId;
    };
    const studentA = await makeStudent("ألف");
    const studentB = await makeStudent("باء");
    return { userId, nurseryId, stageId, classroomId, studentA, studentB };
  });
  const asAdmin = t.withIdentity({ subject: AUTH_ID });
  const { code: codeA } = await asAdmin.mutation(api.accessCodes.generate, {
    nurseryId: seeded.nurseryId,
    studentId: seeded.studentA,
  });
  const { code: codeB } = await asAdmin.mutation(api.accessCodes.generate, {
    nurseryId: seeded.nurseryId,
    studentId: seeded.studentB,
  });
  return { t, asAdmin, codeA, codeB, ...seeded };
}

test("portal scoping: code A only sees student A's progress and inbox", async () => {
  const { t, asAdmin, codeA, codeB, nurseryId, classroomId, studentA, studentB } =
    await setup();

  // Evaluation for A (week 2) and B (week 3); absence for B only.
  await asAdmin.mutation(api.evaluations.upsert, {
    nurseryId,
    studentId: studentA,
    yearId: "2026-2027",
    week: 2,
    scores: { academic: 5, social: 4, motor: 3, behavioral: 2 },
  });
  await asAdmin.mutation(api.evaluations.upsert, {
    nurseryId,
    studentId: studentB,
    yearId: "2026-2027",
    week: 3,
    scores: { academic: 1, social: 1, motor: 1, behavioral: 1 },
  });
  await asAdmin.mutation(api.attendance.upsert, {
    nurseryId,
    classroomId,
    studentId: studentB,
    date: todayISO(),
    status: "absent",
  });

  const progressA = await t.query(api.portal.progress, { code: codeA });
  expect(progressA).toHaveLength(1);
  expect(progressA[0].week).toBe(2);

  const inboxA = await t.query(api.portal.inbox, { code: codeA });
  expect(inboxA.map((n) => n.type)).toEqual(["evaluation"]);

  const inboxB = await t.query(api.portal.inbox, { code: codeB });
  expect(inboxB.map((n) => n.type).sort()).toEqual(["absence", "evaluation"]);

  // A cannot mark B's notification read.
  const absenceB = inboxB.find((n) => n.type === "absence");
  await expect(
    t.mutation(api.portal.markRead, {
      code: codeA,
      notificationId: absenceB!._id,
    }),
  ).rejects.toThrow(/forbidden/);
  await t.mutation(api.portal.markRead, {
    code: codeB,
    notificationId: absenceB!._id,
  });
  const inboxBAfter = await t.query(api.portal.inbox, { code: codeB });
  expect(
    inboxBAfter.find((n) => n._id === absenceB!._id)?.readAt,
  ).toBeTypeOf("number");
});

test("portal home: attendance chip, latest evaluation, balance", async () => {
  const { t, asAdmin, codeA, nurseryId, classroomId, studentA } = await setup();

  await asAdmin.mutation(api.attendance.upsert, {
    nurseryId,
    classroomId,
    studentId: studentA,
    date: todayISO(),
    status: "late",
    note: "تأخر",
  });
  await asAdmin.mutation(api.evaluations.upsert, {
    nurseryId,
    studentId: studentA,
    yearId: "2026-2027",
    week: 4,
    scores: { academic: 3, social: 3, motor: 3, behavioral: 3 },
  });
  await t.run(async (ctx) => {
    const invoiceId = await ctx.db.insert("invoices", {
      nurseryId,
      studentId: studentA,
      amountFils: 120000,
      dueDate: "2026-07-01",
      status: "issued",
    });
    const admin = await ctx.db.query("users").take(1);
    await ctx.db.insert("payments", {
      nurseryId,
      invoiceId,
      amountFils: 20000,
      method: "cash",
      paidAt: todayISO(),
      receivedBy: admin[0]._id,
    });
    // Paid + draft invoices must not count toward the balance.
    await ctx.db.insert("invoices", {
      nurseryId,
      studentId: studentA,
      amountFils: 999000,
      dueDate: "2026-07-01",
      status: "paid",
    });
  });

  const home = await t.query(api.portal.home, { code: codeA });
  expect(home).not.toBeNull();
  expect(home!.student.nameAr).toBe("ألف");
  expect(home!.nurseryName).toBe("حضانة الاختبار");
  expect(home!.classroomName).toBe("صف القمر");
  expect(home!.todayAttendance).toMatchObject({ status: "late", note: "تأخر" });
  expect(home!.latestEvaluation).toMatchObject({ week: 4 });
  expect(home!.balanceFils).toBe(100000);
  expect(home!.yearId).toBe("2026-2027");
  expect(home!.yearStart).toBe("2026-06-01");

  // Invalid code → null, not an error.
  expect(await t.query(api.portal.home, { code: "AAAA-AAAA-AAAA" })).toBeNull();
});

test("announcementsFeed: nursery-wide + own classroom only", async () => {
  const { t, asAdmin, codeA, nurseryId, stageId, classroomId } = await setup();

  const otherClassroomId = await t.run(async (ctx) =>
    ctx.db.insert("classrooms", {
      nurseryId,
      stageId,
      name: "صف آخر",
      teacherIds: [],
    }),
  );
  await asAdmin.mutation(api.announcements.create, {
    nurseryId,
    title: "إعلان عام",
    body: "للجميع",
  });
  await asAdmin.mutation(api.announcements.create, {
    nurseryId,
    classroomId,
    title: "إعلان الصف",
    body: "لصفنا",
  });
  await asAdmin.mutation(api.announcements.create, {
    nurseryId,
    classroomId: otherClassroomId,
    title: "إعلان صف آخر",
    body: "ليس لنا",
  });

  const feed = await t.query(api.portal.announcementsFeed, { code: codeA });
  expect(feed.map((a) => a.title).sort()).toEqual(["إعلان الصف", "إعلان عام"]);
  // Newest first.
  expect(feed[0].title).toBe("إعلان الصف");
});
