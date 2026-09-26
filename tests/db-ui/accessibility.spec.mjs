/* global document, window */
import { test, expect } from '@playwright/test';
import { createUxFixture, cleanupUxFixture } from '../helpers/ux-fixture.mjs';
import { localDb, localStack } from '../../scripts/local-stack.mjs';

test.use({ actionTimeout: 10_000 });
const fixtures = [];
async function fixture(count) { const value = await createUxFixture(count); fixtures.push(value); return value; }
test.afterAll(async () => { for (const value of fixtures) await cleanupUxFixture(value); });
async function login(page, workspace) {
  await page.goto(`/login?next=${encodeURIComponent(`/board?workspace=${workspace}`)}`);
  await page.getByRole('button', { name: '개발 계정으로 로그인', exact: true }).click();
  await expect(page.locator('[data-connection-state]')).toHaveAttribute('data-connection-state', 'normal', { timeout: 25_000 });
}
async function tabTo(page, locator) {
  for (let index = 0; index < 90; index++) {
    if (await locator.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  await expect(locator).toBeFocused();
}
async function activate(page, name, scope = page) { const button = scope.getByRole('button', { name, exact: true }); await tabTo(page, button); await page.keyboard.press('Enter'); }
async function enter(page, name, value) { const input = detail(page).getByLabel(name, { exact: true }); await tabTo(page, input); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.insertText(value); }
const detail = (page) => page.locator('dialog.issue-detail');
const move = (page) => page.locator('dialog.transition-dialog');

test('D11 keyboard only: create, error associations, modal containment, Ready→In Progress→Verify→Done and logical return focus', async ({ page }, info) => {
  test.setTimeout(90_000);
  const team = await fixture(0); await login(page, team.workspaceId);
  await activate(page, 'Inbox에 생성');
  const title = page.getByLabel('새 이슈 제목', { exact: true });
  await expect(title).toBeFocused(); await expect(title).toHaveAttribute('aria-invalid', 'true');
  expect(await title.evaluate((el) => el.getAttribute('aria-describedby').split(' ').every((id) => document.getElementById(id)?.textContent))).toBe(true);
  await page.keyboard.insertText('합성 D11 키보드만으로 검증까지'); await activate(page, 'Inbox에 생성');
  const card = page.locator('.issue-card-link'); await expect(card).toHaveCount(1);
  await tabTo(page, card); await page.keyboard.press('Enter');
  await expect(detail(page).getByRole('button', { name: '상세 닫기', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab'); expect(await page.evaluate(() => !!document.activeElement.closest('dialog.issue-detail'))).toBe(true);
  await page.keyboard.press('Tab'); await expect(detail(page).getByRole('button', { name: '상세 닫기', exact: true })).toBeFocused();
  await activate(page, 'Ready로 이동'); await expect(move(page)).toBeVisible();
  await expect(move(page).getByRole('button', { name: '이동 확인', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape'); await expect(move(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ready로 이동', exact: true })).toBeFocused();
  for (const [label, value] of [['재현 단계', '로그인 버튼을 누른다.'], ['기대 결과', '목록이 보인다.'], ['실제 결과', '로딩이 남는다.'], ['환경', 'Windows Chromium']]) await enter(page, label, value);
  for (const [label, down] of [['재현 상태', 1], ['심각도 (severity)', 2], ['우선순위 (priority)', 2], ['담당자', 1]]) {
    await tabTo(page, detail(page).getByLabel(label, { exact: true })); await page.keyboard.press('Home');
    for (let index = 0; index < down; index++) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Tab');
  }
  await enter(page, '수정 메모', '합성 수정 확인'); await enter(page, '대상 빌드', 'local-d11');
  await activate(page, '변경 저장'); await expect(detail(page).locator('.form-message')).toContainText('저장했습니다.');
  for (const status of ['Ready', 'In Progress', 'Verify']) {
    await activate(page, `${status}로 이동`); await expect(move(page).getByRole('button', { name: '이동 취소', exact: true })).toBeFocused();
    await page.keyboard.press('Shift+Tab'); await expect(move(page).getByRole('button', { name: '이동 확인', exact: true })).toBeFocused();
    await page.keyboard.press('Enter'); await expect(move(page)).toHaveCount(0);
    await info.attach(`focus-after-${status}`, { body: JSON.stringify(await page.evaluate(() => ({ tag: document.activeElement.tagName, text: document.activeElement.textContent.slice(0,80) }))), contentType: 'application/json' });
    await expect(detail(page).locator('.transition-heading')).toBeFocused();
    await expect(detail(page).locator('.detail-toolbar')).toContainText(status);
  }
  await activate(page, '검증 통과 → Done'); await activate(page, '통과 기록 후 Done', move(page));
  const env = move(page).getByLabel('검증 환경', { exact: true }); await expect(env).toBeFocused(); await expect(env).toHaveAttribute('aria-invalid', 'true');
  await page.keyboard.insertText('Windows Chromium · 실제 키보드 조작'); await activate(page, '통과 기록 후 Done', move(page));
  await expect(move(page)).toHaveCount(0); await expect(detail(page).locator('.transition-heading')).toBeFocused();
  await expect(detail(page).locator('.detail-toolbar')).toContainText('Done');
  await page.keyboard.press('Escape'); await expect(detail(page)).toHaveCount(0); await expect(card).toBeFocused();
  const db = await localDb(localStack());
  try { const rows = (await db.query('select i.status, v.result from public.issues i join public.verification_runs v on v.issue_id=i.id where i.workspace_id=$1', [team.workspaceId])).rows; expect(rows).toEqual([{ status: 'done', result: 'pass' }]); }
  finally { await db.end(); }
});

test('D11 100 long Korean cards at 390/768/1440: readable columns, empty state, fullscreen mobile detail and persistent close', async ({ page }, info) => {
  test.setTimeout(90_000);
  const team = await fixture(100); await login(page, team.workspaceId);
  await expect(page.locator('.issue-card')).toHaveCount(100);
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.locator('[data-status="done"] .column-empty')).toContainText('이 상태의 이슈가 없습니다.');
    await page.locator('.live-board-grid .column-header').first().scrollIntoViewIfNeeded();
    await info.attach(`d11-board-${width}`, { body: await page.screenshot(), contentType: 'image/png' });
    await page.locator('.issue-card-link').first().press('Enter'); await expect(detail(page)).toBeVisible();
    expect(await detail(page).evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    if (width === 390) {
      expect(await detail(page).evaluate((el) => Math.abs(el.getBoundingClientRect().width - window.innerWidth) <= 1)).toBe(true);
      await page.getByLabel('댓글 내용', { exact: true }).press('Tab');
      await info.attach('d11-detail-390', { body: await page.screenshot(), contentType: 'image/png' });
      await expect(detail(page).getByRole('button', { name: '상세 닫기', exact: true })).toBeInViewport();
    }
    await page.keyboard.press('Escape'); await expect(detail(page)).toHaveCount(0);
  }
});

test('D11 card keyboard path skips pointer-only handles and direct detail close returns to board heading', async ({ page }) => {
  const team = await fixture(1); await login(page, team.workspaceId);
  const card = page.locator('.issue-card-link'); await card.press('Shift+Tab');
  expect(await page.evaluate(() => document.activeElement.classList.contains('drag-handle'))).toBe(false);
  await page.goto(`/board?workspace=${team.workspaceId}&issue=${team.rows[0].id}`);
  await expect(detail(page)).toBeVisible(); await page.keyboard.press('Escape');
  await expect(detail(page)).toHaveCount(0); await expect(page.locator('#inbox-title')).toBeFocused();
});
