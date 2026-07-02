import { test, expect } from '@playwright/test';
import {
  ADMIN,
  BUTTERFLIES_ID,
  BUTTERFLIES_SIZE,
  HASHEM,
  LAYAN,
  NURSERY_ID,
  TEACHER,
  convexRun,
  drainOutbox,
  login,
  selectClassroom,
  todayAmman,
  type DayReport,
} from './helpers';

/**
 * PRD §8 acceptance criteria against the PRODUCTION staff UI
 * (/attendance + /evaluations), production build + Serwist service worker.
 *
 * Serial by design (playwright.config.ts workers: 1): AC-OFF-1 resets and
 * then owns today's data; the portal spec afterwards asserts what AC-OFF-1
 * wrote.
 */

const EVALS = 5;
const SCORES = { academic: 4, social: 3, motor: 5, behavioral: 2 };

// 5 extra taps of "variety" on top of the 25×present baseline.
// present → absent → late → excused cycle (one tap per step).
const VARIETY = [
  { name: LAYAN.name, extraTaps: 1, status: 'absent' }, // portal spec asserts this
  { name: 'عمر الزعبي', extraTaps: 1, status: 'absent' },
  { name: 'كريم النابلسي', extraTaps: 1, status: 'absent' },
  { name: 'جود العدوان', extraTaps: 2, status: 'late' },
] as const;

