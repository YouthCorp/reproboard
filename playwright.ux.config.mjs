import { defineConfig, devices } from '@playwright/test';
import { localStack, readAccounts } from './scripts/local-stack.mjs';
localStack(); readAccounts();
export default defineConfig({
  testDir: './tests/ux', outputDir: './test-results/ux', workers: 1, retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-ux-report', open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'off', screenshot: 'off', viewport: { width: 1440, height: 1000 } },
  projects: [{ name: 'chromium-production-ux', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } }],
  webServer: [
    { command: 'pnpm dev', url: 'http://127.0.0.1:3000', reuseExistingServer: true, timeout: 60_000 },
    { command: 'pnpm start --port 3100', url: 'http://127.0.0.1:3100', reuseExistingServer: false, timeout: 60_000 },
  ],
});
