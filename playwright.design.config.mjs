import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/design', outputDir: './test-results/design', workers: 1,
  retries: 0, forbidOnly: true, timeout: 60_000,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:3000', viewport: { width: 1440, height: 900 } },
  webServer: { command: 'pnpm dev', url: 'http://127.0.0.1:3000', reuseExistingServer: true },
});
