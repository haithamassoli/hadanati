import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export type Role = "admin" | "teacher" | "accountant";

/**
 * Mandatory tenancy guard. Every staff query/mutation starts with this.
 *
 * Resolves the caller's app user via the Better Auth identity
 * (identity.subject = Better Auth user id = users.authId), then asserts
 * membership in the given nursery and, optionally, one of the given roles.
 *
 * Throws ConvexError("unauthorized") when not signed in / no user row,
 * ConvexError("forbidden") when not a member or role mismatch.
 */
export async function requireStaff(
  ctx: QueryCtx,
  nurseryId: Id<"nurseries">,
  roles?: Role[],
): Promise<{ user: Doc<"users">; membership: Doc<"memberships"> }> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    throw new ConvexError("unauthorized");
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
    .unique();
  if (user === null) {
    throw new ConvexError("unauthorized");
  }
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_nursery_and_user", (q) =>
      q.eq("nurseryId", nurseryId).eq("userId", user._id),
    )
    .unique();
  if (membership === null) {
    throw new ConvexError("forbidden");
  }
  if (roles !== undefined && !roles.includes(membership.role)) {
    throw new ConvexError("forbidden");
  }
  return { user, membership };
}

/** Classrooms in the nursery where the given user is listed as a teacher. */
export async function teacherClassrooms(
  ctx: QueryCtx,
  nurseryId: Id<"nurseries">,
  userId: Id<"users">,
): Promise<Doc<"classrooms">[]> {
  const classrooms = await ctx.db
    .query("classrooms")
    .withIndex("by_nurseryId", (q) => q.eq("nurseryId", nurseryId))
    .take(100);
  return classrooms.filter((c) => c.teacherIds.includes(userId));
}

/**
 * Teacher read/write scoping (PRD §6): the user must teach the classroom of
 * the student's enrollment for the given yearId. Throws ConvexError("forbidden")
 * otherwise.
 */
export async function assertTeacherOfStudent(
  ctx: QueryCtx,
  userId: Id<"users">,
  nurseryId: Id<"nurseries">,
  studentId: Id<"students">,
  yearId: string,
): Promise<void> {
  const enrollments = await ctx.db
    .query("enrollments")
    .withIndex("by_nursery_and_studentId", (q) =>
      q.eq("nurseryId", nurseryId).eq("studentId", studentId),
    )
    .take(50);
  const enrollment = enrollments.find((e) => e.yearId === yearId);
  if (enrollment === undefined) {
    throw new ConvexError("forbidden");
  }
  const classroom = await ctx.db.get("classrooms", enrollment.classroomId);
  if (classroom === null || !classroom.teacherIds.includes(userId)) {
    throw new ConvexError("forbidden");
  }
}
