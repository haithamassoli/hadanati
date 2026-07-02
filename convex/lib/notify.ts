import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";

export type NotificationEvent = {
  studentId: Id<"students">;
  /** FR-NOT-2 event kind: "absence" | "evaluation" | "announcement" | ... */
  type: string;
  /** FR-NOT-3: ids + dates only — NEVER names or note text. */
  payload: Record<string, string>;
};

/**
 * Insert in-app notifications and schedule Web Push delivery for them.
 * Payloads must contain type + ids only (FR-NOT-3); the portal client
 * fetches the actual content on open.
 */
export async function emitNotifications(
  ctx: MutationCtx,
  nurseryId: Id<"nurseries">,
  events: NotificationEvent[],
): Promise<Id<"notifications">[]> {
  if (events.length === 0) return [];
  const notificationIds: Id<"notifications">[] = [];
  for (const event of events) {
    notificationIds.push(
      await ctx.db.insert("notifications", {
        nurseryId,
        target: { studentId: event.studentId },
        type: event.type,
        payload: event.payload,
      }),
    );
  }
  await ctx.scheduler.runAfter(0, internal.push.deliver, { notificationIds });
  return notificationIds;
}
