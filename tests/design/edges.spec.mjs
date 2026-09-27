/* global document, window */
import { test, expect } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
const fixture = JSON.parse(await readFile('.local/ui-review-fixture.json', 'utf8'));
const output = 'docs/evidence/ui-after';
async function login(page, role = 'owner', suffix = '') {
  await page.goto(`/login?next=${encodeURIComponent(`/board?workspace=${fixture.board.workspaceId}${suffix}`)}`);
  await page.getByLabel('개발 계정', {exact:true}).selectOption(role);
  await page.getByRole('button', {name:'개발 계정으로 로그인', exact:true}).click();
  await expect(page.locator('[data-connection-state]')).toHaveAttribute('data-connection-state','normal');
}
test('mobile applied filters remain discoverable after reload and reset', async ({ page }) => {
  await mkdir(output, {recursive:true});
  await page.setViewportSize({width:390,height:900});
  await login(page, 'owner', '&priority=P1&sort=priority');
  const filters = page.locator('.filter-options');
  await expect(filters).not.toHaveAttribute('open');
  await expect(filters.locator('summary')).toContainText('P1 · 우선순위 순');
  await filters.locator('summary').click();
  await expect(page.getByLabel('우선순위 필터',{exact:true})).toHaveValue('P1');
  await page.getByLabel('심각도 필터',{exact:true}).selectOption('S2');
  await expect(page).toHaveURL(/severity=S2/);
  await page.reload();
  await expect(filters.locator('summary')).toContainText('S2 · P1 · 우선순위 순');
  await expect(filters).not.toHaveAttribute('open');
  await page.screenshot({path:`${output}/mobile-filters.png`});
  await page.getByRole('button',{name:'검색·필터 초기화',exact:true}).click();
  await expect(page.locator('.issue-card')).toHaveCount(16);
  await expect(page).toHaveURL(new RegExp(`workspace=${fixture.board.workspaceId}$`));
});
test('blocked webfont keeps long Korean content operable with fallback and reduced motion', async ({page}) => {
  await mkdir(output, {recursive:true});
  let blocked = 0;
  await page.route('**/fonts/SUIT-Variable.woff2', route => { blocked++; return route.abort('failed'); });
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width:390,height:900});
  await login(page);
  await page.locator(`[data-issue-id="${fixture.board.rows[8].id}"] .issue-card-link`).click();
  await expect(page.locator('.issue-detail input[name=title]')).toHaveValue(fixture.board.rows[8].title);
  expect(blocked).toBeGreaterThan(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({path:`${output}/font-fallback-390.png`});
  await page.keyboard.press('Escape');
  await expect(page.locator(`[data-issue-id="${fixture.board.rows[8].id}"] .issue-card-link`)).toBeFocused();
});
test('read-only member sees readable detail without editing controls', async ({page}) => {
  await mkdir(output, {recursive:true});
  await login(page, 'viewer');
  await expect(page.getByText('역할: 읽기 전용',{exact:true})).toBeVisible();
  await page.locator(`[data-issue-id="${fixture.board.rows[8].id}"] .issue-card-link`).click();
  const detail = page.locator('.issue-detail');
  await expect(detail.getByRole('button',{name:'변경 저장',exact:true})).toHaveCount(0);
  await expect(detail.getByText(fixture.board.rows[8].steps, {exact:true})).toBeVisible();
  await page.screenshot({path:`${output}/viewer-1440.png`});
  await page.setViewportSize({width:390,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({path:`${output}/viewer-390.png`});
});
