/* global document, window, KeyboardEvent, CompositionEvent, Event, Option */
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { localDb, localStack, readAccounts } from '../../scripts/local-stack.mjs';

const accounts = readAccounts();
const teams = new Set();
let db, owner;
test.beforeAll(async () => {
  const status = localStack(); db = await localDb(status);
  owner = createClient(status.API_URL, status.PUBLISHABLE_KEY || status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const account = accounts.find((a) => a.role === 'owner');
  expect((await owner.auth.signInWithPassword({ email: account.email, password: account.password })).error).toBeNull();
});
test.afterAll(async () => {
  if (!db) return;
  await db.query('begin');
  try {
    for (const table of ['public.activity_events','private.workspace_invites','private.command_receipts','public.issues','public.workspace_members']) await db.query(`delete from ${table} where workspace_id=any($1::uuid[])`, [[...teams]]);
    await db.query('delete from public.workspaces where id=any($1::uuid[])', [[...teams]]);
    await db.query('commit');
  } catch (error) { await db.query('rollback'); throw error; }
  finally { await db.end(); }
});
async function workspace() {
  const id = randomUUID(); teams.add(id);
  const result = await owner.rpc('create_workspace', { p_workspace_id: id, p_request_id: randomUUID(), p_payload: { name: '합성 D4 검증 팀' } });
  expect(result.error).toBeNull(); expect(result.data.ok).toBe(true); return id;
}
async function login(page, id) {
  await page.goto(`/login?next=${encodeURIComponent(`/board?workspace=${id}`)}`);
  await page.getByLabel('개발 계정', { exact: true }).selectOption('owner');
  await page.getByRole('button', { name: '개발 계정으로 로그인', exact: true }).click();
  await expect(page.getByText('역할: owner', { exact: true })).toBeVisible();
}
async function fixture(id, fields) {
  const result = await owner.rpc('create_issue', { p_workspace_id: id, p_request_id: randomUUID(), p_payload: fields });
  expect(result.error).toBeNull(); expect(result.data.ok).toBe(true); return result.data.data;
}
function card(page, title) { return page.locator('.issue-card').filter({ has: page.getByRole('heading', { name: title, exact: true }) }); }

test('D4 structured create/edit/reload/re-entry shares saved board data, with desktop and mobile captures', async ({ page }, info) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  const id = await workspace();
  const title = '검색 필터 변경 후 목록이 새로고침되지 않음';
  await fixture(id, { title: '한글입력'.repeat(24) });
  await login(page, id);
  const form = page.locator('.issue-create-form');
  await form.getByLabel('새 이슈 제목', { exact: true }).fill(`  ${title}  `);
  await form.getByRole('button', { name: '추가 필드 입력 (선택)', exact: true }).click();
  await form.getByLabel('재현 단계', { exact: true }).fill('  1. 버그 보드를 연다.\n2. 필터를 바꾼다.\n3. 목록을 확인한다.  ');
  await form.getByLabel('기대 결과', { exact: true }).fill('선택한 필터에 맞는 이슈가 표시된다.');
  await form.getByLabel('실제 결과', { exact: true }).fill('이전 목록이 그대로 남는다.');
  await expect(form.getByText('작성 중인 재현 정보 3/4 충족', { exact: true })).toBeVisible();
  await expect(form.getByText('누락: 환경', { exact: true })).toBeVisible();
  await form.getByLabel('환경', { exact: true }).fill('Windows · Chromium · 합성 개발 환경');
  await form.getByLabel('재현 상태', { exact: true }).selectOption('intermittent');
  await form.getByLabel('발생 조건 메모', { exact: true }).fill('페이지 진입 직후 빠르게 필터를 바꿀 때');
  await form.getByLabel('심각도 (severity)', { exact: true }).selectOption('S2');
  await form.getByLabel('우선순위 (priority)', { exact: true }).selectOption('P3');
  await form.getByLabel('담당자', { exact: true }).selectOption(accounts.find((a) => a.role === 'owner').id);
  await form.getByRole('button', { name: 'Inbox에 생성', exact: true }).click();
  await expect(card(page, title)).toBeVisible();
  await expect(card(page, title).getByText('재현 정보 4/4 충족', { exact: true })).toBeVisible();
  let row = (await db.query('select * from public.issues where workspace_id=$1 and title=$2', [id, title])).rows[0];
  expect(row.status).toBe('inbox'); expect(row.steps.startsWith('1.')).toBe(true); expect(row.severity).toBe('S2'); expect(row.priority).toBe('P3');
  await card(page, title).getByRole('button').click();
  await expect(page).toHaveURL(new RegExp(`issue=${row.id}`));
  const detail = page.getByRole('dialog');
  await expect(detail.getByRole('button', { name: '상세 닫기', exact: true })).toBeFocused();
  await detail.getByLabel('실제 결과', { exact: true }).fill('이전 목록이 남아 새로고침해야 바뀐다.');
  await detail.getByLabel('수정 메모', { exact: true }).fill('조회 조건 변경 시 목록을 재조회하도록 수정 예정');
  await detail.getByLabel('대상 빌드', { exact: true }).fill(' local-d4 ');
  await detail.getByRole('button', { name: '변경 저장', exact: true }).click();
  await expect(detail.getByRole('status').filter({ hasText: '저장했습니다.' })).toBeVisible();
  await page.reload();
  await expect(detail.getByLabel('실제 결과', { exact: true })).toHaveValue('이전 목록이 남아 새로고침해야 바뀐다.');
  await expect(detail.getByLabel('대상 빌드', { exact: true })).toHaveValue('local-d4');
  row = (await db.query('select * from public.issues where id=$1', [row.id])).rows[0];
  expect(row.version).toBe(2); expect(row.target_build).toBe('local-d4');
  await detail.getByRole('button', { name: '상세 닫기', exact: true }).click();
  await expect(detail).toHaveCount(0);
  for (const name of ['Inbox','Ready','In Progress','Verify','Done']) await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await form.getByRole('button', { name: '추가 필드 입력 (선택)', exact: true }).count().then(async (count) => { if (!count) await form.getByRole('button', { name: '추가 필드 접기', exact: true }).click(); });
  mkdirSync(resolve('docs/evidence'), { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1050 });
  const boardCapture = await page.screenshot({ path: 'docs/evidence/d4-board.png', fullPage: true });
  await info.attach('d4-board', { body: boardCapture, contentType: 'image/png' });
  await card(page, title).getByRole('button').click();
  await expect(detail.getByLabel('수정 메모', { exact: true })).toHaveValue('조회 조건 변경 시 목록을 재조회하도록 수정 예정');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await detail.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  const mobileCapture = await page.screenshot({ path: 'docs/evidence/d4-mobile-detail.png' });
  await info.attach('d4-mobile-detail', { body: mobileCapture, contentType: 'image/png' });
  await page.keyboard.press('Escape');
  await expect(detail).toHaveCount(0);
  await expect(card(page, title).getByRole('button')).toBeFocused();
  await page.goBack();
  await expect(detail.getByLabel('이슈 제목', { exact: true })).toHaveValue(title);
  expect(errors).toEqual([]);
});

