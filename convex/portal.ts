import { ConvexError, v } from "convex/values";
import { HOUR, RateLimiter } from "@convex-dev/rate-limiter";
import { mutation, query } from "./_generated/server";
import { components } from "./_generated/api";
import { paymentMethodValidator } from "./schema";
import { hashCode, isValidCode, normalizeCode } from "./lib/codes";
import { portalEnrollment, resolveCode } from "./lib/portal";
import { todayISO } from "./lib/shared";
import { computeInvoiceStatus } from "./lib/finance";

// PUBLIC, NO staff auth: the access code IS the bearer credential (FR-AUTH-2).
// Every function hashes the code → accessCodes.by_codeHash (active) → student.
// The client is NEVER trusted with a studentId.

const rateLimiter = new RateLimiter(components.rateLimiter, {
  // Per code-value-hash: brute-forcing a specific code.
  portalVerifyPerCode: { kind: "token bucket", rate: 10, period: HOUR },
  // Global fallback: attackers rotating random codes (each hash is fresh,
  // so the per-hash bucket alone would never trip). Only FAILED lookups
  // consume this bucket, so legitimate verifies don't starve it.
  portalVerifyGlobal: { kind: "token bucket", rate: 30, period: HOUR },
});

const scoresValidator = v.object({
  academic: v.number(),
  social: v.number(),
  motor: v.number(),
  behavioral: v.number(),
});

/**
 * Verify an access code (rate-limited). Mutation, not query, because the
 * rate limiter must persist consumed tokens.
 */
export const verify = mutation({
  args: { code: v.string() },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      student: v.object({
        id: v.id("students"),
        nameAr: v.string(),
        photoUrl: v.union(v.string(), v.null()),
      }),
      nurseryName: v.string(),
    }),
    v.object({
      ok: v.literal(false),
      reason: v.union(v.literal("invalid"), v.literal("rate_limited")),
    }),
  ),
  handler: async (ctx, args) => {
    const normalized = normalizeCode(args.code);
    if (!isValidCode(normalized)) {
      return { ok: false as const, reason: "invalid" as const };
    }
    const codeHash = await hashCode(normalized);

    // 10 attempts/hour per presented code value.
    const perCode = await rateLimiter.limit(ctx, "portalVerifyPerCode", {
      key: codeHash,
    });
    if (!perCode.ok) {
      return { ok: false as const, reason: "rate_limited" as const };
    }

    const resolved = await resolveCode(ctx, args.code);
    if (resolved === null) {
      // Failed lookup: also drain the global fallback bucket.
      const global = await rateLimiter.limit(ctx, "portalVerifyGlobal");
      if (!global.ok) {
        return { ok: false as const, reason: "rate_limited" as const };
      }
      return { ok: false as const, reason: "invalid" as const };
    }

    const photoUrl =
      resolved.student.photoId !== undefined
        ? await ctx.storage.getUrl(resolved.student.photoId)
        : null;
    return {
      ok: true as const,
      student: {
        id: resolved.student._id,
        nameAr: resolved.student.nameAr,
        photoUrl,
      },
      nurseryName: resolved.nursery.name,
    };
  },
});

