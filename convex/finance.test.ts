/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import rateLimiterSchema from "../node_modules/@convex-dev/rate-limiter/src/component/schema";
import schema from "./schema";
import { todayISO } from "./lib/shared";
import { addDaysISO } from "./lib/finance";

const modules = import.meta.glob("./**/*.ts");
const rateLimiterModules = import.meta.glob(
  "../node_modules/@convex-dev/rate-limiter/src/component/**/*.ts",
);

const ADMIN_AUTH = "ba_fin_admin";
const TEACHER_AUTH = "ba_fin_teacher";
const ACCOUNTANT_AUTH = "ba_fin_accountant";
const YEAR_ID = "2026-2027";

async function setup() {
  const t = convexTest(schema, modules);
  t.registerComponent("rateLimiter", rateLimiterSchema, rateLimiterModules);
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
      name: "حضانة المالية",
      settings: { locale: "ar", weekStart: "sun" },
      activeYear: { yearId: YEAR_ID, start: "2026-06-01", end: "2027-06-30" },
    });
    for (const [userId, role] of [
      [adminId, "admin"],
      [teacherId, "teacher"],
      [accountantId, "accountant"],
    ] as const) {
      await ctx.db.insert("memberships", { userId, nurseryId, role });
    }
    const stageId = await ctx.db.insert("stages", {
      nurseryId,
      name: "Stage",
      order: 1,
    });
    const classroomId = await ctx.db.insert("classrooms", {
      nurseryId,
      stageId,
      name: "صف",
      teacherIds: [teacherId],
    });
    const planId = await ctx.db.insert("feePlans", {
      nurseryId,
      name: "قسط شهري",
      amountFils: 85000,
      cadence: "monthly",
    });
    const makeStudent = async (nameAr: string, feePlanId?: Id<"feePlans">) => {
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
        yearId: YEAR_ID,
        feePlanId,
      });
      return studentId;
    };
    const studentA = await makeStudent("ألف", planId);
    const studentB = await makeStudent("باء", planId);
    const studentNoPlan = await makeStudent("جيم");
    return { nurseryId, classroomId, planId, studentA, studentB, studentNoPlan };
  });
  return {
    t,
    asAdmin: t.withIdentity({ subject: ADMIN_AUTH }),
    asTeacher: t.withIdentity({ subject: TEACHER_AUTH }),
    asAccountant: t.withIdentity({ subject: ACCOUNTANT_AUTH }),
    ...seeded,
  };
}

test("generateForPeriod: creates one invoice per plan enrollment, idempotent on rerun", async () => {
  const { asAdmin, nurseryId } = await setup();
  const first = await asAdmin.mutation(api.invoices.generateForPeriod, {
    nurseryId,
    period: "2026-09",
  });
  expect(first).toEqual({ created: 2, skipped: 0 });

  const second = await asAdmin.mutation(api.invoices.generateForPeriod, {
    nurseryId,
    period: "2026-09",
  });
  expect(second).toEqual({ created: 0, skipped: 2 });

  const rows = await asAdmin.query(api.invoices.list, {
    nurseryId,
    filter: "all",
  });
  expect(rows).toHaveLength(2);
  expect(rows.every((r) => r.amountFils === 85000)).toBe(true);
  expect(rows.every((r) => r.dueDate === "2026-09-10")).toBe(true);
  expect(rows.every((r) => r.planName === "قسط شهري")).toBe(true);

  // A different month DOES create new invoices.
  const october = await asAdmin.mutation(api.invoices.generateForPeriod, {
    nurseryId,
    period: "2026-10",
  });
  expect(october).toEqual({ created: 2, skipped: 0 });
});