test('AC-OFF-1: offline attendance (25) + evaluations (5) survive app kill and sync exactly once', async ({
  context,
  page,
}) => {
  test.setTimeout(420_000);
  const today = todayAmman();

  // Clean slate for THIS tenant + date so the test is rerun-safe.
  convexRun('admin:resetDay', { nurseryId: NURSERY_ID, date: today });

  await login(page, ADMIN.email, ADMIN.password);

  // Prime /evaluations ONLINE (page shell into the SW cache + roster/week
  // snapshots into IndexedDB) so the offline visit below can render.
  await page.goto('/evaluations');
  await selectClassroom(page, 'صف الفراشات');
  await expect(page.getByTestId('eval-row')).toHaveCount(BUTTERFLIES_SIZE, {
    timeout: 45_000,
  });

  // /attendance online — live roster, nothing pending.
  await page.goto('/attendance');
  await selectClassroom(page, 'صف الفراشات');
  const rows = page.getByTestId('student-row');
  await expect(rows).toHaveCount(BUTTERFLIES_SIZE, { timeout: 45_000 });
  await expect(page.getByTestId('pending-count')).toHaveCount(0);
  await expect(page.getByTestId('data-age')).toHaveCount(0);

  // ---- (a) Airplane mode ----
  await context.setOffline(true);

  // ---- (b) Tap all 25 → present ----
  for (let i = 0; i < BUTTERFLIES_SIZE; i++) {
    await rows.nth(i).click();
  }
  for (let i = 0; i < BUTTERFLIES_SIZE; i++) {
    await expect(rows.nth(i)).toHaveAttribute('data-status', 'present');
  }

  // ---- (c) 5 extra taps of variety (absent ×3, late ×1) ----
  const varietyIds: Record<string, string> = {};
  for (const v of VARIETY) {
    const row = rows.filter({ hasText: v.name });
    varietyIds[v.name] = (await row.getAttribute('data-student-id'))!;
    for (let i = 0; i < v.extraTaps; i++) {
      await row.click();
    }
    await expect(row).toHaveAttribute('data-status', v.status);
  }

  const expectedPending = BUTTERFLIES_SIZE + 5 + EVALS; // 35

  // All 30 attendance writes must be DURABLE in the outbox (IndexedDB)
  // before navigating away — the pending chip re-renders after each put.
  await expect(page.getByTestId('pending-count')).toHaveAttribute(
    'data-count',
    String(BUTTERFLIES_SIZE + 5),
    { timeout: 15_000 },
  );

  // ---- (d) Evaluations for 5 students, still offline ----
  await page.goto('/evaluations');
  const evalRows = page.getByTestId('eval-row');
  await expect(evalRows).toHaveCount(BUTTERFLIES_SIZE, { timeout: 45_000 });
  const evaluatedIds: string[] = [];
  for (let i = 0; i < EVALS; i++) {
    const row = evalRows.nth(i);
    evaluatedIds.push((await row.getAttribute('data-student-id'))!);
    await row.click();
    await page.getByTestId(`score-academic-${SCORES.academic}`).click();
    await page.getByTestId(`score-social-${SCORES.social}`).click();
    await page.getByTestId(`score-motor-${SCORES.motor}`).click();
    await page.getByTestId(`score-behavioral-${SCORES.behavioral}`).click();
    await page.getByTestId('eval-save').click();
    await expect(row).toHaveAttribute('data-evaluated', 'true');
  }
  // The portal spec depends on ليان having an evaluation.
  expect(evaluatedIds).toContain(LAYAN.id);

  await expect(page.getByTestId('pending-count')).toHaveAttribute(
    'data-count',
    String(expectedPending),
    { timeout: 15_000 },
  );

  // ---- (e) KILL the app ----
  await page.close();

  // ---- (f) REOPEN while still offline: SW shell + IndexedDB snapshot +
  // outbox all survive — THE critical §8.6 assertion.
  const page2 = await context.newPage();
  await page2.goto('/attendance', { timeout: 45_000 });
  const rows2 = page2.getByTestId('student-row');
  await expect(rows2).toHaveCount(BUTTERFLIES_SIZE, { timeout: 45_000 });
  await expect(page2.getByTestId('pending-count')).toHaveAttribute(
    'data-count',
    String(expectedPending),
    { timeout: 15_000 },
  );
  // Statuses reconstructed from the pending outbox merged over the snapshot.
  for (const v of VARIETY) {
    await expect(
      page2.locator(
        `[data-testid="student-row"][data-student-id="${varietyIds[v.name]}"]`,
      ),
    ).toHaveAttribute('data-status', v.status);
  }
  // Roster served from the stale IndexedDB snapshot while offline.
  await expect(page2.getByTestId('data-age').first()).toHaveAttribute(
    'data-stale',
    'true',
  );

  // ---- (g) Reconnect → FIFO drain to zero ----
  await context.setOffline(false);
  await drainOutbox(page2, 180_000);

  // ---- (h) SERVER: exactly one row per student (zero duplicates despite
  // 30 attendance mutations), statuses correct, exactly 5 evaluations.
  const report = convexRun<DayReport>('admin:dayReport', {
    nurseryId: NURSERY_ID,
    date: today,
  });
  const butterflies = report.attendance.filter(
    (r) => r.classroomId === BUTTERFLIES_ID,
  );
  expect(butterflies).toHaveLength(BUTTERFLIES_SIZE);
  expect(new Set(butterflies.map((r) => r.studentId)).size).toBe(
    BUTTERFLIES_SIZE,
  );
  const statusCounts: Record<string, number> = {};
  for (const row of butterflies) {
    statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1;
  }
  expect(statusCounts).toEqual({ present: 21, absent: 3, late: 1 });
  const byStudent = new Map(butterflies.map((r) => [r.studentId, r.status]));
  for (const v of VARIETY) {
    expect(byStudent.get(varietyIds[v.name])).toBe(v.status);
  }

  expect(report.evaluations).toHaveLength(EVALS);
  expect(new Set(report.evaluations.map((e) => e.studentId))).toEqual(
    new Set(evaluatedIds),
  );
  for (const e of report.evaluations) {
    expect(e.scores).toEqual(SCORES);
  }

  // ---- (i) Paranoia: give any straggler replay a beat — nothing changes
  // (exactly-once syncLog dedupe is also unit-tested in convex/lib/sync).
  await page2.waitForTimeout(3_000);
  const report2 = convexRun<DayReport>('admin:dayReport', {
    nurseryId: NURSERY_ID,
    date: today,
  });
  expect(
    report2.attendance.filter((r) => r.classroomId === BUTTERFLIES_ID),
  ).toHaveLength(BUTTERFLIES_SIZE);
  expect(report2.evaluations).toHaveLength(EVALS);
});

