import { defineConfig, devices } from '@playwright/test';

/**
 * M2 acceptance suite (PRD §8 AC-OFF-1/2/3 + parent portal E2E) runs against
 * a production build because the service worker is prod-only (Serwist is
 * disabled in dev / under Turbopack).
 *
 * Prerequisite (build alongside the running dev server):
 *   NEXT_DIST_DIR=.next-prod npm run build
 *
 * Then: npx playwright test
 *
 * Tests are intentionally serial (workers: 1): they share one seeded dev
 * tenant, AC-OFF-1 resets today's data, and the portal spec asserts the
 * attendance/notifications AC-OFF-1 produced.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npx next start -p 3001',
    url: 'http://localhost:3001/login',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: { NEXT_DIST_DIR: '.next-prod' },
  },
});
