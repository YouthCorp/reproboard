import { defineConfig, devices } from '@playwright/test';
import { localStack, readAccounts } from './scripts/local-stack.mjs';

localStack();
readAccounts();
export default defineConfig({
  testDir: './tests/db-ui',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-db-report', open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'off', screenshot: 'off' },
  projects: [{ name: 'chromium-local-db', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev', url: 'http://127.0.0.1:3000',
    reuseExistingServer: true, timeout: 60_000,
  },
});
