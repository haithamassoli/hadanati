import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// FR-FIN-2: issue the new month's plan invoices for ALL nurseries.
// 1st of the month, 02:00 UTC (= 05:00 Amman).
crons.cron(
  "monthly invoice generation",
  "0 2 1 * *",
  internal.financeCron.generateAll,
  {},
);

// FR-NOT-2: notify newly overdue invoices (once per invoice, ever).
// Daily 03:00 UTC (= 06:00 Amman).
crons.cron(
  "daily overdue notifier",
  "0 3 * * *",
  internal.financeCron.notifyOverdueAll,
  {},
);

export default crons;
