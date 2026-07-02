import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const roleValidator = v.union(
  v.literal("admin"),
  v.literal("teacher"),
  v.literal("accountant"),
);

export const attendanceStatusValidator = v.union(
  v.literal("present"),
  v.literal("absent"),
  v.literal("late"),
  v.literal("excused"),
);

export const localeValidator = v.union(v.literal("ar"), v.literal("en"));

export const feePlanCadenceValidator = v.union(
  v.literal("monthly"),
  v.literal("term"),
  v.literal("annual"),
  v.literal("one_time"),
);

// Stored invoice status. "overdue" stays in the union for legacy safety but is
// NEVER stored — it is always derived (see lib/finance.ts computeInvoiceStatus).
export const invoiceStatusValidator = v.union(
  v.literal("draft"),
  v.literal("issued"),
  v.literal("partial"),
  v.literal("paid"),
  v.literal("overdue"),
  v.literal("void"),
);

export const paymentMethodValidator = v.union(
  v.literal("cash"),
  v.literal("cliq"),
  v.literal("transfer"),
  v.literal("cheque"),
);

// Field validators exported for reuse in `returns` validators.
export const nurseryFields = {
  name: v.string(),
  logoId: v.optional(v.id("_storage")),
  settings: v.object({
    locale: localeValidator,
    weekStart: v.literal("sun"),
  }),
  activeYear: v.object({
    yearId: v.string(),
    start: v.string(), // "YYYY-MM-DD"
    end: v.string(), // "YYYY-MM-DD"
  }),
};

export const membershipFields = {
  userId: v.id("users"),
  nurseryId: v.id("nurseries"),
  role: roleValidator,
};

export const studentFields = {
  nurseryId: v.id("nurseries"),
  nameAr: v.string(),
  nameEn: v.optional(v.string()),
  dob: v.string(), // "YYYY-MM-DD"
  sex: v.union(v.literal("m"), v.literal("f")),
  photoId: v.optional(v.id("_storage")),
  health: v.optional(v.string()),
  guardians: v.array(
    v.object({
      name: v.string(),
      phone: v.string(),
      relation: v.string(),
    }),
  ),
  consent: v.object({ photos: v.boolean() }),
  status: v.union(v.literal("active"), v.literal("archived")),
};

export const attendanceFields = {
  nurseryId: v.id("nurseries"),
  classroomId: v.id("classrooms"),
  studentId: v.id("students"),
  date: v.string(), // "YYYY-MM-DD"
  status: attendanceStatusValidator,
  note: v.optional(v.string()),
  checkInAt: v.optional(v.number()),
  recordedBy: v.id("users"),
  // LWW conflict detection (PRD §8.5). Set on every upsert; older rows may lack it.
  updatedAt: v.optional(v.number()),
};

export const evaluationFields = {
  nurseryId: v.id("nurseries"),
  studentId: v.id("students"),
  yearId: v.string(),
  week: v.number(),
  scores: v.object({
    academic: v.number(),
    social: v.number(),
    motor: v.number(),
    behavioral: v.number(),
  }),
  note: v.optional(v.string()),
  recordedBy: v.id("users"),
  // LWW conflict detection (PRD §8.5). Set on every upsert; older rows may lack it.
  updatedAt: v.optional(v.number()),
};

