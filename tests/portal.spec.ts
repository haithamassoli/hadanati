import { generateKeyPairSync, randomBytes, randomInt } from 'node:crypto';
import { test, expect } from '@playwright/test';
import {
  ADMIN,
  LAYAN,
  NURSERY_ID,
  STATUS_AR,
  convexRun,
  login,
  todayAmman,
  type DayReport,
  type NotificationRow,
  type PortalReport,
} from './helpers';

/**
 * Parent portal E2E (FR-AUTH-2/3, FR-PAR-*, FR-NOT-*) on the production
 * build. Runs AFTER ac-off.spec.ts (workers: 1, alphabetical): AC-OFF-1
 * marked ليان absent today, saved her week evaluation, and its replay
 * emitted the absence + evaluation notifications this spec asserts.
 *
 * Rate limiting (10/h per code + 30/h global) is deliberately verified in
 * the backend vitest suite (convex/accessCodes.test.ts) instead of here:
 * hammering the live dev deployment would poison the 1-hour window for
 * every later run — the E2E does exactly ONE wrong-code attempt.
 */

/** Valid P-256 browser-like push keys so web-push encryption succeeds. */
function fakePushKeys(): { p256dh: string; auth: string } {
  const { publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const spki = publicKey.export({ format: 'der', type: 'spki' });
  return {
    p256dh: Buffer.from(spki.subarray(spki.length - 65)).toString('base64url'),
    auth: randomBytes(16).toString('base64url'),
  };
}

test('portal: fresh code → home/progress/announcements/inbox, offline cache, push plumbing', async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const today = todayAmman();

  // ---- Staff side: admin generates a FRESH access code via the UI card ----
  const staff = await browser.newContext();
  const staffPage = await staff.newPage();
  await login(staffPage, ADMIN.email, ADMIN.password);
  await staffPage.goto(`/students/${LAYAN.id}`);
  const generateButton = staffPage.getByRole('button', {
    name: /إنشاء رمز|إعادة الإنشاء/,
  });
  await expect(generateButton).toBeVisible({ timeout: 45_000 });
  await generateButton.click();
  const rawCode = staffPage.getByTestId('raw-access-code');
  await expect(rawCode).toBeVisible({ timeout: 30_000 });
  const code = (await rawCode.textContent())!.trim();
  expect(code).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
  // WhatsApp share deep link is offered alongside the one-time code.
  await expect(
    staffPage.getByRole('link', { name: /واتساب|WhatsApp/ }),
  ).toHaveAttribute('href', /^https:\/\/wa\.me\/962/);
  await staff.close();

  // Expected server state written by AC-OFF-1.
  const day = convexRun<DayReport>('admin:dayReport', {
    nurseryId: NURSERY_ID,
    date: today,
  });
  const layanStatus = day.attendance.find(
    (r) => r.studentId === LAYAN.id,
  )?.status;
  expect(layanStatus).toBeDefined(); // AC-OFF-1 ran first (serial suite)

  // ---- Parent side: fresh device, only the code ----
  const parent = await browser.newContext({
    viewport: { width: 390, height: 844 },
    permissions: ['notifications'],
  });
  const page = await parent.newPage();
  await page.goto('/portal');
  await page.waitForFunction(
    () => navigator.serviceWorker?.controller !== null,
    undefined,
    { timeout: 45_000 },
  );

  await page.locator('#portal-code').fill(code);
  await page.getByRole('button', { name: 'دخول' }).click();

  // HOME (FR-PAR-1): child header, today's status from AC-OFF-1, eval dots.
  await expect(
    page.getByRole('heading', { name: LAYAN.name }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('حضور اليوم')).toBeVisible();
  await expect(
    page.getByText(STATUS_AR[layanStatus!], { exact: true }),
  ).toBeVisible();
  // Latest evaluation card shows the week, not the empty state.
  await expect(page.getByText(/الأسبوع/).first()).toBeVisible();
  await expect(page.getByText('لا توجد تقييمات بعد')).toHaveCount(0);

  // Full document pass now that the SW controls the page: the very first
  // /portal visit predates the SW claim, so the offline-capable app shell
  // only lands in the runtime page cache on this navigation.
  await page.goto('/portal');
  await expect(
    page.getByRole('heading', { name: LAYAN.name }),
  ).toBeVisible({ timeout: 30_000 });

  // ANNOUNCEMENTS (FR-PAR-4): nursery-wide + own-classroom posts.
  await page.getByRole('link', { name: 'الإعلانات' }).click();
  await expect(page.getByText('رحلة إلى حديقة الحسين')).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByText('اجتماع أولياء أمور صف الفراشات'),
  ).toBeVisible();

  // PROGRESS (FR-PAR-2): year chart renders.
  await page.getByRole('link', { name: 'التقدم' }).click();
  await expect(page.locator('.recharts-wrapper').first()).toBeVisible({
    timeout: 30_000,
  });

  // INBOX (FR-NOT-1): absence + evaluation + announcement events present.
  await page.getByRole('link', { name: 'الإشعارات' }).click();
  await expect(page.getByText(/سُجّل غياب لطفلك/).first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/تقييم جديد للأسبوع/).first()).toBeVisible();
  await expect(
    page.getByText('إعلان جديد من الحضانة').first(),
  ).toBeVisible();

  // markRead: tap the newest UNREAD notification (rerun-safe: earlier runs
  // may have already read the newest absence) and verify the server flip.
  const TYPE_TEXT: Record<string, RegExp> = {
    absence: /سُجّل غياب لطفلك/,
    evaluation: /تقييم جديد للأسبوع/,
    announcement: /إعلان جديد من الحضانة/,
  };
  const TYPE_URL: Record<string, string> = {
    absence: '**/portal',
    evaluation: '**/portal/progress',
    announcement: '**/portal/announcements',
  };
  const before = convexRun<NotificationRow[]>('admin:latestNotifications', {
    nurseryId: NURSERY_ID,
    studentId: LAYAN.id,
  });
  // Newest per type — that's the item rendered first for that type's text.
  const newestOfType = new Map<string, NotificationRow>();
  for (const n of before) {
    if (!newestOfType.has(n.type)) newestOfType.set(n.type, n);
  }
  let target = [...newestOfType.values()].find(
    (n) => !n.read && TYPE_TEXT[n.type] !== undefined,
  );
  if (target === undefined) {
    // Standalone reruns may have consumed every unread item — emit a fresh
    // absence through the real notification pipeline and let it stream in.
    const id = convexRun<string>('admin:emitTestNotification', {
      nurseryId: NURSERY_ID,
      studentId: LAYAN.id,
    });
    target = { _id: id, type: 'absence', read: false };
    await expect(
      page.getByRole('button', { name: TYPE_TEXT.absence }).first(),
    ).toBeVisible({ timeout: 15_000 });
  }

  await page
    .getByRole('button', { name: TYPE_TEXT[target.type] })
    .first()
    .click();
  const clicked = target;
  await page.waitForURL(TYPE_URL[clicked.type]); // type-specific deep link
  await expect.poll(
    () => {
      const after = convexRun<NotificationRow[]>('admin:latestNotifications', {
        nurseryId: NURSERY_ID,
        studentId: LAYAN.id,
      });
      return after.find((n) => n._id === clicked._id)?.read;
    },
    { timeout: 15_000 },
  ).toBe(true);

  // ---- FR-AUTH-3: the portal opens with cached data, no network ----
  await page.goto('/portal'); // back to home (still online)
  await parent.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: LAYAN.name }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('بدون اتصال')).toBeVisible(); // header pill
  await expect(page.getByTestId('data-age').first()).toHaveAttribute(
    'data-stale',
    'true',
  );
  await parent.setOffline(false);

  // ---- Push plumbing (FR-NOT-1/3): subscription row + deliver runs ----
  await page.goto('/portal/settings');
  const toggle = page.locator('#push-toggle');
  await expect(toggle).toBeVisible({ timeout: 30_000 });
  const subsBefore = convexRun<PortalReport>('admin:portalReport', {
    nurseryId: NURSERY_ID,
  }).pushSubCount;
  await toggle.click();
  await page.waitForTimeout(4_000);
  let subs = convexRun<PortalReport>('admin:portalReport', {
    nurseryId: NURSERY_ID,
  }).pushSubCount;
  if (subs <= subsBefore) {
    // Headless Chromium has no push-service credentials, so the browser-side
    // pushManager.subscribe cannot complete here; exercise the same public
    // mutation the client calls with a browser-shaped subscription instead.
    convexRun('pushSubs:subscribe', {
      code,
      subscription: {
        endpoint:
          'https://fcm.googleapis.com/fcm/send/hadanati-acceptance-fake',
        keys: fakePushKeys(),
      },
    });
    subs = convexRun<PortalReport>('admin:portalReport', {
      nurseryId: NURSERY_ID,
    }).pushSubCount;
  }
  expect(subs).toBeGreaterThan(subsBefore);

  // internal.push.deliver runs cleanly against a real notification (the fake
  // endpoint 404/410s → the sub is pruned, never thrown).
  const latest = convexRun<NotificationRow[]>('admin:latestNotifications', {
    nurseryId: NURSERY_ID,
    studentId: LAYAN.id,
  });
  expect(latest.length).toBeGreaterThan(0);
  convexRun('push:deliver', { notificationIds: [latest[0]._id] });

  await parent.close();

  // ---- Wrong code → explicit 'invalid' error (ONE attempt only) ----
  const stranger = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const strangerPage = await stranger.newPage();
  await strangerPage.goto('/portal');
  const bogus = `ZZZZ-ZZZZ-Z${String(randomInt(100, 999))}`;
  await strangerPage.locator('#portal-code').fill(bogus);
  await strangerPage.getByRole('button', { name: 'دخول' }).click();
  await expect(
    strangerPage.getByText('الرمز غير صحيح — تأكد منه وحاول مجدداً'),
  ).toBeVisible({ timeout: 30_000 });
  await stranger.close();
});
