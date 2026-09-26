import { defineConfig } from '@playwright/test';
import base from './playwright.db.config.mjs';

export default defineConfig(base, {
  outputDir: './test-results/demo',
  grep: /D5 UI completes|D7 two browser users race|D6 delayed A|D8 A offline/,
  reporter: [['list'], ['json', { outputFile: '.local/demo/report.json' }]],
  use: { video: { mode: 'on', size: { width: 1440, height: 1100 } }, viewport: { width: 1440, height: 1100 }, trace: 'off' },
});