export default defineSchema({
  nurseries: defineTable(nurseryFields),

  users: defineTable({
    authId: v.string(), // Better Auth user id (identity.subject)
    name: v.string(),
    email: v.optional(v.string()), // set on new creations; old rows may lack it
    phone: v.optional(v.string()),
    locale: localeValidator,
  }).index("by_authId", ["authId"]),

  memberships: defineTable(membershipFields)
    .index("by_user", ["userId"])
    .index("by_nursery_and_user", ["nurseryId", "userId"]),

  stages: defineTable({
    nurseryId: v.id("nurseries"),
    name: v.string(),
    order: v.number(),
  }).index("by_nurseryId", ["nurseryId"]),

  classrooms: defineTable({
    nurseryId: v.id("nurseries"),
    stageId: v.id("stages"),
    name: v.string(),
    teacherIds: v.array(v.id("users")),
  })
    .index("by_nurseryId", ["nurseryId"])
    .index("by_nurseryId_and_stageId", ["nurseryId", "stageId"]),

  students: defineTable(studentFields)
    .index("by_nurseryId", ["nurseryId"])
    .index("by_nurseryId_and_status", ["nurseryId", "status"]),

  accessCodes: defineTable({
    nurseryId: v.id("nurseries"),
    studentId: v.id("students"),
    codeHash: v.string(),
    active: v.boolean(),
  })
    .index("by_codeHash", ["codeHash"])
    .index("by_nurseryId", ["nurseryId"])
    .index("by_studentId", ["studentId"]),

  enrollments: defineTable({
    nurseryId: v.id("nurseries"),
    studentId: v.id("students"),
    classroomId: v.id("classrooms"),
    yearId: v.string(),
    feePlanId: v.optional(v.id("feePlans")),
  })
    .index("by_nursery_and_classroomId_and_yearId", [
      "nurseryId",
      "classroomId",
      "yearId",
    ])
    .index("by_nursery_and_studentId", ["nurseryId", "studentId"]),

  attendance: defineTable(attendanceFields)
    // Unique (studentId, date) enforced by upsert logic in attendance.upsert.
    .index("by_student_and_date", ["studentId", "date"])
    .index("by_nursery_and_classroom_and_date", [
      "nurseryId",
      "classroomId",
      "date",
    ]),

  evaluations: defineTable(evaluationFields)
    // Unique (studentId, yearId, week) enforced by upsert logic.
    .index("by_student_and_yearId_and_week", ["studentId", "yearId", "week"])
    .index("by_nursery_and_studentId", ["nurseryId", "studentId"]),

  feePlans: defineTable({
    nurseryId: v.id("nurseries"),
    name: v.string(),
    amountFils: v.number(), // integer fils (JOD × 1000)
    cadence: feePlanCadenceValidator,
  }).index("by_nurseryId", ["nurseryId"]),

  invoices: defineTable({
    nurseryId: v.id("nurseries"),
    studentId: v.id("students"),
    feePlanId: v.optional(v.id("feePlans")),
    amountFils: v.number(),
    dueDate: v.string(), // "YYYY-MM-DD"
    // Idempotency key for plan-generated invoices: "YYYY-MM" (monthly),
    // yearId (term/annual), or `${yearId}-once` (one_time). Absent on manual.
    period: v.optional(v.string()),
    description: v.optional(v.string()),
    status: invoiceStatusValidator,
    // Set once by the daily overdue notifier — an invoice is only ever
    // notified about a single time (FR-NOT-2).
    overdueNotifiedAt: v.optional(v.number()),
  })
    .index("by_nurseryId", ["nurseryId"])
    .index("by_nurseryId_and_status", ["nurseryId", "status"])
    .index("by_nursery_and_studentId", ["nurseryId", "studentId"]),

  payments: defineTable({
    nurseryId: v.id("nurseries"),
    invoiceId: v.id("invoices"),
    amountFils: v.number(),
    method: paymentMethodValidator,
    paidAt: v.string(), // "YYYY-MM-DD" (project-wide date rule)
    receivedBy: v.id("users"),
    note: v.optional(v.string()),
  })
    .index("by_nurseryId", ["nurseryId"])
    .index("by_nurseryId_and_paidAt", ["nurseryId", "paidAt"])
    .index("by_invoiceId", ["invoiceId"]),

  expenses: defineTable({
    nurseryId: v.id("nurseries"),
    category: v.string(),
    amountFils: v.number(),
    date: v.string(), // "YYYY-MM-DD"
    note: v.optional(v.string()),
  })
    .index("by_nurseryId", ["nurseryId"])
    .index("by_nurseryId_and_date", ["nurseryId", "date"]),

  announcements: defineTable({
    nurseryId: v.id("nurseries"),
    classroomId: v.optional(v.id("classrooms")),
    title: v.string(),
    body: v.string(),
    imageId: v.optional(v.id("_storage")),
    createdBy: v.id("users"),
    createdAt: v.number(),
  }).index("by_nurseryId", ["nurseryId"]),

  notifications: defineTable({
    nurseryId: v.id("nurseries"),
    target: v.object({
      studentId: v.optional(v.id("students")),
      userId: v.optional(v.id("users")),
    }),
    type: v.string(),
    payload: v.record(v.string(), v.string()),
    readAt: v.optional(v.number()),
  })
    .index("by_nurseryId", ["nurseryId"])
    .index("by_target_studentId", ["target.studentId"]),

  pushSubs: defineTable({
    nurseryId: v.id("nurseries"),
    owner: v.object({
      userId: v.optional(v.id("users")),
      accessCodeId: v.optional(v.id("accessCodes")),
    }),
    subscription: v.object({
      endpoint: v.string(),
      expirationTime: v.optional(v.union(v.number(), v.null())),
      keys: v.object({ p256dh: v.string(), auth: v.string() }),
    }),
  })
    .index("by_nurseryId", ["nurseryId"])
    .index("by_owner_accessCodeId", ["owner.accessCodeId"]),

  syncLog: defineTable({
    clientMutationId: v.string(),
    processedAt: v.number(),
  }).index("by_clientMutationId", ["clientMutationId"]),
});
