/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { todayISO } from "./lib/shared";

const modules = import.meta.glob("./**/*.ts");

const AUTH_ID = "ba_user_admin";

async function setup() {
  const t = convexTest(schema, modules);
  const seeded = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      authId: AUTH_ID,
      name: "Admin",
      locale: "ar",
    });
    const nurseryId = await ctx.db.insert("nurseries", {
      name: "Nursery",
      settings: { locale: "ar", weekStart: "sun" },
      activeYear: { yearId: "2026-2027", start: "2026-09-01", end: "2027-06-30" },
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
      name: "Class",
      teacherIds: [userId],
    });
    const studentId = await ctx.db.insert("students", {
      nurseryId,
      nameAr: "طفل",
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
    return { userId, nurseryId, classroomId, studentId };
  });
  const asAdmin = t.withIdentity({ subject: AUTH_ID });
  return { t, asAdmin, ...seeded };
}

test("upsert twice for same (student, date) keeps one record with latest status", async () => {
  const { t, asAdmin, nurseryId, classroomId, studentId } = await setup();
  const date = todayISO();

  await asAdmin.mutation(api.attendance.upsert, {
    nurseryId,
    classroomId,
    studentId,
    date,
    status: "present",
  });
  await asAdmin.mutation(api.attendance.upsert, {
    nurseryId,
    classroomId,
    studentId,
    date,
    status: "late",
    note: "وصل متأخراً",
  });

  const rows = await t.run(async (ctx) =>
    ctx.db
      .query("attendance")
      .withIndex("by_student_and_date", (q) =>
        q.eq("studentId", studentId).eq("date", date),
      )
      .collect(),
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].status).toBe("late");
  expect(rows[0].note).toBe("وصل متأخراً");
});

test("same clientMutationId twice: one record, one syncLog row, second call silent", async () => {
  const { t, asAdmin, nurseryId, classroomId, studentId } = await setup();
  const date = todayISO();
  const clientMutationId = "11111111-2222-3333-4444-555555555555";

  await asAdmin.mutation(api.attendance.upsert, {
    nurseryId,
    classroomId,
    studentId,
    date,
    status: "present",
    clientMutationId,
  });
  // Replay of the same offline mutation: must ack silently, not re-apply.
  await asAdmin.mutation(api.attendance.upsert, {
    nurseryId,
    classroomId,
    studentId,
    date,
    status: "absent",
    clientMutationId,
  });

  const { rows, syncRows } = await t.run(async (ctx) => ({
    rows: await ctx.db
      .query("attendance")
      .withIndex("by_student_and_date", (q) =>
        q.eq("studentId", studentId).eq("date", date),
      )
      .collect(),
    syncRows: await ctx.db
      .query("syncLog")
      .withIndex("by_clientMutationId", (q) =>
        q.eq("clientMutationId", clientMutationId),
      )
      .collect(),
  }));
  expect(rows).toHaveLength(1);
  expect(rows[0].status).toBe("present"); // second call was a no-op
  expect(syncRows).toHaveLength(1);
});

test("LWW conflict flag: stale clientCreatedAt over a newer row → {conflict:true}", async () => {
  const { t, asAdmin, nurseryId, classroomId, studentId } = await setup();
  const date = todayISO();
  const base = { nurseryId, classroomId, studentId, date };

  // First write (online, clientCreatedAt ≈ now) → no conflict.
  const first = await asAdmin.mutation(api.attendance.upsert, {
    ...base,
    status: "present",
    clientCreatedAt: Date.now(),
  });
  expect(first).toEqual({ conflict: false });

  // Offline replay queued BEFORE the row above changed → LWW applies + flag.
  const replay = await asAdmin.mutation(api.attendance.upsert, {
    ...base,
    status: "late",
    clientCreatedAt: Date.now() - 60_000,
  });
  expect(replay).toEqual({ conflict: true });

  // The write still applied (last write wins).
  const rows = await t.run(async (ctx) =>
    ctx.db
      .query("attendance")
      .withIndex("by_student_and_date", (q) =>
        q.eq("studentId", studentId).eq("date", date),
      )
      .collect(),
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].status).toBe("late");

  // A fresh online write after that → no conflict.
  const fresh = await asAdmin.mutation(api.attendance.upsert, {
    ...base,
    status: "excused",
    clientCreatedAt: Date.now() + 1,
  });
  expect(fresh).toEqual({ conflict: false });

  // Without clientCreatedAt (legacy/direct callers) → never flags.
  const legacy = await asAdmin.mutation(api.attendance.upsert, {
    ...base,
    status: "present",
  });
  expect(legacy).toEqual({ conflict: false });
});
