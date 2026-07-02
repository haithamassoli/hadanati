import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  localeValidator,
  membershipFields,
  nurseryFields,
  roleValidator,
} from "./schema";
import { requireStaff } from "./lib/guard";

const nurseryDoc = v.object({
  _id: v.id("nurseries"),
  _creationTime: v.number(),
  ...nurseryFields,
});

const membershipDoc = v.object({
  _id: v.id("memberships"),
  _creationTime: v.number(),
  ...membershipFields,
});

/**
 * The caller's first membership and its nursery, or null when signed out
 * (or when the user has no membership yet).
 */
export const getMine = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      nursery: nurseryDoc,
      role: roleValidator,
      membership: membershipDoc,
    }),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return null;
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .unique();
    if (user === null) {
      return null;
    }
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (membership === null) {
      return null;
    }
    const nursery = await ctx.db.get("nurseries", membership.nurseryId);
    if (nursery === null) {
      return null;
    }
    return { nursery, role: membership.role, membership };
  },
});

export const update = mutation({
  args: {
    nurseryId: v.id("nurseries"),
    name: v.optional(v.string()),
    logoId: v.optional(v.id("_storage")),
    settings: v.optional(
      v.object({
        locale: localeValidator,
        weekStart: v.literal("sun"),
      }),
    ),
    activeYear: v.optional(
      v.object({
        yearId: v.string(),
        start: v.string(),
        end: v.string(),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.nurseryId, ["admin"]);
    const { nurseryId, ...patch } = args;
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) {
        updates[key] = value;
      }
    }
    await ctx.db.patch("nurseries", nurseryId, updates);
    return null;
  },
});
