import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireStaff } from "./lib/guard";
import { generateRawCode, hashCode, normalizeCode } from "./lib/codes";

/**
 * Generate a new parent access code for a student (FR-AUTH-2). Admin only.
 * The raw code is returned ONCE and never stored — only its SHA-256 hash.
 * Regeneration deactivates every previous active code for the student.
 */
export const generate = mutation({
  args: {
    nurseryId: v.id("nurseries"),
    studentId: v.id("students"),
  },
  returns: v.object({ code: v.string() }),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId, ["admin"]);
    const student = await ctx.db.get("students", args.studentId);
    if (student === null || student.nurseryId !== args.nurseryId) {
      throw new ConvexError("forbidden");
    }

    // Regeneration invalidates all previous codes for this student.
    const previous = await ctx.db
      .query("accessCodes")
      .withIndex("by_studentId", (q) => q.eq("studentId", args.studentId))
      .take(100);
    for (const row of previous) {
      if (row.active) {
        await ctx.db.patch("accessCodes", row._id, { active: false });
      }
    }

    const raw = generateRawCode();
    const codeHash = await hashCode(normalizeCode(raw));
    await ctx.db.insert("accessCodes", {
      nurseryId: args.nurseryId,
      studentId: args.studentId,
      codeHash,
      active: true,
    });
    return { code: raw };
  },
});

/**
 * List a student's access codes for the admin UI. Never returns hashes
 * (and raw codes are never stored at all).
 */
export const listForStudent = query({
  args: {
    nurseryId: v.id("nurseries"),
    studentId: v.id("students"),
  },
  returns: v.array(
    v.object({
      _id: v.id("accessCodes"),
      _creationTime: v.number(),
      active: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId, ["admin"]);
    const student = await ctx.db.get("students", args.studentId);
    if (student === null || student.nurseryId !== args.nurseryId) {
      throw new ConvexError("forbidden");
    }
    const rows = await ctx.db
      .query("accessCodes")
      .withIndex("by_studentId", (q) => q.eq("studentId", args.studentId))
      .order("desc")
      .take(50);
    return rows.map((row) => ({
      _id: row._id,
      _creationTime: row._creationTime,
      active: row.active,
    }));
  },
});

/** Revoke a single access code. Admin only. */
export const revoke = mutation({
  args: {
    nurseryId: v.id("nurseries"),
    accessCodeId: v.id("accessCodes"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId, ["admin"]);
    const accessCode = await ctx.db.get("accessCodes", args.accessCodeId);
    if (accessCode === null || accessCode.nurseryId !== args.nurseryId) {
      throw new ConvexError("forbidden");
    }
    if (accessCode.active) {
      await ctx.db.patch("accessCodes", args.accessCodeId, { active: false });
    }
    return null;
  },
});
