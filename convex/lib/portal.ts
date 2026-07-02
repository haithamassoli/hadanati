import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { hashCode, isValidCode, normalizeCode } from "./codes";

export type ResolvedCode = {
  accessCode: Doc<"accessCodes">;
  student: Doc<"students">;
  nursery: Doc<"nurseries">;
};

/**
 * Portal bearer-credential resolution (FR-AUTH-2). Hash the presented code
 * and look up an ACTIVE accessCodes row, then its student + nursery.
 * Returns null on any miss — the caller decides between null/[]/throw.
 * NEVER trust a studentId from the portal client; this is the only door.
 */
export async function resolveCode(
  ctx: QueryCtx,
  code: string,
): Promise<ResolvedCode | null> {
  const normalized = normalizeCode(code);
  if (!isValidCode(normalized)) return null;
  const codeHash = await hashCode(normalized);
  const accessCode = await ctx.db
    .query("accessCodes")
    .withIndex("by_codeHash", (q) => q.eq("codeHash", codeHash))
    .unique();
  if (accessCode === null || !accessCode.active) return null;
  const student = await ctx.db.get("students", accessCode.studentId);
  if (student === null || student.status !== "active") return null;
  const nursery = await ctx.db.get("nurseries", accessCode.nurseryId);
  if (nursery === null) return null;
  return { accessCode, student, nursery };
}

/** Active-year enrollment for a resolved portal student, or null. */
export async function portalEnrollment(
  ctx: QueryCtx,
  resolved: ResolvedCode,
): Promise<Doc<"enrollments"> | null> {
  const yearId = resolved.nursery.activeYear.yearId;
  const enrollments = await ctx.db
    .query("enrollments")
    .withIndex("by_nursery_and_studentId", (q) =>
      q
        .eq("nurseryId", resolved.nursery._id)
        .eq("studentId", resolved.student._id),
    )
    .take(50);
  return enrollments.find((e) => e.yearId === yearId) ?? null;
}
