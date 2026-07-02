/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { todayISO } from "./lib/shared";

const modules = import.meta.glob("./**/*.ts");

const ADMIN_AUTH_ID = "ba_user_admin";
const TEACHER_AUTH_ID = "ba_user_teacher";

async function setup() {
  const t = convexTest(schema, modules);
  const seeded = await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("users", {
      authId: ADMIN_AUTH_ID,
      name: "Admin",
      locale: "ar",
    });
    const teacherId = await ctx.db.insert("users", {
      authId: TEACHER_AUTH_ID,
      name: "Teacher",
      locale: "ar",
    });
    const nurseryId = await ctx.db.insert("nurseries", {
      name: "حضانة",
      settings: { locale: "ar", weekStart: "sun" },
      activeYear: { yearId: "2026-2027", start: "2026-06-01", end: "2027-06-30" },
    });
    await ctx.db.insert("memberships", {
      userId: adminId,
      nurseryId,
      role: "admin",
    });
    await ctx.db.insert("memberships", {
      userId: teacherId,
      nurseryId,
      role: "teacher",
    });
    const stageId = await ctx.db.insert("stages", {
      nurseryId,
      name: "Stage",
      order: 1,
    });
    const classroom1 = await ctx.db.insert("classrooms", {
      nurseryId,
      stageId,
      name: "صف ١",
      teacherIds: [teacherId],
    });
    const classroom2 = await ctx.db.insert("classrooms", {
      nurseryId,
      stageId,
      name: "صف ٢",
      teacherIds: [],
    });
    const makeStudent = async (
      nameAr: string,
      classroomId: Id<"classrooms">,
    ) => {
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
        yearId: "2026-2027",
      });
      return studentId;
    };
    const roster1 = [
      await makeStudent("طالب ١", classroom1),
      await makeStudent("طالب ٢", classroom1),
      await makeStudent("طالب ٣", classroom1),
    ];
    const roster2 = [await makeStudent("طالب ٤", classroom2)];
    return { nurseryId, classroom1, classroom2, roster1, roster2 };
  });
  const asAdmin = t.withIdentity({ subject: ADMIN_AUTH_ID });
  const asTeacher = t.withIdentity({ subject: TEACHER_AUTH_ID });
  return { t, asAdmin, asTeacher, ...seeded };
}

async function notificationsFor(
  t: Awaited<ReturnType<typeof setup>>["t"],
  studentId: Id<"students">,
) {
  return await t.run(async (ctx) =>
    ctx.db
      .query("notifications")
      .withIndex("by_target_studentId", (q) =>
        q.eq("target.studentId", studentId),
      )
      .collect(),
  );
}

test("absence notification: emitted once, absent→absent does not duplicate", async () => {
  const { t, asAdmin, nurseryId, classroom1, roster1 } = await setup();
  const studentId = roster1[0];
  const date = todayISO();

  // present → no notification
  await asAdmin.mutation(api.attendance.upsert, {
    nurseryId,
    classroomId: classroom1,
    studentId,
    date,
    status: "present",
  });
  expect(await notificationsFor(t, studentId)).toHaveLength(0);

  // present → absent: one absence notification
  await asAdmin.mutation(api.attendance.upsert, {
    nurseryId,
    classroomId: classroom1,
    studentId,
    date,
    status: "absent",
  });
  let rows = await notificationsFor(t, studentId);
  expect(rows).toHaveLength(1);
  expect(rows[0].type).toBe("absence");
  expect(rows[0].payload.date).toBe(date);

  // absent → absent: no duplicate
  await asAdmin.mutation(api.attendance.upsert, {
    nurseryId,
    classroomId: classroom1,
    studentId,
    date,
    status: "absent",
    note: "مريض",
  });
  rows = await notificationsFor(t, studentId);
  expect(rows).toHaveLength(1);

  // absent → present → absent again: a NEW absence notification
  await asAdmin.mutation(api.attendance.upsert, {
    nurseryId,
    classroomId: classroom1,
    studentId,
    date,
    status: "present",
  });
  await asAdmin.mutation(api.attendance.upsert, {
    nurseryId,
    classroomId: classroom1,
    studentId,
    date,
    status: "absent",
  });
  rows = await notificationsFor(t, studentId);
  expect(rows.filter((r) => r.type === "absence")).toHaveLength(2);
});