/** Portal home (FR-PAR-1). Returns null when the code is invalid/revoked. */
export const home = query({
  args: { code: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      student: v.object({
        nameAr: v.string(),
        photoUrl: v.union(v.string(), v.null()),
      }),
      nurseryName: v.string(),
      classroomName: v.union(v.string(), v.null()),
      todayAttendance: v.union(
        v.null(),
        v.object({
          status: v.string(),
          note: v.optional(v.string()),
          checkInAt: v.optional(v.number()),
        }),
      ),
      latestEvaluation: v.union(
        v.null(),
        v.object({
          week: v.number(),
          scores: scoresValidator,
          note: v.optional(v.string()),
        }),
      ),
      balanceFils: v.number(),
      yearId: v.string(),
      yearStart: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const resolved = await resolveCode(ctx, args.code);
    if (resolved === null) return null;
    const { student, nursery } = resolved;
    const yearId = nursery.activeYear.yearId;

    const enrollment = await portalEnrollment(ctx, resolved);
    let classroomName: string | null = null;
    if (enrollment !== null) {
      const classroom = await ctx.db.get("classrooms", enrollment.classroomId);
      classroomName = classroom?.name ?? null;
    }

    // Today's attendance (Asia/Amman day).
    const today = todayISO();
    const attendance = await ctx.db
      .query("attendance")
      .withIndex("by_student_and_date", (q) =>
        q.eq("studentId", student._id).eq("date", today),
      )
      .unique();

    const latestEvaluation = await ctx.db
      .query("evaluations")
      .withIndex("by_student_and_yearId_and_week", (q) =>
        q.eq("studentId", student._id).eq("yearId", yearId),
      )
      .order("desc")
      .first();

    // Balance due = outstanding invoices (issued/partial/overdue) minus
    // their recorded payments. 0 when there are no invoices.
    let balanceFils = 0;
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_nursery_and_studentId", (q) =>
        q.eq("nurseryId", nursery._id).eq("studentId", student._id),
      )
      .take(200);
    for (const invoice of invoices) {
      if (
        invoice.status !== "issued" &&
        invoice.status !== "partial" &&
        invoice.status !== "overdue"
      ) {
        continue;
      }
      balanceFils += invoice.amountFils;
      const payments = await ctx.db
        .query("payments")
        .withIndex("by_invoiceId", (q) => q.eq("invoiceId", invoice._id))
        .take(100);
      for (const payment of payments) {
        balanceFils -= payment.amountFils;
      }
    }

    const photoUrl =
      student.photoId !== undefined
        ? await ctx.storage.getUrl(student.photoId)
        : null;

    return {
      student: { nameAr: student.nameAr, photoUrl },
      nurseryName: nursery.name,
      classroomName,
      todayAttendance:
        attendance === null
          ? null
          : {
              status: attendance.status,
              ...(attendance.note !== undefined ? { note: attendance.note } : {}),
              ...(attendance.checkInAt !== undefined
                ? { checkInAt: attendance.checkInAt }
                : {}),
            },
      latestEvaluation:
        latestEvaluation === null
          ? null
          : {
              week: latestEvaluation.week,
              scores: latestEvaluation.scores,
              ...(latestEvaluation.note !== undefined
                ? { note: latestEvaluation.note }
                : {}),
            },
      balanceFils,
      yearId,
      yearStart: nursery.activeYear.start,
    };
  },
});

