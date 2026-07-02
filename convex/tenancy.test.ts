/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { todayISO } from "./lib/shared";

const modules = import.meta.glob("./**/*.ts");

const AUTH_ID = "ba_user_alice";

async function setup() {
  const t = convexTest(schema, modules);
  const seeded = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      authId: AUTH_ID,
      name: "Alice",
      locale: "ar",
    });
    const activeYear = { yearId: "2026-2027", start: "2026-09-01", end: "2027-06-30" };
    const settings = { locale: "ar" as const, weekStart: "sun" as const };
    const nurseryA = await ctx.db.insert("nurseries", {
      name: "Nursery A",
      settings,
      activeYear,
    });
    const nurseryB = await ctx.db.insert("nurseries", {
      name: "Nursery B",
      settings,
      activeYear,
    });
    // Alice is admin of A only.
    await ctx.db.insert("memberships", {
      userId,
      nurseryId: nurseryA,
      role: "admin",
    });

    const makeClassroomAndStudent = async (nurseryId: Id<"nurseries">) => {
      const stageId = await ctx.db.insert("stages", {
        nurseryId,
        name: "Stage",
        order: 1,
      });
      const classroomId = await ctx.db.insert("classrooms", {
        nurseryId,
        stageId,
        name: "Class",
        teacherIds: [],
      });
      const studentId = await ctx.db.insert("students", {
        nurseryId,
        nameAr: "طفل",
        dob: "2023-01-01",
        sex: "m",
        guardians: [],
        consent: { photos: false },
        status: "active",
      });
      return { classroomId, studentId };
    };

    const a = await makeClassroomAndStudent(nurseryA);
    const b = await makeClassroomAndStudent(nurseryB);
    return { userId, nurseryA, nurseryB, a, b };
  });
  const asAlice = t.withIdentity({ subject: AUTH_ID });
  return { t, asAlice, ...seeded };
}

test("cross-tenant read: listForClassroomDate against other nursery throws", async () => {
  const { asAlice, nurseryA, nurseryB, a, b } = await setup();

  // Positive control: own nursery works.
  await expect(
    asAlice.query(api.attendance.listForClassroomDate, {
      nurseryId: nurseryA,
      classroomId: a.classroomId,
      date: todayISO(),
    }),
  ).resolves.toEqual([]);

  await expect(
    asAlice.query(api.attendance.listForClassroomDate, {
      nurseryId: nurseryB,
      classroomId: b.classroomId,
      date: todayISO(),
    }),
  ).rejects.toThrow(/forbidden/);
});

test("cross-tenant write: nurseries.update against other nursery throws", async () => {
  const { asAlice, nurseryA, nurseryB } = await setup();

  await asAlice.mutation(api.nurseries.update, {
    nurseryId: nurseryA,
    name: "Renamed A",
  });

  await expect(
    asAlice.mutation(api.nurseries.update, {
      nurseryId: nurseryB,
      name: "Hacked B",
    }),
  ).rejects.toThrow(/forbidden/);
});

test("cross-tenant write: attendance.upsert into other nursery throws", async () => {
  const { asAlice, nurseryB, b } = await setup();

  await expect(
    asAlice.mutation(api.attendance.upsert, {
      nurseryId: nurseryB,
      classroomId: b.classroomId,
      studentId: b.studentId,
      date: todayISO(),
      status: "present",
    }),
  ).rejects.toThrow(/forbidden/);
});
