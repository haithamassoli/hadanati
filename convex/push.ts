"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// Web Push delivery (FR-NOT-1). This file is Node-only because the web-push
// package needs Node built-ins; all queries/mutations live in
// convex/pushSubs.ts (a "use node" file may only export actions).

type DeliveryTarget = {
  pushSubId: Id<"pushSubs">;
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
  payload: Record<string, string>;
};

export const deliver = internalAction({
  args: { notificationIds: v.array(v.id("notifications")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Guarded env access so this also no-ops cleanly under convex-test.
    const env =
      (globalThis as { process?: { env?: Record<string, string | undefined> } })
        .process?.env ?? {};
    const publicKey = env.VAPID_PUBLIC_KEY;
    const privateKey = env.VAPID_PRIVATE_KEY;
    const subject = env.VAPID_SUBJECT;
    if (!publicKey || !privateKey || !subject) {
      console.warn("push.deliver: VAPID env vars missing; skipping delivery");
      return null;
    }

    const targets: DeliveryTarget[] = await ctx.runQuery(
      internal.pushSubs.deliveryTargets,
      { notificationIds: args.notificationIds },
    );
    if (targets.length === 0) return null;

    // Dynamic import keeps web-push out of module load for the guard above.
    const webpush = (await import("web-push")).default;
    webpush.setVapidDetails(subject, publicKey, privateKey);

    for (const target of targets) {
      try {
        await webpush.sendNotification(
          target.subscription,
          // FR-NOT-3: type + ids only — never names or note text.
          JSON.stringify(target.payload),
        );
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Subscription is gone; drop it.
          await ctx.runMutation(internal.pushSubs.removeSub, {
            pushSubId: target.pushSubId,
          });
        } else {
          console.error(
            `push.deliver: send failed (${String(statusCode ?? "unknown")})`,
          );
        }
      }
    }
    return null;
  },
});