/** Full-year evaluations for the progress charts (FR-PAR-2). */
export const progress = query({
  args: { code: v.string() },
  returns: v.array(
    v.object({
      week: v.number(),
      scores: scoresValidator,
      note: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const resolved = await resolveCode(ctx, args.code);
    if (resolved === null) return [];
    const yearId = resolved.nursery.activeYear.yearId;
    const rows = await ctx.db
      .query("evaluations")
      .withIndex("by_student_and_yearId_and_week", (q) =>
        q.eq("studentId", resolved.student._id).eq("yearId", yearId),
      )
      .take(60);
    return rows.map((row) => ({
      week: row.week,
      scores: row.scores,
      ...(row.note !== undefined ? { note: row.note } : {}),
    }));
  },
});

/** Nursery-wide + own-classroom announcements, newest first (FR-PAR-4). */
export const announcementsFeed = query({
  args: { code: v.string() },
  returns: v.array(
    v.object({
      _id: v.id("announcements"),
      title: v.string(),
      body: v.string(),
      imageUrl: v.union(v.string(), v.null()),
      classroomName: v.union(v.string(), v.null()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const resolved = await resolveCode(ctx, args.code);
    if (resolved === null) return [];
    const enrollment = await portalEnrollment(ctx, resolved);

    const recent = await ctx.db
      .query("announcements")
      .withIndex("by_nurseryId", (q) => q.eq("nurseryId", resolved.nursery._id))
      .order("desc")
      .take(100);
    const inScope = recent
      .filter(
        (a) =>
          a.classroomId === undefined ||
          (enrollment !== null && a.classroomId === enrollment.classroomId),
      )
      .slice(0, 50);

    const feed = [];
    for (const a of inScope) {
      let classroomName: string | null = null;
      if (a.classroomId !== undefined) {
        const classroom = await ctx.db.get("classrooms", a.classroomId);
        classroomName = classroom?.name ?? null;
      }
      feed.push({
        _id: a._id,
        title: a.title,
        body: a.body,
        imageUrl:
          a.imageId !== undefined ? await ctx.storage.getUrl(a.imageId) : null,
        classroomName,
        createdAt: a.createdAt,
      });
    }
    return feed;
  },
});

/** In-app notification inbox for the student, newest first (FR-NOT-1). */
export const inbox = query({
  args: { code: v.string() },
  returns: v.array(
    v.object({
      _id: v.id("notifications"),
      _creationTime: v.number(),
      type: v.string(),
      payload: v.record(v.string(), v.string()),
      readAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const resolved = await resolveCode(ctx, args.code);
    if (resolved === null) return [];
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_target_studentId", (q) =>
        q.eq("target.studentId", resolved.student._id),
      )
      .order("desc")
      .take(50);
    return rows.map((row) => ({
      _id: row._id,
      _creationTime: row._creationTime,
      type: row.type,
      payload: row.payload,
      ...(row.readAt !== undefined ? { readAt: row.readAt } : {}),
    }));
  },
});

/**
 * Read-only invoices + payments for the parent (FR-PAR-3), newest first.
 * Draft and void invoices are internal and never shown to parents.
 * Returns an empty list + zero balance on an invalid/revoked code.
 */
export const invoices = query({
  args: { code: v.string() },
  returns: v.object({
    invoices: v.array(
      v.object({
        _id: v.id("invoices"),
        description: v.optional(v.string()),
        planName: v.optional(v.string()),
        period: v.optional(v.string()),
        amountFils: v.number(),
        paidFils: v.number(),
        dueDate: v.string(),
        computedStatus: v.union(
          v.literal("issued"),
          v.literal("partial"),
          v.literal("paid"),
          v.literal("overdue"),
        ),
        payments: v.array(
          v.object({
            paidAt: v.string(),
            amountFils: v.number(),
            method: paymentMethodValidator,
          }),
        ),
      }),
    ),
    totals: v.object({ balanceFils: v.number() }),
  }),
  handler: async (ctx, args) => {
    const resolved = await resolveCode(ctx, args.code);
    if (resolved === null) {
      return { invoices: [], totals: { balanceFils: 0 } };
    }
    const today = todayISO();
    const rows = await ctx.db
      .query("invoices")
      .withIndex("by_nursery_and_studentId", (q) =>
        q
          .eq("nurseryId", resolved.nursery._id)
          .eq("studentId", resolved.student._id),
      )
      .order("desc")
      .take(200);

    let balanceFils = 0;
    const result = [];
    const planNames = new Map<string, string>();
    for (const invoice of rows) {
      if (invoice.status === "draft" || invoice.status === "void") continue;
      let planName: string | undefined;
      if (invoice.feePlanId !== undefined) {
        if (!planNames.has(invoice.feePlanId)) {
          const plan = await ctx.db.get("feePlans", invoice.feePlanId);
          planNames.set(invoice.feePlanId, plan?.name ?? "");
        }
        planName = planNames.get(invoice.feePlanId);
      }
      const paymentRows = await ctx.db
        .query("payments")
        .withIndex("by_invoiceId", (q) => q.eq("invoiceId", invoice._id))
        .take(100);
      const paidFils = paymentRows.reduce((sum, p) => sum + p.amountFils, 0);
      const computed = computeInvoiceStatus(
        invoice.status,
        invoice.dueDate,
        today,
      );
      if (computed !== "paid") {
        balanceFils += invoice.amountFils - paidFils;
      }
      result.push({
        _id: invoice._id,
        ...(invoice.description !== undefined
          ? { description: invoice.description }
          : {}),
        ...(planName !== undefined && planName !== "" ? { planName } : {}),
        ...(invoice.period !== undefined ? { period: invoice.period } : {}),
        amountFils: invoice.amountFils,
        paidFils,
        dueDate: invoice.dueDate,
        computedStatus: computed as "issued" | "partial" | "paid" | "overdue",
        payments: paymentRows.map((p) => ({
          paidAt: p.paidAt,
          amountFils: p.amountFils,
          method: p.method,
        })),
      });
    }
    return { invoices: result, totals: { balanceFils } };
  },
});

/** Mark one of the student's notifications as read. */
export const markRead = mutation({
  args: { code: v.string(), notificationId: v.id("notifications") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const resolved = await resolveCode(ctx, args.code);
    if (resolved === null) {
      throw new ConvexError("invalid_code");
    }
    const notification = await ctx.db.get("notifications", args.notificationId);
    if (
      notification === null ||
      notification.target.studentId !== resolved.student._id
    ) {
      throw new ConvexError("forbidden");
    }
    if (notification.readAt === undefined) {
      await ctx.db.patch("notifications", args.notificationId, {
        readAt: Date.now(),
      });
    }
    return null;
  },
});
