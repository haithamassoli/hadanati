/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accessCodes from "../accessCodes.js";
import type * as admin from "../admin.js";
import type * as announcements from "../announcements.js";
import type * as attendance from "../attendance.js";
import type * as auth from "../auth.js";
import type * as classrooms from "../classrooms.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as enrollments from "../enrollments.js";
import type * as evaluations from "../evaluations.js";
import type * as expenses from "../expenses.js";
import type * as feePlans from "../feePlans.js";
import type * as finance from "../finance.js";
import type * as financeCron from "../financeCron.js";
import type * as http from "../http.js";
import type * as invoices from "../invoices.js";
import type * as lib_codes from "../lib/codes.js";
import type * as lib_finance from "../lib/finance.js";
import type * as lib_guard from "../lib/guard.js";
import type * as lib_notify from "../lib/notify.js";
import type * as lib_portal from "../lib/portal.js";
import type * as lib_shared from "../lib/shared.js";
import type * as lib_sync from "../lib/sync.js";
import type * as nurseries from "../nurseries.js";
import type * as payments from "../payments.js";
import type * as portal from "../portal.js";
import type * as push from "../push.js";
import type * as pushSubs from "../pushSubs.js";
import type * as staff from "../staff.js";
import type * as stages from "../stages.js";
import type * as students from "../students.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accessCodes: typeof accessCodes;
  admin: typeof admin;
  announcements: typeof announcements;
  attendance: typeof attendance;
  auth: typeof auth;
  classrooms: typeof classrooms;
  crons: typeof crons;
  dashboard: typeof dashboard;
  enrollments: typeof enrollments;
  evaluations: typeof evaluations;
  expenses: typeof expenses;
  feePlans: typeof feePlans;
  finance: typeof finance;
  financeCron: typeof financeCron;
  http: typeof http;
  invoices: typeof invoices;
  "lib/codes": typeof lib_codes;
  "lib/finance": typeof lib_finance;
  "lib/guard": typeof lib_guard;
  "lib/notify": typeof lib_notify;
  "lib/portal": typeof lib_portal;
  "lib/shared": typeof lib_shared;
  "lib/sync": typeof lib_sync;
  nurseries: typeof nurseries;
  payments: typeof payments;
  portal: typeof portal;
  push: typeof push;
  pushSubs: typeof pushSubs;
  staff: typeof staff;
  stages: typeof stages;
  students: typeof students;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
