/* global document, window */
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { localDb, localStack, readAccounts } from '../../scripts/local-stack.mjs';

const accounts = readAccounts(), teams = new Set(), clients = {};
let db;
test.beforeAll(async () => {
  const stack = localStack(); db = await localDb(stack);
  for (const role of ['owner','member']) {
    const account = accounts.find((a) => a.role === role);
    clients[role] = createClient(stack.API_URL, stack.PUBLISHABLE_KEY || stack.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    expect((await clients[role].auth.signInWithPassword({ email: account.email, password: account.password })).error).toBeNull();
  }
});
test.afterAll(async () => {
  if (!db) return;
  await db.query('begin');
  try {
    for (const table of ['public.verification_runs','public.activity_events','private.workspace_invites','private.command_receipts','public.issues','public.workspace_members']) await db.query(`delete from ${table} where workspace_id=any($1::uuid[])`, [[...teams]]);
    await db.query('delete from public.workspaces where id=any($1::uuid[])', [[...teams]]); await db.query('commit');
  } catch (error) { await db.query('rollback'); throw error; } finally { await db.end(); }
});
async function workspace() {
  const id = randomUUID(); teams.add(id);
  const result = await clients.owner.rpc('create_workspace', { p_workspace_id: id, p_request_id: randomUUID(), p_payload: { name: '합성 D5 제품 흐름 팀' } });
  expect(result.error).toBeNull(); expect(result.data.ok).toBe(true);
  await db.query("insert into public.workspace_members(workspace_id,user_id,role) values ($1,$2,'member'),($1,$3,'viewer')", [id, accounts.find((a) => a.role === 'member').id, accounts.find((a) => a.role === 'viewer').id]);
  return id;
}
async function login(page, workspaceId, issueId, role = 'owner') {
  const next = `/board?workspace=${workspaceId}${issueId ? `&issue=${issueId}` : ''}`;
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('개발 계정', { exact: true }).selectOption(role);
  await page.getByRole('button', { name: '개발 계정으로 로그인', exact: true }).click();
  await expect(page.getByText(`역할: ${role}`, { exact: true })).toBeVisible();
}
async function fixture(workspaceId) {
  const fields = { title: '검증 대기 중인 합성 버그', steps: '1. 목록 열기', expected: '표시됨', actual: '빈 화면', environment: 'Windows', reproduction: 'reproduced', severity: 'S2', priority: 'P1', assignee_id: accounts.find((a) => a.role === 'member').id, fix_note: '초기 렌더링 수정', target_build: 'local-d5' };
  let result = await clients.owner.rpc('create_issue', { p_workspace_id: workspaceId, p_request_id: randomUUID(), p_payload: fields });
  expect(result.error).toBeNull(); expect(result.data.ok).toBe(true); let row = result.data.data;
  for (const status of ['ready','in_progress','verify']) {
    result = await clients.owner.rpc('transition_issue', { p_workspace_id: workspaceId, p_issue_id: row.id, p_expected_version: row.version, p_request_id: randomUUID(), p_payload: { target_status: status } });
    expect(result.error).toBeNull(); expect(result.data.ok).toBe(true); row = result.data.data;
  }
  return row;
}
const detail = (page) => page.locator('dialog.issue-detail');
const modal = (page) => page.locator('dialog.transition-dialog');
async function stored(id) { return (await db.query('select * from public.issues where id=$1', [id])).rows[0]; }
async function save(page) {
  await detail(page).getByRole('button', { name: '변경 저장', exact: true }).click();
  await expect(detail(page).locator('.issue-edit-form .form-message')).toContainText('저장했습니다.');
}
async function forward(page, name, target, rowId) {
  await detail(page).getByRole('button', { name, exact: true }).click();
  await modal(page).getByRole('button', { name: '이동 확인', exact: true }).click();
  await expect(modal(page)).toHaveCount(0);
  expect((await stored(rowId)).status).toBe(target);
}

test('D5 UI completes Inbox→Ready→In Progress→Verify→fail→Verify→Done→reopen, with actual history and captures', async ({ page, browser }, info) => {
  test.setTimeout(60_000);
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  const team = await workspace(), title = '필터 변경 뒤 목록이 갱신되지 않는 버그';
  await login(page, team);
  await page.getByLabel('새 이슈 제목', { exact: true }).fill(title);
  await page.getByRole('button', { name: 'Inbox에 생성', exact: true }).click();
  await page.locator('.issue-card').filter({ has: page.getByRole('heading', { name: title, exact: true }) }).getByRole('button', { name: /상세 열기$/ }).click();
  const row = (await db.query('select * from public.issues where workspace_id=$1', [team])).rows[0];
  await detail(page).getByRole('button', { name: 'Ready로 이동', exact: true }).click();
  await expect(modal(page).getByText('먼저 필수 정보를 저장하세요.', { exact: true })).toBeVisible();
  await expect(modal(page).getByRole('button', { name: '이동 확인', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape'); await expect(modal(page)).toHaveCount(0); await expect(detail(page)).toBeVisible();
  expect((await stored(row.id)).status).toBe('inbox'); expect((await stored(row.id)).version).toBe(1);
  for (const [label, value] of [['재현 단계','1. 보드 열기\n2. 필터 바꾸기\n3. 목록 확인'],['기대 결과','조건에 맞는 새 목록 표시'],['실제 결과','이전 목록이 그대로 남음'],['환경','Windows · Chromium · 합성 환경']]) await detail(page).getByLabel(label, { exact: true }).fill(value);
  await detail(page).getByLabel('재현 상태', { exact: true }).selectOption('reproduced');
  await detail(page).getByLabel('심각도 (severity)', { exact: true }).selectOption('S2');
  await detail(page).getByLabel('우선순위 (priority)', { exact: true }).selectOption('P1');
  await expect(detail(page).getByRole('button', { name: 'Ready로 이동', exact: true })).toBeDisabled();
  await save(page); await forward(page, 'Ready로 이동', 'ready', row.id);
  await detail(page).getByLabel('재현 단계', { exact: true }).fill(' ');
  await detail(page).getByRole('button', { name: '변경 저장', exact: true }).click();
  await expect(detail(page).getByLabel('재현 단계', { exact: true })).toBeFocused(); expect((await stored(row.id)).steps).toContain('보드 열기');
  await detail(page).getByLabel('재현 단계', { exact: true }).fill('1. 보드 열기\n2. 필터 바꾸기\n3. 목록 확인');
  await detail(page).getByLabel('담당자', { exact: true }).selectOption(accounts.find((a) => a.role === 'member').id);
  await save(page); await forward(page, 'In Progress로 이동', 'in_progress', row.id);
  await detail(page).getByRole('button', { name: 'Verify로 이동', exact: true }).click();
  await expect(modal(page).getByText('수정 메모를 입력하세요.', { exact: true })).toBeVisible();
  await modal(page).getByRole('button', { name: '이동 취소', exact: true }).click(); expect((await stored(row.id)).status).toBe('in_progress');
  await detail(page).getByLabel('수정 메모', { exact: true }).fill('필터 변경 시 서버 목록을 재조회하도록 수정');
  await detail(page).getByLabel('대상 빌드', { exact: true }).fill('local-d5'); await save(page);
  await forward(page, 'Verify로 이동', 'verify', row.id);
  const beforeFail = await stored(row.id);
  await detail(page).getByRole('button', { name: '검증 실패 → In Progress', exact: true }).click();
  await modal(page).getByRole('button', { name: '실패 기록 후 In Progress', exact: true }).click();
  await expect(modal(page).getByLabel('검증 환경', { exact: true })).toBeFocused();
  await modal(page).getByLabel('검증 환경', { exact: true }).fill('Windows · Chromium · 느린 연결');
  await modal(page).getByLabel('검증 실패 이유', { exact: true }).fill('느린 연결에서 이전 목록이 다시 표시됨');
  await modal(page).getByRole('button', { name: '실패 기록 후 In Progress', exact: true }).click(); await expect(modal(page)).toHaveCount(0);
  expect((await stored(row.id)).status).toBe('in_progress');
  await detail(page).getByLabel('수정 메모', { exact: true }).fill('이전 조회 응답이 최신 목록을 덮지 않도록 추가 수정'); await save(page);
  await forward(page, 'Verify로 이동', 'verify', row.id);
  const beforePass = await stored(row.id);
  await detail(page).getByRole('button', { name: '검증 통과 → Done', exact: true }).click();
  await modal(page).getByLabel('검증 환경', { exact: true }).fill('Windows · Chromium · 느린 연결 포함');
  await modal(page).getByLabel('검증 메모', { exact: true }).fill('필터를 연속 변경해도 최신 목록 유지 확인');
  await page.setViewportSize({ width: 1440, height: 1050 });
  await info.attach('d5-verification-dialog', { body: await page.screenshot(), contentType: 'image/png' });
  await modal(page).getByRole('button', { name: '통과 기록 후 Done', exact: true }).click(); await expect(modal(page)).toHaveCount(0);
  await expect(detail(page).getByText('Done의 본문은 잠겨 있습니다.', { exact: false })).toBeVisible();
  await expect(detail(page).getByLabel('이슈 제목', { exact: true })).toBeHidden();
  await expect(detail(page).getByText('통과 · local-d5', { exact: true })).toBeVisible();
  await expect(detail(page).getByText('실패 · local-d5', { exact: true })).toBeVisible();
  const runs = (await db.query('select result,issue_version_before,actor_id from public.verification_runs where issue_id=$1 order by created_at', [row.id])).rows;
  expect(runs.map((run) => run.result)).toEqual(['fail','pass']); expect(runs.map((run) => run.issue_version_before)).toEqual([beforeFail.version,beforePass.version]);
  await detail(page).evaluate((element) => { element.scrollTop = 0; });
  await info.attach('d5-done-history', { body: await page.screenshot(), contentType: 'image/png' });
  const viewerContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3000' });
  try {
    const viewer = await viewerContext.newPage(); await login(viewer, team, row.id, 'viewer');
    await expect(detail(viewer).getByText('통과 · local-d5', { exact: true })).toBeVisible();
    await expect(detail(viewer).getByRole('region', { name: '상태 이동', exact: true })).toHaveCount(0);
  } finally { await viewerContext.close(); }
  await page.setViewportSize({ width: 390, height: 844 });
  await detail(page).getByRole('button', { name: '재오픈 → Inbox', exact: true }).click();
  await modal(page).getByRole('button', { name: '이동 확인', exact: true }).click();
  await expect(modal(page).getByLabel('재오픈 사유', { exact: true })).toBeFocused();
  await modal(page).getByLabel('재오픈 사유', { exact: true }).fill('다른 브라우저에서 같은 증상 재발');
  expect(await modal(page).evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await modal(page).getByRole('button', { name: '이동 확인', exact: true }).click(); await expect(modal(page)).toHaveCount(0);
  expect((await stored(row.id)).status).toBe('inbox');
  await expect(detail(page).getByLabel('이슈 제목', { exact: true })).toBeVisible();
  await expect(detail(page).getByText('사유: 다른 브라우저에서 같은 증상 재발', { exact: true })).toBeVisible();
  expect((await db.query('select count(*)::int as n from public.verification_runs where issue_id=$1', [row.id])).rows[0].n).toBe(2);
  await page.reload(); await expect(detail(page).getByText('통과 · local-d5', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('D5 stale verification keeps entered evidence, rejects the old version and requires explicit recheck', async ({ page }) => {
  const team = await workspace(), row = await fixture(team); await login(page, team, row.id);
  await detail(page).getByRole('button', { name: '검증 통과 → Done', exact: true }).click();
  await modal(page).getByLabel('검증 환경', { exact: true }).fill('검증 중인 환경');
  await modal(page).getByLabel('검증 메모', { exact: true }).fill('내가 작성하던 검증 메모');
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route('**/rpc/transition_issue', async (route) => { await gate; await route.continue(); });
  // Preserve the actual DB-CONFLICT check with Realtime now disabling known-stale input.
  await modal(page).getByRole('button', { name: '통과 기록 후 Done', exact: true }).click();
  const update = await clients.member.rpc('update_issue', { p_workspace_id: team, p_issue_id: row.id, p_expected_version: row.version, p_request_id: randomUUID(), p_payload: { fix_note: 'Member가 검증 도중 수정 내용을 변경' } });
  expect(update.error).toBeNull(); expect(update.data.ok).toBe(true);
  release();
  await expect(modal(page).getByText('다른 변경이 먼저 저장됐습니다.', { exact: false })).toBeVisible();
  expect((await stored(row.id)).status).toBe('verify');
  expect((await db.query('select count(*)::int as n from public.verification_runs where issue_id=$1', [row.id])).rows[0].n).toBe(0);
  await expect(modal(page).getByLabel('검증 메모', { exact: true })).toHaveValue('내가 작성하던 검증 메모');
  await modal(page).getByText('최신 저장 내용 확인', { exact: true }).click();
  await expect(modal(page).getByText('Member가 검증 도중 수정 내용을 변경', { exact: true })).toBeVisible();
  await modal(page).getByRole('button', { name: '최신 이슈를 확인하고 다시 시도', exact: true }).click();
  await modal(page).getByLabel('검증 메모', { exact: true }).fill('새 수정 내용을 다시 검증함');
  await modal(page).getByRole('button', { name: '통과 기록 후 Done', exact: true }).click(); await expect(modal(page)).toHaveCount(0);
  expect((await stored(row.id)).status).toBe('done');
  expect((await db.query('select issue_version_before from public.verification_runs where issue_id=$1', [row.id])).rows[0].issue_version_before).toBe(update.data.data.version);
});

test('D5 pre-send transport failure keeps the status and explicit retry uses the same request id', async ({ page }) => {
  const team = await workspace(), row = await fixture(team); await login(page, team, row.id);
  const ids = [];
  page.on('request', (request) => { if (request.url().endsWith('/rpc/transition_issue')) ids.push(request.postDataJSON().p_request_id); });
  await detail(page).getByRole('button', { name: '검증 통과 → Done', exact: true }).click();
  await modal(page).getByLabel('검증 환경', { exact: true }).fill('합성 통신 장애 검증');
  await page.route('**/rpc/transition_issue', (route) => route.abort());
  await modal(page).getByRole('button', { name: '통과 기록 후 Done', exact: true }).click();
  await expect(modal(page).getByText('이동 결과를 확인하지 못했습니다.', { exact: false })).toBeVisible();
  expect((await stored(row.id)).status).toBe('verify'); expect((await stored(row.id)).version).toBe(row.version);
  await expect(modal(page).getByLabel('검증 환경', { exact: true })).toHaveValue('합성 통신 장애 검증');
  await page.unroute('**/rpc/transition_issue');
  await modal(page).getByRole('button', { name: '같은 이동 요청으로 다시 확인', exact: true }).click(); await expect(modal(page)).toHaveCount(0);
  expect(ids).toHaveLength(2); expect(ids[0]).toBe(ids[1]); expect((await stored(row.id)).status).toBe('done');
  expect((await db.query('select count(*)::int as n from public.verification_runs where issue_id=$1', [row.id])).rows[0].n).toBe(1);
});
