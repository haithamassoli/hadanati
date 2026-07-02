import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { OutboxName } from "./registry";

export interface OutboxEntry {
  clientMutationId: string;
  name: OutboxName;
  args: Record<string, unknown>;
  createdAt: number;
}

export interface Snapshot {
  key: string;
  data: unknown;
  updatedAt: number;
}

interface HadanatiDB extends DBSchema {
  outbox: {
    key: string;
    value: OutboxEntry;
    indexes: { by_createdAt: number };
  };
  snapshots: {
    key: string;
    value: Snapshot;
  };
}

let dbPromise: Promise<IDBPDatabase<HadanatiDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<HadanatiDB>> {
  if (!dbPromise) {
    dbPromise = openDB<HadanatiDB>("hadanati", 1, {
      upgrade(db) {
        const outbox = db.createObjectStore("outbox", {
          keyPath: "clientMutationId",
        });
        outbox.createIndex("by_createdAt", "createdAt");
        db.createObjectStore("snapshots", { keyPath: "key" });
      },
    });
  }
  return dbPromise;
}
