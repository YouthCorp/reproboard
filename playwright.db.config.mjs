import { defineConfig, devices } from '@playwright/test';
import { localStack, readAccounts, testBaseURL } from './scripts/local-stack.mjs';
/* global process */

localStack();
readAccounts();
export default defineConfig({
  testDir: './tests/db-ui',
  outputDir: './test-results/db',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: [['list'], ['html', { outputFolder: 'playwright-db-report', open: 'never' }]],
  use: { baseURL: testBaseURL, trace: 'off', screenshot: 'off' },
  projects: [{ name: 'chromium-local-db', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: process.env.REPROBOARD_TEST_RUN ? 'pnpm dev --port 3200' : 'pnpm dev', url: testBaseURL,
    reuseExistingServer: !process.env.REPROBOARD_TEST_RUN, timeout: 60_000,
    env: { NEXT_PUBLIC_SITE_URL: testBaseURL },
  },
});
