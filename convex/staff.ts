import { ConvexError, v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { roleValidator } from "./schema";
import { requireStaff } from "./lib/guard";
import { createAuth } from "./auth";

export const listMembers = query({
  args: { nurseryId: v.id("nurseries") },
  returns: v.array(
    v.object({
      membershipId: v.id("memberships"),
      role: roleValidator,
      userId: v.id("users"),
      name: v.string(),
      email: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId, ["admin"]);
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_nursery_and_user", (q) => q.eq("nurseryId", args.nurseryId))
      .take(200);
    const members = [];
    for (const membership of memberships) {
      const user = await ctx.db.get("users", membership.userId);
      if (user === null) continue;
      members.push({
        membershipId: membership._id,
        role: membership.role,
        userId: user._id,
        name: user.name,
        email: user.email ?? "", // rows created before users.email existed
      });
    }
    return members;
  },
});

/** Actions have no ctx.db; the admin check runs in this internal query. */
export const assertAdmin = internalQuery({
  args: { nurseryId: v.id("nurseries") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId, ["admin"]);
    return null;
  },
});

export const createStaff = action({
  args: {
    nurseryId: v.id("nurseries"),
    email: v.string(),
    password: v.string(),
    name: v.string(),
    role: roleValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runQuery(internal.staff.assertAdmin, {
      nurseryId: args.nurseryId,
    });

    // Create the Better Auth credential user server-side; the user.onCreate
    // trigger (convex/auth.ts) mirrors it into our `users` table.
    const auth = createAuth(ctx);
    let authId: string;
    try {
      const signUp = await auth.api.signUpEmail({
        body: {
          email: args.email,
          password: args.password,
          name: args.name,
        },
      });
      authId = signUp.user.id;
    } catch (error) {
      const body = (error as { body?: { code?: string } }).body;
      const message = error instanceof Error ? error.message : String(error);
      if (body?.code === "USER_ALREADY_EXISTS" || /already exists/i.test(message)) {
        throw new ConvexError("email_exists");
      }
      throw error;
    }

    await ctx.runMutation(internal.staff.finishCreateStaff, {
      nurseryId: args.nurseryId,
      authId,
      email: args.email,
      role: args.role,
    });
    return null;
  },
});

export const finishCreateStaff = internalMutation({
  args: {
    nurseryId: v.id("nurseries"),
    authId: v.string(),
    email: v.string(),
    role: roleValidator,
  },
  returns: v.object({
    userId: v.id("users"),
    membershipId: v.id("memberships"),
  }),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", args.authId))
      .unique();
    if (user === null) {
      throw new ConvexError("user_not_created");
    }
    if (user.email === undefined) {
      await ctx.db.patch("users", user._id, { email: args.email });
    }
    const membershipId = await ctx.db.insert("memberships", {
      userId: user._id,
      nurseryId: args.nurseryId,
      role: args.role,
    });
    return { userId: user._id, membershipId };
  },
});

/** Throws ConvexError("last_admin") if this membership is the nursery's only admin. */
async function assertNotLastAdmin(
  ctx: MutationCtx,
  nurseryId: Id<"nurseries">,
  membershipId: Id<"memberships">,
): Promise<void> {
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_nursery_and_user", (q) => q.eq("nurseryId", nurseryId))
    .take(200);
  const otherAdmins = memberships.filter(
    (m) => m.role === "admin" && m._id !== membershipId,
  );
  if (otherAdmins.length === 0) {
    throw new ConvexError("last_admin");
  }
}

export const updateRole = mutation({
  args: {
    nurseryId: v.id("nurseries"),
    membershipId: v.id("memberships"),
    role: roleValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId, ["admin"]);
    const membership = await ctx.db.get("memberships", args.membershipId);
    if (membership === null || membership.nurseryId !== args.nurseryId) {
      throw new ConvexError("forbidden");
    }
    if (membership.role === "admin" && args.role !== "admin") {
      await assertNotLastAdmin(ctx, args.nurseryId, args.membershipId);
    }
    await ctx.db.patch("memberships", args.membershipId, { role: args.role });
    return null;
  },
});

export const removeMember = mutation({
  args: {
    nurseryId: v.id("nurseries"),
    membershipId: v.id("memberships"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId, ["admin"]);
    const membership = await ctx.db.get("memberships", args.membershipId);
    if (membership === null || membership.nurseryId !== args.nurseryId) {
      throw new ConvexError("forbidden");
    }
    if (membership.role === "admin") {
      await assertNotLastAdmin(ctx, args.nurseryId, args.membershipId);
    }
    await ctx.db.delete("memberships", args.membershipId);
    return null;
  },
});