test('AC-OFF-2: two devices edit the same record offline → one record, later sync wins, conflict marked', async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const today = todayAmman();

  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  await login(pageA, ADMIN.email, ADMIN.password);
  await login(pageB, TEACHER.email, TEACHER.password);

  // Both load the SAME classroom + day online (صف العصافير — the teacher's).
  await pageA.goto('/attendance');
  await selectClassroom(pageA, 'صف العصافير');
  const rowA = pageA.getByTestId('student-row').filter({ hasText: HASHEM.name });
  await expect(rowA).toBeVisible({ timeout: 45_000 });

  await pageB.goto('/attendance');
  await selectClassroom(pageB, 'صف العصافير');
  const rowB = pageB.getByTestId('student-row').filter({ hasText: HASHEM.name });
  await expect(rowB).toBeVisible({ timeout: 45_000 });

  // Baseline ONLINE: cycle A's row to a known 'present' and let it sync.
  for (let i = 0; i < 4; i++) {
    if ((await rowA.getAttribute('data-status')) === 'present') break;
    await rowA.click();
    await pageA.waitForTimeout(700);
  }
  await expect(rowA).toHaveAttribute('data-status', 'present');
  await expect(pageA.getByTestId('pending-count')).toHaveCount(0, {
    timeout: 60_000,
  });
  // Reactive barrier: B sees A's baseline before anyone goes offline.
  await expect(rowB).toHaveAttribute('data-status', 'present', {
    timeout: 30_000,
  });

  // ---- Both offline ----
  await ctxA.setOffline(true);
  await ctxB.setOffline(true);

  // Device A queues absent at t1…
  await rowA.click(); // present → absent
  await expect(rowA).toHaveAttribute('data-status', 'absent');

  await pageA.waitForTimeout(1_500);

  // …device B queues late at t2 > t1.
  await rowB.click(); // present → absent
  await rowB.click(); // absent → late
  await expect(rowB).toHaveAttribute('data-status', 'late');

  // ---- A reconnects + drains FIRST ----
  await ctxA.setOffline(false);
  await drainOutbox(pageA, 60_000);

  // ---- then B reconnects + drains (last write to reach the server) ----
  await ctxB.setOffline(false);
  await drainOutbox(pageB, 60_000);

  // SERVER (§8.5): exactly ONE row for X, later sync wins → 'late'.
  const report = convexRun<DayReport>('admin:dayReport', {
    nurseryId: NURSERY_ID,
    date: today,
  });
  const xRows = report.attendance.filter((r) => r.studentId === HASHEM.id);
  expect(xRows).toHaveLength(1);
  expect(xRows[0].status).toBe('late');

  // UI: B (whose write landed on a row the server had changed after B queued
  // it) shows the "updated during sync" marker; A does not.
  await expect(rowB).toHaveAttribute('data-status', 'late');
  await expect(rowB.getByTestId('conflict-marker')).toBeVisible();
  await expect(rowA.getByTestId('conflict-marker')).toHaveCount(0);

  // A converges to 'late' reactively (no reload) — no error state anywhere.
  await expect(rowA).toHaveAttribute('data-status', 'late', {
    timeout: 30_000,
  });

  await ctxA.close();
  await ctxB.close();
});

test('AC-OFF-3: cold-start offline opens cached roster + today’s grid in <3s', async ({
  context,
  page,
}) => {
  test.setTimeout(180_000);

  // Prior online visit: SW installed (login helper waits for control) and
  // the roster snapshot cached.
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto('/attendance');
  await selectClassroom(page, 'صف الفراشات');
  await expect(page.getByTestId('student-row')).toHaveCount(BUTTERFLIES_SIZE, {
    timeout: 45_000,
  });

  // Cold start: fresh page, no network.
  await context.setOffline(true);
  const page2 = await context.newPage();
  const start = Date.now();
  await page2.goto('/attendance', { timeout: 30_000 });
  await expect(page2.getByTestId('student-row')).toHaveCount(
    BUTTERFLIES_SIZE,
    { timeout: 10_000 },
  );
  await expect(
    page2.getByTestId('student-row').filter({ hasText: LAYAN.name }),
  ).toBeVisible();
  const elapsed = Date.now() - start;

  console.log(`AC-OFF-3 cold-start offline → roster visible in ${elapsed}ms`);
  expect(elapsed).toBeLessThan(3_000);
});