test('D4 form focuses invalid fields, preserves Unicode limits and suppresses composition Enter submission', async ({ page }) => {
  const id = await workspace(); await login(page, id);
  const form = page.locator('.issue-create-form');
  const title = form.getByLabel('새 이슈 제목', { exact: true });
  let creates = 0;
  page.on('request', (request) => { if (request.url().includes('/rpc/create_issue')) creates++; });
  await title.fill('\uFEFF\u3000');
  await form.getByRole('button', { name: 'Inbox에 생성', exact: true }).click();
  await expect(title).toBeFocused(); await expect(title).toHaveAttribute('aria-invalid', 'true');
  await expect(title).toHaveAccessibleDescription(/1~120/);
  await title.fill('😀'.repeat(121));
  await form.getByRole('button', { name: 'Inbox에 생성', exact: true }).click();
  await expect(title).toHaveAttribute('aria-invalid', 'true');
  await title.fill('한글 조합 입력');
  await title.evaluate((element) => {
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '력' }));
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', isComposing: true, keyCode: 229 });
    if (element.dispatchEvent(event)) element.form.requestSubmit();
  });
  expect(creates).toBe(0);
  await title.dispatchEvent('compositionend', { data: '력' });
  await form.getByLabel('재현 단계', { exact: true }).fill('한'.repeat(4001));
  await form.getByRole('button', { name: 'Inbox에 생성', exact: true }).click();
  await expect(form.getByLabel('재현 단계', { exact: true })).toBeFocused();
  await expect(form.getByLabel('재현 단계', { exact: true })).toHaveAccessibleDescription(/4,000/);
  await form.getByLabel('재현 단계', { exact: true }).fill('😀'.repeat(4000));
  await form.getByLabel('재현 상태', { exact: true }).selectOption('intermittent');
  await form.getByRole('button', { name: 'Inbox에 생성', exact: true }).click();
  await expect(form.getByLabel('발생 조건 메모', { exact: true })).toBeFocused();
  await form.getByLabel('발생 조건 메모', { exact: true }).fill('한글 조합 완료 후');
  const viewer = accounts.find((a) => a.role === 'viewer').id;
  await form.getByLabel('담당자', { exact: true }).evaluate((element, id) => { element.add(new Option('Injected viewer', id)); element.value = id; element.dispatchEvent(new Event('change', { bubbles: true })); }, viewer);
  await form.getByRole('button', { name: 'Inbox에 생성', exact: true }).click();
  await expect(form.getByLabel('담당자', { exact: true })).toBeFocused();
  await expect(form.getByLabel('담당자', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await form.getByLabel('담당자', { exact: true }).selectOption('');
  await title.fill('😀'.repeat(120));
  await form.getByRole('button', { name: 'Inbox에 생성', exact: true }).click();
  await expect(card(page, '😀'.repeat(120))).toBeVisible();
  expect(creates).toBe(1);
  const row = (await db.query('select title,steps from public.issues where workspace_id=$1', [id])).rows[0];
  expect(Array.from(row.title)).toHaveLength(120); expect(Array.from(row.steps)).toHaveLength(4000);
});