test("payment state machine: issued → partial → paid; overpay throws exceeds_balance", async () => {
  const { asAdmin, asAccountant, nurseryId, studentA } = await setup();
  const invoiceId = await asAdmin.mutation(api.invoices.createManual, {
    nurseryId,
    studentId: studentA,
    amountFils: 100000,
    dueDate: addDaysISO(todayISO(), 10),
    description: "رسوم تسجيل",
  });

  // Accountant IS allowed to record payments.
  await asAccountant.mutation(api.payments.create, {
    nurseryId,
    invoiceId,
    amountFils: 40000,
    method: "cash",
    paidAt: todayISO(),
  });
  let detail = await asAdmin.query(api.invoices.get, { nurseryId, invoiceId });
  expect(detail.invoice.status).toBe("partial");
  expect(detail.paidFils).toBe(40000);

  // Overpaying the remaining 60.000 throws.
  await expect(
    asAccountant.mutation(api.payments.create, {
      nurseryId,
      invoiceId,
      amountFils: 60001,
      method: "cliq",
      paidAt: todayISO(),
    }),
  ).rejects.toThrow(/exceeds_balance/);

  await asAccountant.mutation(api.payments.create, {
    nurseryId,
    invoiceId,
    amountFils: 60000,
    method: "transfer",
    paidAt: todayISO(),
  });
  detail = await asAdmin.query(api.invoices.get, { nurseryId, invoiceId });
  expect(detail.invoice.status).toBe("paid");
  expect(detail.paidFils).toBe(100000);
  expect(detail.payments).toHaveLength(2);

  // Fully paid → any further payment exceeds the zero balance.
  await expect(
    asAccountant.mutation(api.payments.create, {
      nurseryId,
      invoiceId,
      amountFils: 1,
      method: "cash",
      paidAt: todayISO(),
    }),
  ).rejects.toThrow(/exceeds_balance/);

  // Non-integer fils rejected.
  await expect(
    asAccountant.mutation(api.payments.create, {
      nurseryId,
      invoiceId,
      amountFils: 10.5,
      method: "cash",
      paidAt: todayISO(),
    }),
  ).rejects.toThrow(/invalid_amount/);
});

test("computedStatus: issued invoice past dueDate reads as overdue (never stored)", async () => {
  const { t, asAdmin, nurseryId, studentA } = await setup();
  const invoiceId = await asAdmin.mutation(api.invoices.createManual, {
    nurseryId,
    studentId: studentA,
    amountFils: 50000,
    dueDate: addDaysISO(todayISO(), -5),
  });

  const detail = await asAdmin.query(api.invoices.get, { nurseryId, invoiceId });
  expect(detail.invoice.status).toBe("issued"); // stored
  expect(detail.computedStatus).toBe("overdue"); // derived

  const overdueRows = await asAdmin.query(api.invoices.list, {
    nurseryId,
    filter: "overdue",
  });
  expect(overdueRows.map((r) => r._id)).toEqual([invoiceId]);
  expect(overdueRows[0].computedStatus).toBe("overdue");

  // Stored value in the DB stays "issued".
  const raw = await t.run(async (ctx) => ctx.db.get("invoices", invoiceId));
  expect(raw!.status).toBe("issued");

  // overview surfaces it in the overdue list with daysLate.
  const overview = await asAdmin.query(api.finance.overview, { nurseryId });
  expect(overview.outstandingFils).toBe(50000);
  expect(overview.overdueList).toHaveLength(1);
  expect(overview.overdueList[0]).toMatchObject({
    invoiceId,
    studentNameAr: "ألف",
    amountFils: 50000,
    paidFils: 0,
    daysLate: 5,
  });
});

