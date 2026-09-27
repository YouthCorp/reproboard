/* global process, document, window */
import { test, expect } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';

// Review-only persistent fixture: never part of CI or production, no secret values.
const fixture = JSON.parse(await readFile('.local/ui-review-fixture.json', 'utf8'));
const phase = process.env.UI_REVIEW_PHASE;
if (!['before', 'first', 'after'].includes(phase)) throw new Error('Set UI_REVIEW_PHASE to before, first, or after');
const output = `docs/evidence/ui-${phase}`;
test('same synthetic data at desktop, tablet and mobile sizes', async ({ page }) => {
  await mkdir(output, {recursive:true});
  await page.goto('/login');
  await page.getByRole('button', {name:'개발 계정으로 로그인',exact:true}).waitFor();
  await page.screenshot({path:`${output}/login.png`});
  await page.getByRole('button', {name:'개발 계정으로 로그인',exact:true}).click();
  await page.locator('#workspace-select').waitFor();
  await page.locator('#workspace-select').selectOption(fixture.board.workspaceId);
  await expect(page.locator('.issue-card')).toHaveCount(16);
  await expect(page.locator('[data-connection-state]')).toHaveAttribute('data-connection-state','normal');
  const measurements = [];
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({width,height:900});
    await page.screenshot({path:`${output}/board-${width}.png`});
    measurements.push(await page.evaluate(() => ({width:window.innerWidth, boardTop:document.querySelector('.live-board-grid').getBoundingClientRect().top, overflow:document.documentElement.scrollWidth>window.innerWidth})));
    await page.locator(`[data-issue-id="${fixture.board.rows[8].id}"] .issue-card-link`).click();
    await expect(page.locator('.issue-detail')).toBeVisible();
    await page.screenshot({path:`${output}/detail-${width}.png`});
    await expect(page.locator('.issue-detail input[name="title"]')).toHaveValue(fixture.board.rows[8].title);
    await page.getByRole('button',{name:'상세 닫기',exact:true}).click();
    await expect(page.locator(`[data-issue-id="${fixture.board.rows[8].id}"] .issue-card-link`)).toBeFocused();
    await page.evaluate(()=>window.scrollTo(0,0));
  }
  await page.setViewportSize({width:1440,height:900});
  await page.locator('input[type=search]').fill('없는 검색 결과 qzx');
  await expect(page.locator('.issue-card')).toHaveCount(0);
  await page.screenshot({path:`${output}/no-results.png`});
  await page.getByRole('button',{name:'검색·필터 초기화',exact:true}).click();
  await page.locator('#workspace-select').selectOption(fixture.empty.workspaceId);
  await expect(page.locator('.issue-card')).toHaveCount(0);
  await expect(page.locator('.empty-inbox')).toBeVisible();
  await expect(page.locator('[data-connection-state]')).toHaveAttribute('data-connection-state','normal');
  await page.screenshot({path:`${output}/empty.png`});
  await writeFile(`${output}/measurements.json`,JSON.stringify(measurements,null,2));
  expect(measurements.every(row=>!row.overflow)).toBe(true);
});
