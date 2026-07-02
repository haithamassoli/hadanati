import { api } from "@/convex/_generated/api";

export const registry = {
  "attendance.upsert": api.attendance.upsert,
  "evaluations.upsert": api.evaluations.upsert,
} as const;

export type OutboxName = keyof typeof registry;