test("evaluation upsert emits an evaluation notification (ids only)", async () => {
  const { t, asAdmin, nurseryId, roster1 } = await setup();
  const studentId = roster1[1];

  await asAdmin.mutation(api.evaluations.upsert, {
    nurseryId,
    studentId,
    yearId: "2026-2027",
    week: 5,
    scores: { academic: 4, social: 4, motor: 4, behavioral: 4 },
    note: "ملاحظة سرية",
  });
  const rows = await notificationsFor(t, studentId);
  expect(rows).toHaveLength(1);
  expect(rows[0].type).toBe("evaluation");
  expect(rows[0].payload).toEqual({ week: "5", yearId: "2026-2027" });
  // FR-NOT-3: no note text or scores in the payload.
  expect(JSON.stringify(rows[0].payload)).not.toContain("ملاحظة");
});

test("classroom announcement notifies exactly its roster", async () => {
  const { t, asTeacher, nurseryId, classroom1, roster1, roster2 } =
    await setup();

  await asTeacher.mutation(api.announcements.create, {
    nurseryId,
    classroomId: classroom1,
    title: "رحلة",
    body: "غداً رحلة الصف",
  });

  for (const studentId of roster1) {
    const rows = await notificationsFor(t, studentId);
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe("announcement");
    // FR-NOT-3: id only, no title/body.
    expect(Object.keys(rows[0].payload)).toEqual(["announcementId"]);
  }
  for (const studentId of roster2) {
    expect(await notificationsFor(t, studentId)).toHaveLength(0);
  }
});

test("announcement scoping: teacher can't post nursery-wide or to another classroom; nursery-wide reaches everyone", async () => {
  const { t, asAdmin, asTeacher, nurseryId, classroom2, roster1, roster2 } =
    await setup();

  await expect(
    asTeacher.mutation(api.announcements.create, {
      nurseryId,
      title: "عام",
      body: "نص",
    }),
  ).rejects.toThrow(/forbidden/);
  await expect(
    asTeacher.mutation(api.announcements.create, {
      nurseryId,
      classroomId: classroom2,
      title: "صف غيري",
      body: "نص",
    }),
  ).rejects.toThrow(/forbidden/);

  await asAdmin.mutation(api.announcements.create, {
    nurseryId,
    title: "إجازة",
    body: "غداً إجازة",
  });
  for (const studentId of [...roster1, ...roster2]) {
    const rows = await notificationsFor(t, studentId);
    expect(rows.filter((r) => r.type === "announcement")).toHaveLength(1);
  }
});

test("evaluation upsert with stale clientCreatedAt over a newer row returns conflict:true", async () => {
  const { asAdmin, nurseryId, roster1 } = await setup();
  const studentId = roster1[2];
  const base = {
    nurseryId,
    studentId,
    yearId: "2026-2027",
    week: 6,
    scores: { academic: 2, social: 2, motor: 2, behavioral: 2 },
  };

  // Device B wrote directly while device A was offline.
  const first = await asAdmin.mutation(api.evaluations.upsert, {
    ...base,
    clientCreatedAt: Date.now(),
  });
  expect(first).toEqual({ conflict: false });

  // Device A's queued write predates the server row → LWW applies + flag.
  const replay = await asAdmin.mutation(api.evaluations.upsert, {
    ...base,
    scores: { academic: 5, social: 5, motor: 5, behavioral: 5 },
    clientCreatedAt: Date.now() - 60_000,
  });
  expect(replay).toEqual({ conflict: true });
});
