/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import rateLimiterSchema from "../node_modules/@convex-dev/rate-limiter/src/component/schema";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const rateLimiterModules = import.meta.glob(
  "../node_modules/@convex-dev/rate-limiter/src/component/**/*.ts",
);

const AUTH_ID = "ba_user_admin";

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
    const studentId = await ctx.db.insert("students", {
      nurseryId,
      nameAr: "لينا",
      dob: "2023-01-01",
      sex: "f",
      guardians: [],
      consent: { photos: false },
      status: "active",
    });
    return { userId, nurseryId, studentId };
  });
  const asAdmin = t.withIdentity({ subject: AUTH_ID });
  return { t, asAdmin, ...seeded };
}

test("generate → verify ok; code has the XXXX-XXXX-XXXX shape", async () => {
  const { t, asAdmin, nurseryId, studentId } = await setup();

  const { code } = await asAdmin.mutation(api.accessCodes.generate, {
    nurseryId,
    studentId,
  });
  expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);

  const result = await t.mutation(api.portal.verify, { code });
  expect(result).toMatchObject({
    ok: true,
    nurseryName: "حضانة الاختبار",
    student: { id: studentId, nameAr: "لينا" },
  });
});

test("regenerate: old code stops verifying, new one works", async () => {
  const { t, asAdmin, nurseryId, studentId } = await setup();

  const { code: oldCode } = await asAdmin.mutation(api.accessCodes.generate, {
    nurseryId,
    studentId,
  });
  const { code: newCode } = await asAdmin.mutation(api.accessCodes.generate, {
    nurseryId,
    studentId,
  });

  expect(await t.mutation(api.portal.verify, { code: oldCode })).toEqual({
    ok: false,
    reason: "invalid",
  });
  expect(await t.mutation(api.portal.verify, { code: newCode })).toMatchObject({
    ok: true,
  });
});

test("revoke deactivates the code and listForStudent never leaks hashes", async () => {
  const { t, asAdmin, nurseryId, studentId } = await setup();

  const { code } = await asAdmin.mutation(api.accessCodes.generate, {
    nurseryId,
    studentId,
  });
  const listed = await asAdmin.query(api.accessCodes.listForStudent, {
    nurseryId,
    studentId,
  });
  expect(listed).toHaveLength(1);
  expect(listed[0].active).toBe(true);
  expect(Object.keys(listed[0]).sort()).toEqual([
    "_creationTime",
    "_id",
    "active",
  ]);

  await asAdmin.mutation(api.accessCodes.revoke, {
    nurseryId,
    accessCodeId: listed[0]._id,
  });

  expect(await t.mutation(api.portal.verify, { code })).toEqual({
    ok: false,
    reason: "invalid",
  });
  const after = await asAdmin.query(api.accessCodes.listForStudent, {
    nurseryId,
    studentId,
  });
  expect(after[0].active).toBe(false);
});

test("verify rate limit trips at the 11th bad attempt for one code value", async () => {
  const { t } = await setup();

  // Well-formed but nonexistent code (same value → same per-hash bucket).
  const badCode = "AAAA-AAAA-AAAA";
  for (let i = 0; i < 10; i++) {
    expect(await t.mutation(api.portal.verify, { code: badCode })).toEqual({
      ok: false,
      reason: "invalid",
    });
  }
  expect(await t.mutation(api.portal.verify, { code: badCode })).toEqual({
    ok: false,
    reason: "rate_limited",
  });
});

test("teacher cannot generate or list access codes (admin only)", async () => {
  const { t, asAdmin, nurseryId, studentId } = await setup();
  await t.run(async (ctx) => {
    const teacherId = await ctx.db.insert("users", {
      authId: "ba_user_teacher",
      name: "Teacher",
      locale: "ar",
    });
    await ctx.db.insert("memberships", {
      userId: teacherId,
      nurseryId,
      role: "teacher",
    });
  });
  const asTeacher = t.withIdentity({ subject: "ba_user_teacher" });

  await expect(
    asTeacher.mutation(api.accessCodes.generate, { nurseryId, studentId }),
  ).rejects.toThrow(/forbidden/);
  await expect(
    asTeacher.query(api.accessCodes.listForStudent, { nurseryId, studentId }),
  ).rejects.toThrow(/forbidden/);
  // Positive control.
  await expect(
    asAdmin.mutation(api.accessCodes.generate, { nurseryId, studentId }),
  ).resolves.toMatchObject({ code: expect.any(String) });
});