test("statement: strictly chronological lines with exact running balance in fils", async () => {
  const { asAdmin, nurseryId, studentA } = await setup();
  const today = todayISO();
  const invoiceId = await asAdmin.mutation(api.invoices.createManual, {
    nurseryId,
    studentId: studentA,
    amountFils: 100000,
    dueDate: addDaysISO(today, 10),
    description: "رسوم الفصل",
  });
  await asAdmin.mutation(api.payments.create, {
    nurseryId,
    invoiceId,
    amountFils: 30500,
    method: "cash",
    paidAt: today,
  });
  await asAdmin.mutation(api.payments.create, {
    nurseryId,
    invoiceId,
    amountFils: 19500,
    method: "cliq",
    paidAt: addDaysISO(today, 1),
  });

  const statement = await asAdmin.query(api.finance.statement, {
    nurseryId,
    studentId: studentA,
  });
  expect(statement.student.nameAr).toBe("ألف");
  expect(statement.lines.map((l) => [l.kind, l.amountFils, l.runningBalanceFils])).toEqual([
    ["invoice", 100000, 100000],
    ["payment", -30500, 69500],
    ["payment", -19500, 50000],
  ]);
  expect(statement.lines[0].description).toBe("رسوم الفصل");
  expect(statement.totals).toEqual({
    invoicedFils: 100000,
    paidFils: 50000,
    balanceFils: 50000,
  });
});

test("roles: teacher denied feePlans.create, payments.create, finance.overview; accountant allowed feePlans.create", async () => {
  const { asAdmin, asTeacher, asAccountant, nurseryId, studentA } =
    await setup();
  await expect(
    asTeacher.mutation(api.feePlans.create, {
      nurseryId,
      name: "خطة",
      amountFils: 1000,
      cadence: "monthly",
    }),
  ).rejects.toThrow(/forbidden/);
  await expect(
    asTeacher.query(api.finance.overview, { nurseryId }),
  ).rejects.toThrow(/forbidden/);

  const invoiceId = await asAdmin.mutation(api.invoices.createManual, {
    nurseryId,
    studentId: studentA,
    amountFils: 10000,
    dueDate: todayISO(),
  });
  await expect(
    asTeacher.mutation(api.payments.create, {
      nurseryId,
      invoiceId,
      amountFils: 10000,
      method: "cash",
      paidAt: todayISO(),
    }),
  ).rejects.toThrow(/forbidden/);

  // Accountant can manage plans; payments.create allowance is covered in the
  // state-machine test. payments.remove stays ADMIN-only.
  const planId = await asAccountant.mutation(api.feePlans.create, {
    nurseryId,
    name: "قسط سنوي",
    amountFils: 800000,
    cadence: "annual",
  });
  expect(planId).toBeTruthy();
  const paymentId = await asAccountant.mutation(api.payments.create, {
    nurseryId,
    invoiceId,
    amountFils: 5000,
    method: "cash",
    paidAt: todayISO(),
  });
  await expect(
    asAccountant.mutation(api.payments.remove, { nurseryId, paymentId }),
  ).rejects.toThrow(/forbidden/);
  await asAdmin.mutation(api.payments.remove, { nurseryId, paymentId });
});

test("feePlans.remove throws plan_in_use while an enrollment references it", async () => {
  const { t, asAdmin, nurseryId, planId, studentA, studentB, studentNoPlan } =
    await setup();
  await expect(
    asAdmin.mutation(api.feePlans.remove, { nurseryId, feePlanId: planId }),
  ).rejects.toThrow(/plan_in_use/);

  // Detach it everywhere → delete succeeds.
  await t.run(async (ctx) => {
    for (const studentId of [studentA, studentB, studentNoPlan]) {
      const rows = await ctx.db
        .query("enrollments")
        .withIndex("by_nursery_and_studentId", (q) =>
          q.eq("nurseryId", nurseryId).eq("studentId", studentId),
        )
        .take(10);
      for (const row of rows) {
        await ctx.db.patch("enrollments", row._id, { feePlanId: undefined });
      }
    }
  });
  await asAdmin.mutation(api.feePlans.remove, { nurseryId, feePlanId: planId });
});

