import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireStaff } from "./lib/guard";
import { emitNotifications } from "./lib/notify";

/**
 * Compose an announcement (FR-ANN-1).
 * - admin: any classroom of the nursery, or nursery-wide (classroomId omitted)
 * - teacher: OWN classrooms only, never nursery-wide
 * Fans out one "announcement" notification per active-year-enrolled student
 * in scope and schedules push delivery.
 */
export const create = mutation({
  args: {
    nurseryId: v.id("nurseries"),
    classroomId: v.optional(v.id("classrooms")),
    title: v.string(),
    body: v.string(),
    imageId: v.optional(v.id("_storage")),
  },
  returns: v.id("announcements"),
  handler: async (ctx, args) => {
    const { user, membership } = await requireStaff(ctx, args.nurseryId, [
      "admin",
      "teacher",
    ]);
    const nursery = await ctx.db.get("nurseries", args.nurseryId);
    if (nursery === null) {
      throw new ConvexError("forbidden");
    }
    if (args.title.trim() === "" || args.body.trim() === "") {
      throw new ConvexError("empty_announcement");
    }

    let classroom: Doc<"classrooms"> | null = null;
    if (args.classroomId !== undefined) {
      classroom = await ctx.db.get("classrooms", args.classroomId);
      if (classroom === null || classroom.nurseryId !== args.nurseryId) {
        throw new ConvexError("forbidden");
      }
    }
    if (membership.role === "teacher") {
      // Teachers: own classrooms only, never nursery-wide.
      if (classroom === null || !classroom.teacherIds.includes(user._id)) {
        throw new ConvexError("forbidden");
      }
    }

    const announcementId = await ctx.db.insert("announcements", {
      nurseryId: args.nurseryId,
      classroomId: args.classroomId,
      title: args.title,
      body: args.body,
      imageId: args.imageId,
      createdBy: user._id,
      createdAt: Date.now(),
    });

    // Fan-out scope: the classroom roster, or every active-year-enrolled
    // student for nursery-wide.
    const yearId = nursery.activeYear.yearId;
    const studentIds = new Set<Id<"students">>();
    const classroomsInScope =
      classroom !== null
        ? [classroom]
        : await ctx.db
            .query("classrooms")
            .withIndex("by_nurseryId", (q) => q.eq("nurseryId", args.nurseryId))
            .take(100);
    for (const room of classroomsInScope) {
      const enrollments = await ctx.db
        .query("enrollments")
        .withIndex("by_nursery_and_classroomId_and_yearId", (q) =>
          q
            .eq("nurseryId", args.nurseryId)
            .eq("classroomId", room._id)
            .eq("yearId", yearId),
        )
        .take(1000);
      for (const enrollment of enrollments) {
        studentIds.add(enrollment.studentId);
      }
    }

    // CEILING: a single mutation comfortably handles ~1000 notification
    // inserts (Convex hard limit is ~8K writes/transaction). A nursery is
    // a few hundred students at most (PRD), so one transaction is fine.
    // If a tenant ever exceeds ~1000 enrolled students, shard this fan-out
    // into batches via ctx.scheduler.runAfter / @convex-dev/workpool.
    await emitNotifications(
      ctx,
      args.nurseryId,
      [...studentIds].map((studentId) => ({
        studentId,
        type: "announcement",
        // FR-NOT-3: ids only, no title/body in the payload.
        payload: { announcementId },
      })),
    );

    return announcementId;
  },
});

/** Staff feed: newest first, with author/classroom names + image URL. */
export const list = query({
  args: { nurseryId: v.id("nurseries") },
  returns: v.array(
    v.object({
      _id: v.id("announcements"),
      title: v.string(),
      body: v.string(),
      classroomId: v.optional(v.id("classrooms")),
      classroomName: v.union(v.string(), v.null()),
      authorName: v.string(),
      createdBy: v.id("users"),
      createdAt: v.number(),
      imageUrl: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId);
    const rows = await ctx.db
      .query("announcements")
      .withIndex("by_nurseryId", (q) => q.eq("nurseryId", args.nurseryId))
      .order("desc")
      .take(100);

    const authorNames = new Map<Id<"users">, string>();
    const classroomNames = new Map<Id<"classrooms">, string | null>();
    const feed = [];
    for (const a of rows) {
      if (!authorNames.has(a.createdBy)) {
        const author = await ctx.db.get("users", a.createdBy);
        authorNames.set(a.createdBy, author?.name ?? "");
      }
      let classroomName: string | null = null;
      if (a.classroomId !== undefined) {
        if (!classroomNames.has(a.classroomId)) {
          const classroom = await ctx.db.get("classrooms", a.classroomId);
          classroomNames.set(a.classroomId, classroom?.name ?? null);
        }
        classroomName = classroomNames.get(a.classroomId) ?? null;
      }
      feed.push({
        _id: a._id,
        title: a.title,
        body: a.body,
        ...(a.classroomId !== undefined ? { classroomId: a.classroomId } : {}),
        classroomName,
        authorName: authorNames.get(a.createdBy) ?? "",
        createdBy: a.createdBy,
        createdAt: a.createdAt,
        imageUrl:
          a.imageId !== undefined ? await ctx.storage.getUrl(a.imageId) : null,
      });
    }
    return feed;
  },
});

/** Delete an announcement. Admin, or the announcement's author. */
export const remove = mutation({
  args: {
    nurseryId: v.id("nurseries"),
    announcementId: v.id("announcements"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, membership } = await requireStaff(ctx, args.nurseryId, [
      "admin",
      "teacher",
    ]);
    const announcement = await ctx.db.get("announcements", args.announcementId);
    if (announcement === null || announcement.nurseryId !== args.nurseryId) {
      throw new ConvexError("forbidden");
    }
    if (membership.role !== "admin" && announcement.createdBy !== user._id) {
      throw new ConvexError("forbidden");
    }
    if (announcement.imageId !== undefined) {
      await ctx.storage.delete(announcement.imageId);
    }
    await ctx.db.delete("announcements", args.announcementId);
    return null;
  },
});

/** Upload URL for announcement images. Admin or teacher. */
export const generateUploadUrl = mutation({
  args: { nurseryId: v.id("nurseries") },
  returns: v.string(),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId, ["admin", "teacher"]);
    return await ctx.storage.generateUploadUrl();
  },
});
