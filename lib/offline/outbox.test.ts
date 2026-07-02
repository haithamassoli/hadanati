// @vitest-environment node
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mutation = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock("@/lib/convex", () => ({ convexClient: { mutation } }));
vi.mock("sonner", () => ({ toast: { error: toastError } }));

import { ConvexError } from "convex/values";
import { getDb } from "./db";
import { conflictKeyOf, getConflictKeys, replay, submit } from "./outbox";

describe("outbox", () => {
  beforeEach(async () => {
    vi.stubGlobal("navigator", { onLine: false });
    mutation.mockReset();
    const db = await getDb();
    await db.clear("outbox");
  });

  it("write-ahead enqueue, FIFO replay, keeps entry on network error with stable clientMutationId", async () => {
    await submit("attendance.upsert", { seq: 1 });
    await submit("attendance.upsert", { seq: 2 });
    await submit("evaluations.upsert", { seq: 3 });

    // Write-ahead: everything is in IndexedDB before any replay (offline).
    const db = await getDb();
    expect(mutation).not.toHaveBeenCalled();
    const enqueued = await db.getAllFromIndex("outbox", "by_createdAt");
    expect(enqueued.map((e) => e.args.seq)).toEqual([1, 2, 3]);

    // 2 succeed, 3rd fails with a network error.
    mutation.mockImplementation(async (_ref, args) => {
      if ((args as { seq: number }).seq === 3) {
        throw new Error("fetch failed");
      }
      return null;
    });
    await replay();

    expect(mutation).toHaveBeenCalledTimes(3);
    const seqs = mutation.mock.calls.map(
      ([, args]) => (args as { seq: number }).seq,
    );
    expect(seqs).toEqual([1, 2, 3]); // FIFO
    const firstAttemptId = (
      mutation.mock.calls[2][1] as { clientMutationId: string }
    ).clientMutationId;
    expect(firstAttemptId).toBeTruthy();

    // Only the failed entry remains.
    const remaining = await db.getAllFromIndex("outbox", "by_createdAt");
    expect(remaining).toHaveLength(1);
    expect(remaining[0].args.seq).toBe(3);
    expect(remaining[0].clientMutationId).toBe(firstAttemptId);

    // Retry reuses the exact same clientMutationId.
    mutation.mockClear();
    mutation.mockResolvedValue(null);
    await replay();
    expect(mutation).toHaveBeenCalledTimes(1);
    expect(
      (mutation.mock.calls[0][1] as { clientMutationId: string })
        .clientMutationId,
    ).toBe(firstAttemptId);
    expect(await db.count("outbox")).toBe(0);
  });

  it("passes clientCreatedAt and captures {conflict:true} results as conflictKeys", async () => {
    await submit("attendance.upsert", {
      nurseryId: "n1",
      classroomId: "c1",
      studentId: "s1",
      date: "2026-07-01",
      status: "present",
    });
    await submit("evaluations.upsert", {
      nurseryId: "n1",
      studentId: "s2",
      yearId: "2026-2027",
      week: 5,
      scores: { academic: 3, social: 3, motor: 3, behavioral: 3 },
    });

    // 1st write conflicts (server row newer), 2nd doesn't.
    mutation
      .mockResolvedValueOnce({ conflict: true })
      .mockResolvedValueOnce({ conflict: false });
    await replay();

    // clientCreatedAt = the entry's queue time is forwarded to the server.
    const firstArgs = mutation.mock.calls[0][1] as {
      clientCreatedAt: number;
      clientMutationId: string;
    };
    expect(firstArgs.clientCreatedAt).toBeTypeOf("number");
    expect(firstArgs.clientCreatedAt).toBeLessThanOrEqual(Date.now());

    // Both entries drained (conflict is a flag, not a failure)…
    const db = await getDb();
    expect(await db.count("outbox")).toBe(0);

    // …and only the conflicted write is marked.
    const keys = getConflictKeys();
    expect(
      keys.has(
        conflictKeyOf("attendance.upsert", {
          nurseryId: "n1",
          studentId: "s1",
          date: "2026-07-01",
        }),
      ),
    ).toBe(true);
    expect(
      keys.has(
        conflictKeyOf("evaluations.upsert", {
          nurseryId: "n1",
          studentId: "s2",
          week: 5,
        }),
      ),
    ).toBe(false);
    // Only one of the two entries conflicted.
    expect(keys.size).toBe(1);
  });

  it("conflict keys ignore non-identity args (note, status, scores)", () => {
    expect(
      conflictKeyOf("attendance.upsert", {
        nurseryId: "n1",
        classroomId: "c9",
        studentId: "s1",
        date: "2026-07-01",
        status: "late",
        note: "x",
      }),
    ).toBe(
      conflictKeyOf("attendance.upsert", {
        nurseryId: "n1",
        studentId: "s1",
        date: "2026-07-01",
        status: "present",
      }),
    );
  });

  it("translates known ConvexError codes in permanent-failure toasts", async () => {
    await submit("attendance.upsert", { seq: 1 });
    mutation.mockRejectedValueOnce(new ConvexError("forbidden"));
    await replay();

    // Entry dropped (permanent) and the toast is the Arabic translation.
    const db = await getDb();
    expect(await db.count("outbox")).toBe(0);
    expect(toastError).toHaveBeenCalledWith("ليست لديك صلاحية لهذه العملية");

    // Unknown code falls back to the raw string.
    toastError.mockClear();
    await submit("attendance.upsert", { seq: 2 });
    mutation.mockRejectedValueOnce(new ConvexError("weird_code"));
    await replay();
    expect(toastError).toHaveBeenCalledWith("weird_code");
  });
});