test("void: throws has_payments when a payment exists, voids otherwise", async () => {
  const { asAdmin, nurseryId, studentA } = await setup();
  const paidInvoice = await asAdmin.mutation(api.invoices.createManual, {
    nurseryId,
    studentId: studentA,
    amountFils: 20000,
    dueDate: todayISO(),
  });
  await asAdmin.mutation(api.payments.create, {
    nurseryId,
    invoiceId: paidInvoice,
    amountFils: 5000,
    method: "cash",
    paidAt: todayISO(),
  });
  await expect(
    asAdmin.mutation(api.invoices.voidInvoice, {
      nurseryId,
      invoiceId: paidInvoice,
    }),
  ).rejects.toThrow(/has_payments/);

  const cleanInvoice = await asAdmin.mutation(api.invoices.createManual, {
    nurseryId,
    studentId: studentA,
    amountFils: 20000,
    dueDate: todayISO(),
  });
  await asAdmin.mutation(api.invoices.voidInvoice, {
    nurseryId,
    invoiceId: cleanInvoice,
  });
  const detail = await asAdmin.query(api.invoices.get, {
    nurseryId,
    invoiceId: cleanInvoice,
  });
  expect(detail.invoice.status).toBe("void");
  // Voided invoices cannot take payments.
  await expect(
    asAdmin.mutation(api.payments.create, {
      nurseryId,
      invoiceId: cleanInvoice,
      amountFils: 1000,
      method: "cash",
      paidAt: todayISO(),
    }),
  ).rejects.toThrow(/not_payable/);
});

test("portal invoices: code A sees only student A's invoices + correct balance", async () => {
  const { t, asAdmin, nurseryId, studentA, studentB } = await setup();
  const { code: codeA } = await asAdmin.mutation(api.accessCodes.generate, {
    nurseryId,
    studentId: studentA,
  });

  const invoiceA = await asAdmin.mutation(api.invoices.createManual, {
    nurseryId,
    studentId: studentA,
    amountFils: 85000,
    dueDate: addDaysISO(todayISO(), 5),
    description: "قسط شهر ٩",
  });
  await asAdmin.mutation(api.invoices.createManual, {
    nurseryId,
    studentId: studentB,
    amountFils: 999000,
    dueDate: addDaysISO(todayISO(), 5),
  });
  await asAdmin.mutation(api.payments.create, {
    nurseryId,
    invoiceId: invoiceA,
    amountFils: 30000,
    method: "cash",
    paidAt: todayISO(),
  });

  const portal = await t.query(api.portal.invoices, { code: codeA });
  expect(portal.invoices).toHaveLength(1);
  expect(portal.invoices[0]).toMatchObject({
    _id: invoiceA,
    description: "قسط شهر ٩",
    amountFils: 85000,
    paidFils: 30000,
    computedStatus: "partial",
  });
  expect(portal.invoices[0].payments).toEqual([
    { paidAt: todayISO(), amountFils: 30000, method: "cash" },
  ]);
  expect(portal.totals.balanceFils).toBe(55000);

  // Invalid code → empty, zero balance.
  const anonymous = await t.query(api.portal.invoices, {
    code: "AAAA-AAAA-AAAA",
  });
  expect(anonymous).toEqual({ invoices: [], totals: { balanceFils: 0 } });
});

test("overdue notifier: emits invoice_overdue exactly once per invoice, ever", async () => {
  const { t, asAdmin, nurseryId, studentA } = await setup();
  const invoiceId = await asAdmin.mutation(api.invoices.createManual, {
    nurseryId,
    studentId: studentA,
    amountFils: 50000,
    dueDate: addDaysISO(todayISO(), -3),
  });

  const first = await t.mutation(
    internal.financeCron.notifyOverdueForNursery,
    { nurseryId },
  );
  expect(first).toEqual({ notified: 1 });
  const second = await t.mutation(
    internal.financeCron.notifyOverdueForNursery,
    { nurseryId },
  );
  expect(second).toEqual({ notified: 0 });

  const notifications = await t.run(async (ctx) =>
    ctx.db
      .query("notifications")
      .withIndex("by_target_studentId", (q) =>
        q.eq("target.studentId", studentA),
      )
      .collect(),
  );
  const overdueNotes = notifications.filter((n) => n.type === "invoice_overdue");
  expect(overdueNotes).toHaveLength(1);
  // FR-NOT-3: ids only.
  expect(overdueNotes[0].payload).toEqual({ invoiceId });
});
