/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { todayISO } from "./lib/shared";

const modules = import.meta.glob("./**/*.ts");

const ADMIN_AUTH = "ba_perm_admin";
const TEACHER_AUTH = "ba_perm_teacher";
const ACCOUNTANT_AUTH = "ba_perm_accountant";
const YEAR_ID = "2026-2027";

function yesterdayISO(): string {
  const t = new Date(`${todayISO()}T00:00:00Z`).getTime();
  return new Date(t - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function setup() {
  const t = convexTest(schema, modules);
  const seeded = await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("users", {
      authId: ADMIN_AUTH,
      name: "Admin",
      locale: "ar",
    });
    const teacherId = await ctx.db.insert("users", {
      authId: TEACHER_AUTH,
      name: "Teacher",
      locale: "ar",
    });
    const accountantId = await ctx.db.insert("users", {
      authId: ACCOUNTANT_AUTH,
      name: "Accountant",
      locale: "ar",
    });
    const nurseryId = await ctx.db.insert("nurseries", {
      name: "Nursery",
      settings: { locale: "ar", weekStart: "sun" },
      activeYear: { yearId: YEAR_ID, start: "2026-09-01", end: "2027-06-30" },
    });
    const adminMembershipId = await ctx.db.insert("memberships", {
      userId: adminId,
      nurseryId,
      role: "admin",
    });
    await ctx.db.insert("memberships", {
      userId: teacherId,
      nurseryId,
      role: "teacher",
    });
    await ctx.db.insert("memberships", {
      userId: accountantId,
      nurseryId,
      role: "accountant",
    });

    const stageId = await ctx.db.insert("stages", {
      nurseryId,
      name: "Stage",
      order: 1,
    });
    // Two classrooms; the teacher teaches only classroom 1.
    const classroom1 = await ctx.db.insert("classrooms", {
      nurseryId,
      stageId,
      name: "Class 1",
      teacherIds: [teacherId],
    });
    const classroom2 = await ctx.db.insert("classrooms", {
      nurseryId,
      stageId,
      name: "Class 2",
      teacherIds: [],
    });

    const makeStudent = async (nameAr: string, classroomId: Id<"classrooms">) => {
      const studentId = await ctx.db.insert("students", {
        nurseryId,
        nameAr,
        dob: "2023-01-01",
        sex: "m",
        guardians: [],
        consent: { photos: false },
        status: "active",
      });
      await ctx.db.insert("enrollments", {
        nurseryId,
        studentId,
        classroomId,
        yearId: YEAR_ID,
      });
      return studentId;
    };
    const studentIn1 = await makeStudent("طفل ١", classroom1);
    const studentIn2 = await makeStudent("طفل ٢", classroom2);

    return {
      nurseryId,
      adminMembershipId,
      classroom1,
      classroom2,
      studentIn1,
      studentIn2,
    };
  });
  return {
    t,
    asAdmin: t.withIdentity({ subject: ADMIN_AUTH }),
    asTeacher: t.withIdentity({ subject: TEACHER_AUTH }),
    asAccountant: t.withIdentity({ subject: ACCOUNTANT_AUTH }),
    ...seeded,
  };
}

test("teacher cannot students.create", async () => {
  const { asTeacher, nurseryId } = await setup();
  await expect(
    asTeacher.mutation(api.students.create, {
      nurseryId,
      nameAr: "طفل جديد",
      dob: "2023-05-01",
      sex: "f",
      guardians: [],
      consentPhotos: false,
    }),
  ).rejects.toThrow(/forbidden/);
});

test("accountant cannot attendance.upsert", async () => {
  const { asAccountant, nurseryId, classroom1, studentIn1 } = await setup();
  await expect(
    asAccountant.mutation(api.attendance.upsert, {
      nurseryId,
      classroomId: classroom1,
      studentId: studentIn1,
      date: todayISO(),
      status: "present",
    }),
  ).rejects.toThrow(/forbidden/);
});

test("accountant CAN students.list (reads ok)", async () => {
  const { asAccountant, nurseryId } = await setup();
  const students = await asAccountant.query(api.students.list, { nurseryId });
  expect(students).toHaveLength(2);
});

test("teacher students.list returns ONLY own-classroom students", async () => {
  const { asTeacher, nurseryId, studentIn1 } = await setup();
  const students = await asTeacher.query(api.students.list, { nurseryId });
  expect(students).toHaveLength(1);
  expect(students[0]._id).toBe(studentIn1);
});

test("teacher cannot evaluations.upsert for other classroom's student", async () => {
  const { asTeacher, nurseryId, studentIn1, studentIn2 } = await setup();
  const scores = { academic: 3, social: 3, motor: 3, behavioral: 3 };
  // Positive control: own-classroom student works.
  await asTeacher.mutation(api.evaluations.upsert, {
    nurseryId,
    studentId: studentIn1,
    yearId: YEAR_ID,
    week: 1,
    scores,
  });
  await expect(
    asTeacher.mutation(api.evaluations.upsert, {
      nurseryId,
      studentId: studentIn2,
      yearId: YEAR_ID,
      week: 1,
      scores,
    }),
  ).rejects.toThrow(/forbidden/);
});

test("accountant cannot evaluations.listForStudent", async () => {
  const { asAccountant, nurseryId, studentIn1 } = await setup();
  await expect(
    asAccountant.query(api.evaluations.listForStudent, {
      nurseryId,
      studentId: studentIn1,
      yearId: YEAR_ID,
    }),
  ).rejects.toThrow(/forbidden/);
});

test("teacher attendance.upsert for yesterday throws; admin succeeds", async () => {
  const { asTeacher, asAdmin, nurseryId, classroom1, studentIn1 } =
    await setup();
  const date = yesterdayISO();
  await expect(
    asTeacher.mutation(api.attendance.upsert, {
      nurseryId,
      classroomId: classroom1,
      studentId: studentIn1,
      date,
      status: "present",
    }),
  ).rejects.toThrow(/forbidden/);
  await expect(
    asAdmin.mutation(api.attendance.upsert, {
      nurseryId,
      classroomId: classroom1,
      studentId: studentIn1,
      date,
      status: "present",
    }),
  ).resolves.toEqual({ conflict: false });
});

test("staff.createStaff by teacher throws", async () => {
  const { asTeacher, nurseryId } = await setup();
  await expect(
    asTeacher.action(api.staff.createStaff, {
      nurseryId,
      email: "new@hadanati.test",
      password: "Password2026!",
      name: "New Staff",
      role: "teacher",
    }),
  ).rejects.toThrow(/forbidden/);
});

test("updateRole demoting last admin throws last_admin", async () => {
  const { asAdmin, nurseryId, adminMembershipId } = await setup();
  await expect(
    asAdmin.mutation(api.staff.updateRole, {
      nurseryId,
      membershipId: adminMembershipId,
      role: "teacher",
    }),
  ).rejects.toThrow(/last_admin/);
});
