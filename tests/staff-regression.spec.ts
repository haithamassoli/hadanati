import { test, expect } from '@playwright/test';
import { ADMIN, LAYAN, SEED_PAYMENT_ID, login } from './helpers';

/**
 * M1+M3 regression sweep on the production build: every staff route still
 * renders for an admin with ZERO console errors / page errors.
 */

const ROUTES = [
  '/dashboard',
  '/attendance',
  '/evaluations',
  '/students',
  `/students/${LAYAN.id}`,
  '/classrooms',
  '/staff',
  '/settings',
  '/announcements',
  // M3 finance area (FR-FIN-1..5) + the two §5 print documents.
  '/finance',
  '/finance/invoices',
  '/finance/expenses',
  '/finance/plans',
  `/finance/statement/${LAYAN.id}`,
  `/finance/receipt/${SEED_PAYMENT_ID}`,
];

test('staff routes render with zero console errors', async ({ page }) => {
  test.setTimeout(360_000);

  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(`[console] ${page.url()} :: ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => {
    errors.push(`[pageerror] ${page.url()} :: ${err.message}`);
  });

  await login(page, ADMIN.email, ADMIN.password);

  for (const route of ROUTES) {
    await page.goto(route);
    // Auth guard must not bounce staff back to /login.
    await expect(page).not.toHaveURL(/\/login/);
    // Every staff screen renders a heading once loaded.
    await expect(page.locator('h1, h2').first()).toBeVisible({
      timeout: 30_000,
    });
    // Give late async errors (queries, images) a beat to surface.
    await page.waitForTimeout(1_200);
  }

  expect(errors).toEqual([]);
});