test('D4 loading, zero rows, read failure/retry, missing detail and refetch preserve the local draft', async ({ page }) => {
  test.setTimeout(60_000);
  const id = await workspace();
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route('**/rest/v1/issues?**', async (route) => { await gate; await route.continue(); });
  await login(page, id);
  await expect(page.getByText('이슈를 불러오는 중…', { exact: true })).toBeVisible();
  release();
  await expect(page.getByText('아직 등록된 이슈가 없습니다.', { exact: true })).toBeVisible();
  await page.unroute('**/rest/v1/issues?**');
  await page.route('**/rest/v1/issues?**', (route) => route.abort());
  await page.getByRole('button', { name: '최신 목록 조회', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: '이슈를 불러오지 못했습니다.' })).toBeVisible({ timeout: 20_000 });
  await page.unroute('**/rest/v1/issues?**');
  await page.getByRole('button', { name: '다시 조회', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: '이슈를 불러오지 못했습니다.' })).toHaveCount(0);
  const row = await fixture(id, { title: '원격 재조회 합성 이슈' });
  await page.getByRole('button', { name: '최신 목록 조회', exact: true }).click();
  await card(page, row.title).getByRole('button').click();
  const detail = page.getByRole('dialog');
  await detail.getByLabel('재현 단계', { exact: true }).fill('재조회해도 남는 로컬 초안');
  const result = await owner.rpc('update_issue', { p_workspace_id: id, p_issue_id: row.id, p_expected_version: row.version, p_request_id: randomUUID(), p_payload: { title: '서버의 새 제목', steps: '서버의 새 재현 단계' } });
  expect(result.error).toBeNull(); expect(result.data.ok).toBe(true);
  await detail.getByRole('button', { name: '최신 상세 조회', exact: true }).click();
  await expect(detail.getByRole('heading', { name: '서버의 새 제목', exact: true })).toBeVisible();
  await expect(detail.getByLabel('재현 단계', { exact: true })).toHaveValue('재조회해도 남는 로컬 초안');
  await expect(detail.getByText('다른 변경이 있습니다. 작성 중인 입력은 유지했습니다.', { exact: true })).toBeVisible();
  await page.route('**/rest/v1/issues?**', (route) => route.abort());
  await detail.getByRole('button', { name: '최신 상세 조회', exact: true }).click();
  await expect(detail.getByRole('alert').filter({ hasText: '최신 이슈를 불러오지 못했습니다.' })).toBeVisible({ timeout: 20_000 });
  await expect(detail.getByLabel('재현 단계', { exact: true })).toHaveValue('재조회해도 남는 로컬 초안');
  await page.unroute('**/rest/v1/issues?**');
  await detail.getByRole('button', { name: '최신 상세 조회', exact: true }).click();
  await expect(detail.getByRole('alert').filter({ hasText: '최신 이슈를 불러오지 못했습니다.' })).toHaveCount(0);
  await detail.getByRole('button', { name: '최신 값으로 다시 편집', exact: true }).click();
  await expect(detail.getByLabel('재현 단계', { exact: true })).toHaveValue('서버의 새 재현 단계');
  await page.goto(`/board?workspace=${id}&issue=${randomUUID()}`);
  await expect(page.getByRole('dialog').getByText('이슈가 없거나 접근 권한이 없습니다.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '상세 닫기', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
