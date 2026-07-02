import { execSync } from 'node:child_process';
import { expect, type Page } from '@playwright/test';

// Seeded dev tenant (see convex/admin.ts createNursery/seedSpike/seedDemo).
export const NURSERY_ID = 'm976kfw9nw5mhn696234a2x2wh89se0r';
export const ADMIN = { email: 'admin@hadanati.test', password: 'HadanatiAdmin2026!' };
export const TEACHER = { email: 'teacher@hadanati.test', password: 'TeacherPass2026!' };
export const ACCOUNTANT = {
  email: 'accountant@hadanati.test',
  password: 'AccountantPass2026!',
};

// صف الفراشات — 25 students, first classroom (admin's default selection).
export const BUTTERFLIES_ID = 'jh7f3gq1ncjebagr11cpwrnfy189sa7s';
export const BUTTERFLIES_SIZE = 25;
// صف العصافير — the teacher account's first classroom.
export const BIRDS_ID = 'jh7d04psry1yvqh3pxm20ncdn989s31y';

export const LAYAN = { id: 'kx74bd5d1f1z8cq7fjdq1wttcx89s5a5', name: 'ليان الخطيب' };
export const HASHEM = { id: 'kx7b2wy297bsjsbkmeke8jd35d89s56e', name: 'هاشم النعيمات' };

// M3 finance seed (convex/admin.ts seedFinanceDemo, rerunnable):
// لينا's 30.000 JOD cash payment — a stable receipt target.
export const SEED_PAYMENT_ID = 'kh77g36shrzwjk5bh4sgbwszpn89rt71';
// ليان's manual 'رسوم أنشطة' invoice, dueDate 2026-06-10 → always overdue.
export const OVERDUE_INVOICE_DESC = 'رسوم أنشطة';

export const STATUS_AR: Record<string, string> = {
  present: 'حاضر',
  absent: 'غائب',
  late: 'متأخر',
  excused: 'معذور',
  unmarked: 'غير مسجَّل',
};

/** Same clock as convex/lib/shared todayISO (Asia/Amman ≈ UTC+3). */
export function todayAmman(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function convexRun<T>(fn: string, args: Record<string, unknown>): T {
  const out = execSync(`npx convex run ${fn} '${JSON.stringify(args)}'`, {
    encoding: 'utf8',
  }).trim();
  // `v.null()`-returning functions print nothing.
  return (out === '' ? null : JSON.parse(out)) as T;
}

export type DayReport = {
  week: number;
  attendance: { studentId: string; classroomId: string; status: string }[];
  evaluations: {
    studentId: string;
    scores: { academic: number; social: number; motor: number; behavioral: number };
  }[];
};

export type FinanceReport = {
  invoiceCount: number;
  paymentCount: number;
};

export type PortalInvoices = {
  invoices: { _id: string; amountFils: number; paidFils: number }[];
  totals: { balanceFils: number };
};

export type PortalReport = {
  accessCodeCount: number;
  notificationCount: number;
  pushSubCount: number;
  announcementCount: number;
};

export type NotificationRow = {
  _id: string;
  type: string;
  studentId?: string;
  read: boolean;
};

/**
 * Staff login via the real form, waiting until the service worker controls
 * the page (precache complete) so later offline navigation works.
 */
export async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard', { timeout: 45_000 });
  await page.waitForFunction(
    () => navigator.serviceWorker?.controller !== null,
    undefined,
    { timeout: 45_000 },
  );
}

/** Select a classroom in the attendance/evaluations Radix Select. */
export async function selectClassroom(page: Page, name: string) {
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name }).click();
  await expect(page.getByRole('combobox')).toContainText(name);
}

/**
 * Wait for the outbox to drain to zero. Reconnect auto-replay (the 'online'
 * listener) may empty it before the manual "sync now" nudge is clickable,
 * so the click is best-effort.
 */
export async function drainOutbox(page: Page, timeout = 120_000) {
  try {
    await page.getByTestId('sync-now').click({ timeout: 2_000 });
  } catch {
    // Chip already gone — auto-replay beat us to it.
  }
  await expect(page.getByTestId('pending-count')).toHaveCount(0, { timeout });
}
