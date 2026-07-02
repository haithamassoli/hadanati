import type { MutationCtx } from "../_generated/server";

/**
 * Offline-replay dedupe (PRD §8). If clientMutationId was already processed,
 * returns true (caller acks silently). Otherwise records it in syncLog within
 * the same transaction and returns false.
 */
export async function alreadyProcessed(
  ctx: MutationCtx,
  clientMutationId: string | undefined,
): Promise<boolean> {
  if (clientMutationId === undefined) {
    return false;
  }
  const existing = await ctx.db
    .query("syncLog")
    .withIndex("by_clientMutationId", (q) =>
      q.eq("clientMutationId", clientMutationId),
    )
    .unique();
  if (existing !== null) {
    return true;
  }
  await ctx.db.insert("syncLog", {
    clientMutationId,
    processedAt: Date.now(),
  });
  return false;
}
