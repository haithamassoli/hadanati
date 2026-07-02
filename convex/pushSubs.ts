import { ConvexError, v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
} from "./_generated/server";
import { resolveCode } from "./lib/portal";

// Push-subscription storage + delivery plumbing (default runtime).
// The actual Web Push send lives in convex/push.ts ("use node") — this file
// holds the mutations/queries because a "use node" file may only export
// actions.

const subscriptionValidator = v.object({
  endpoint: v.string(),
  expirationTime: v.optional(v.union(v.number(), v.null())),
  keys: v.object({ p256dh: v.string(), auth: v.string() }),
});

/**
 * Opt in to Web Push for the child behind the access code (FR-NOT-1).
 * Upserts by (accessCodeId, endpoint) so re-subscribing the same browser
 * refreshes keys instead of duplicating.
 */
export const subscribe = mutation({
  args: {
    code: v.string(),
    subscription: subscriptionValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const resolved = await resolveCode(ctx, args.code);
    if (resolved === null) {
      throw new ConvexError("invalid_code");
    }
    const existing = await ctx.db
      .query("pushSubs")
      .withIndex("by_owner_accessCodeId", (q) =>
        q.eq("owner.accessCodeId", resolved.accessCode._id),
      )
      .take(20);
    const match = existing.find(
      (s) => s.subscription.endpoint === args.subscription.endpoint,
    );
    if (match !== undefined) {
      await ctx.db.patch("pushSubs", match._id, {
        subscription: args.subscription,
      });
    } else {
      await ctx.db.insert("pushSubs", {
        nurseryId: resolved.nursery._id,
        owner: { accessCodeId: resolved.accessCode._id },
        subscription: args.subscription,
      });
    }
    return null;
  },
});

/** Remove this browser's push subscription for the code. */
export const unsubscribe = mutation({
  args: { code: v.string(), endpoint: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const resolved = await resolveCode(ctx, args.code);
    if (resolved === null) {
      throw new ConvexError("invalid_code");
    }
    const subs = await ctx.db
      .query("pushSubs")
      .withIndex("by_owner_accessCodeId", (q) =>
        q.eq("owner.accessCodeId", resolved.accessCode._id),
      )
      .take(20);
    for (const sub of subs) {
      if (sub.subscription.endpoint === args.endpoint) {
        await ctx.db.delete("pushSubs", sub._id);
      }
    }
    return null;
  },
});

/**
 * Delivery plan for push.deliver: notification → student → ACTIVE access
 * codes → their push subscriptions. Payload is type + ids only (FR-NOT-3).
 */
export const deliveryTargets = internalQuery({
  args: { notificationIds: v.array(v.id("notifications")) },
  returns: v.array(
    v.object({
      pushSubId: v.id("pushSubs"),
      subscription: v.object({
        endpoint: v.string(),
        keys: v.object({ p256dh: v.string(), auth: v.string() }),
      }),
      payload: v.record(v.string(), v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const targets = [];
    for (const notificationId of args.notificationIds) {
      const notification = await ctx.db.get("notifications", notificationId);
      if (notification === null) continue;
      const studentId = notification.target.studentId;
      if (studentId === undefined) continue;

      // NO PII (FR-NOT-3): type + ids/dates only; content fetched on open.
      const payload: Record<string, string> = {
        type: notification.type,
        notificationId,
        ...notification.payload,
      };

      const codes = await ctx.db
        .query("accessCodes")
        .withIndex("by_studentId", (q) => q.eq("studentId", studentId))
        .take(100);
      for (const accessCode of codes) {
        if (!accessCode.active) continue;
        const subs = await ctx.db
          .query("pushSubs")
          .withIndex("by_owner_accessCodeId", (q) =>
            q.eq("owner.accessCodeId", accessCode._id),
          )
          .take(20);
        for (const sub of subs) {
          targets.push({
            pushSubId: sub._id,
            subscription: {
              endpoint: sub.subscription.endpoint,
              keys: sub.subscription.keys,
            },
            payload,
          });
        }
      }
    }
    return targets;
  },
});

/** Delete a subscription the push service reported gone (404/410). */
export const removeSub = internalMutation({
  args: { pushSubId: v.id("pushSubs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const sub = await ctx.db.get("pushSubs", args.pushSubId);
    if (sub !== null) {
      await ctx.db.delete("pushSubs", args.pushSubId);
    }
    return null;
  },
});
