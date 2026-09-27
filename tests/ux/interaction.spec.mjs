/* global document, window, performance, process, console, MutationObserver, PerformanceObserver, requestAnimationFrame */
import { test, expect } from '@playwright/test';
import { cpus, totalmem, release } from 'node:os';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createUxFixture, cleanupUxFixture } from '../helpers/ux-fixture.mjs';

// Test-only DOM measurement; no app instrumentation, credentials or storageState are published.
async function sample(page, event, condition, act) {
  await page.evaluate(({ event, condition }) => {
    window.uxSample = null;
    document.addEventListener(event, () => {
      const start = performance.now();
      const observer = new MutationObserver(check);
      function check() {
        const ready = condition === 'detail' ? !!document.querySelector('dialog.issue-detail[open]') : document.querySelectorAll('.issue-card').length === condition;
        if (ready) { observer.disconnect(); requestAnimationFrame(() => requestAnimationFrame(() => { window.uxSample = performance.now() - start; })); }
      }
      observer.observe(document.querySelector('main'), { subtree: true, childList: true, attributes: true, characterData: true }); check();
    }, { capture: true, once: true });
  }, { event, condition });
  await act();
  await expect.poll(() => page.evaluate(() => window.uxSample), { timeout: 10_000 }).not.toBeNull();
  return Math.round(await page.evaluate(() => window.uxSample));
}
test('D11 production interaction observation with 100 synthetic issues', async ({ page, browser }, info) => {
  test.setTimeout(120_000);
  const fixture = await createUxFixture(100);
  try {
    // Development login creates an ordinary Auth session. Cookies are scoped to the same loopback host, not a port.
    await page.goto(`http://127.0.0.1:3000/login?next=${encodeURIComponent(`/board?workspace=${fixture.workspaceId}`)}`);
    await page.getByRole('button', { name: '개발 계정으로 로그인', exact: true }).click();
    await expect(page.getByText('역할: 관리자', { exact: true })).toBeVisible();
    await page.goto(`/board?workspace=${fixture.workspaceId}`);
    await expect(page.locator('.issue-card')).toHaveCount(100);
    await expect(page.locator('[data-connection-state]')).toHaveAttribute('data-connection-state', 'normal', { timeout: 25_000 });
    // Warm detail once; measure subsequent interaction, not initial network/bootstrap or dev compilation.
    await page.locator('.issue-card-link').first().click(); await expect(page.locator('dialog.issue-detail')).toBeVisible();
    await page.keyboard.press('Escape'); await expect(page.locator('dialog.issue-detail')).toHaveCount(0);
    await page.evaluate(() => {
      window.uxLongTasks = [];
      if (PerformanceObserver.supportedEntryTypes.includes('longtask')) new PerformanceObserver((list) => {
        window.uxLongTasks.push(...list.getEntries().map((entry) => Math.round(entry.duration)));
      }).observe({ type: 'longtask' });
    });
    const samples = { detail: [], priorityFilter: [], searchIncluding300msDebounce: [] };
    for (let index = 0; index < 10; index++) {
      samples.detail.push(await sample(page, 'click', 'detail', () => page.locator('.issue-card-link').first().click()));
      await page.keyboard.press('Escape'); await expect(page.locator('dialog.issue-detail')).toHaveCount(0);
      samples.priorityFilter.push(await sample(page, 'change', 50, () => page.getByLabel('우선순위 필터', { exact: true }).selectOption('P1')));
      await page.getByRole('button', { name: '검색·필터 초기화', exact: true }).click(); await expect(page.locator('.issue-card')).toHaveCount(100);
      samples.searchIncluding300msDebounce.push(await sample(page, 'input', 1, () => page.getByLabel('제목·번호 검색', { exact: true }).fill(fixture.rows[0].issue_key)));
      await page.getByRole('button', { name: '검색·필터 초기화', exact: true }).click(); await expect(page.locator('.issue-card')).toHaveCount(100);
    }
    const summary = Object.fromEntries(Object.entries(samples).map(([name, values]) => { const sorted = [...values].sort((a,b) => a-b); return [name, { count: values.length, minMs: sorted[0], medianMs: (sorted[4] + sorted[5]) / 2, maxMs: sorted.at(-1) }]; }));
    const report = { date: new Date().toISOString(), environment: { node: process.version, os: release(), cpu: cpus()[0].model, logicalCpus: cpus().length, memoryGiB: Math.round(totalmem()/1024**3), browser: browser.version(), viewport: '1440x1000', build: 'production', issues:100, network:'local loopback; no artificial latency or CPU throttle' }, method:'Browser input/change/click capture timestamp → matching DOM → two requestAnimationFrame callbacks. Warm interactions, 10 samples each. Not INP, propagation latency or a before/after performance comparison.', samples, summary, longTasksMs: await page.evaluate(() => window.uxLongTasks) };
    mkdirSync('docs/evidence', { recursive:true }); writeFileSync(process.env.UI_REVIEW_PHASE === 'after' ? 'docs/evidence/ui-interaction.json' : 'docs/evidence/d11-interaction.json', JSON.stringify(report,null,2)+'\n');
    await info.attach('d11-interaction', { body:JSON.stringify(report), contentType:'application/json' });
    console.log(JSON.stringify({ summary, longTasksMs: report.longTasksMs }));
  } finally { await cleanupUxFixture(fixture); }
});
