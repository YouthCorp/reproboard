/* global window, URL, URLSearchParams */
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { localDb, localStack, readAccounts } from '../../scripts/local-stack.mjs';

const accounts = readAccounts(), teams = new Set();
test.use({ actionTimeout: 10_000 });
let db, owner, outsider;
test.beforeAll(async () => {
  const stack = localStack(); db = await localDb(stack);
  const clients = {};
  for (const role of ['owner', 'outsider']) {
    clients[role] = createClient(stack.API_URL, stack.PUBLISHABLE_KEY || stack.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const account = accounts.find((a) => a.role === role);
    expect((await clients[role].auth.signInWithPassword({ email: account.email, password: account.password })).error).toBeNull();
  }
  owner = clients.owner; outsider = clients.outsider;
});
test.afterAll(async () => {
  if (!db) return;
  await db.query('begin');
  try {
    for (const table of ['public.activity_events', 'private.command_receipts', 'public.issues', 'public.workspace_members']) await db.query(`delete from ${table} where workspace_id=any($1::uuid[])`, [[...teams]]);
    await db.query('delete from public.workspaces where id=any($1::uuid[])', [[...teams]]); await db.query('commit');
  } catch (error) { await db.query('rollback'); throw error; } finally { await db.end(); }
});
async function fixture(client = owner) {
  const workspaceId = randomUUID(); teams.add(workspaceId);
  expect((await client.rpc('create_workspace', { p_workspace_id: workspaceId, p_request_id: randomUUID(), p_payload: { name: '합성 D10 URL 검증 팀' } })).data.ok).toBe(true);
  const member = accounts.find((a) => a.role === 'member').id;
  if (client === owner) await db.query("insert into public.workspace_members(workspace_id,user_id,role) values($1,$2,'member')", [workspaceId, member]);
  const inputs = client === outsider ? [{ title: '타팀 비공개 이슈' }] : [
    { title: 'Login 로그인 모바일', severity: 'S2', priority: 'P1', assignee_id: member },
    { title: 'LOGIN 데스크톱', severity: 'S2', priority: 'P0' },
    { title: '다른 오류', severity: 'S1', priority: 'P2' },
    { title: 'login 한글 입력', severity: 'S2', priority: 'P1', assignee_id: member },
  ];
  const rows = [];
  for (const input of inputs) {
    const result = await client.rpc('create_issue', { p_workspace_id: workspaceId, p_request_id: randomUUID(), p_payload: input });
    expect(result.error).toBeNull(); expect(result.data.ok).toBe(true); rows.push(result.data.data);
  }
  // Only this test's UUIDs: exact timestamp ties exercise the stable id ordering.
  await db.query("update public.issues set updated_at='2026-09-24T00:00:00Z' where workspace_id=$1", [workspaceId]);
  return { workspaceId, rows, member };
}
async function login(page, next, role = 'owner') {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('개발 계정', { exact: true }).selectOption(role);
  await page.getByRole('button', { name: '개발 계정으로 로그인', exact: true }).click();
  await expect(page.getByText(`역할: ${{owner:'관리자',member:'멤버',viewer:'읽기 전용'}[role]}`, { exact: true })).toBeVisible();
}
const board = (workspaceId) => `/board?workspace=${workspaceId}`;
const query = (page) => new URL(page.url()).searchParams;
const cardIds = (page) => page.locator('.issue-card').evaluateAll((cards) => cards.map((card) => card.getAttribute('data-issue-id')));
const healthy = (page) => expect(page.locator('[data-connection-state]')).toHaveAttribute('data-connection-state', 'normal', { timeout: 25_000 });
const close = async (page) => { await page.getByRole('button', { name: '상세 닫기', exact: true }).click(); await expect(page.locator('dialog[open]')).toHaveCount(0); };

test('D10 combined URL filters and stable sorting copy to another session, reload, back/forward and detail close history', async ({ page, browser }, info) => {
  test.setTimeout(75_000);
  const { workspaceId, rows, member } = await fixture();
  await page.setViewportSize({ width: 1440, height: 1100 });
  await login(page, board(workspaceId)); await healthy(page);
  const originalHistory = await page.evaluate(() => window.history.length);
  await expect.poll(() => cardIds(page)).toEqual(rows.map((r) => r.id).sort());
  await page.getByLabel('정렬', { exact: true }).selectOption('priority');
  const matching = [rows[0].id, rows[3].id].sort();
  await expect.poll(() => cardIds(page)).toEqual([rows[1].id, ...matching, rows[2].id]);
  await page.getByLabel('제목·번호 검색', { exact: true }).fill('  login  ');
  await expect.poll(() => query(page).get('q')).toBe('login');
  await page.getByLabel('심각도 필터', { exact: true }).selectOption('S2');
  await page.getByLabel('우선순위 필터', { exact: true }).selectOption('P1');
  await page.getByLabel('담당자 필터', { exact: true }).selectOption(member);
  await expect.poll(() => cardIds(page)).toEqual(matching);
  expect(await page.evaluate(() => window.history.length)).toBe(originalHistory);
  await page.locator(`[data-issue-id="${matching[0]}"] .issue-card-link`).click();
  await expect(page.locator('dialog.issue-detail')).toBeVisible();
  const copied = new URL(page.url()).pathname + new URL(page.url()).search;
  await info.attach('d10-shared-url', { body: copied, contentType: 'text/plain' });
  const other = await browser.newContext(), memberPage = await other.newPage();
  try {
    await memberPage.goto(copied);
    await memberPage.getByRole('link', { name: '로그인 안내' }).click();
    await memberPage.getByLabel('개발 계정', { exact: true }).selectOption('member');
    await memberPage.getByRole('button', { name: '개발 계정으로 로그인', exact: true }).click();
    await expect(memberPage.getByText('역할: 멤버', { exact: true })).toBeVisible();
    await expect(memberPage.locator('dialog.issue-detail #detail-title')).toHaveText(rows.find((r) => r.id === matching[0]).title);
    await expect(memberPage.locator('.board-result-count')).toHaveText('조회 결과 2 / 4개');
    await page.reload(); await expect(page.locator('dialog.issue-detail')).toBeVisible();
    expect(new URL(page.url()).search).toBe(new URL(memberPage.url()).search);
    await close(page); expect(query(page).has('issue')).toBe(false); expect(query(page).get('q')).toBe('login');
    await page.goBack(); await expect(page.locator('dialog.issue-detail')).toBeVisible();
    await page.goForward(); await expect(page.locator('dialog.issue-detail')).toHaveCount(0);
    await page.goBack(); await page.goBack(); await expect(page.locator('dialog.issue-detail')).toHaveCount(0);
    await expect.poll(() => cardIds(page)).toEqual(matching);
    await page.locator('.board-filters').scrollIntoViewIfNeeded(); await info.attach('d10-url-filters', { body: await page.screenshot(), contentType: 'image/png' });
  } finally { await other.close(); }
});

test('D10 issue key search, zero results, defaults and direct filtered-out detail closes inside the app', async ({ page }) => {
  const { workspaceId, rows } = await fixture();
  await login(page, board(workspaceId)); await healthy(page);
  await page.getByLabel('제목·번호 검색', { exact: true }).fill(rows[1].issue_key.toLowerCase());
  await expect.poll(() => cardIds(page)).toEqual([rows[1].id]);
  await page.getByLabel('제목·번호 검색', { exact: true }).fill('일치하는 이슈 없음');
  await expect(page.getByText('조건에 맞는 버그가 없습니다. 검색어나 필터를 바꾸거나 초기화해 주세요.')).toBeVisible();
  await expect(page.getByText('아직 등록된 버그가 없습니다. 제목만 적어 첫 버그를 등록해 보세요.', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '검색·필터 초기화', exact: true }).click();
  await expect(page).toHaveURL(board(workspaceId));
  await page.getByLabel('담당자 필터', { exact: true }).selectOption('none');
  await expect.poll(() => cardIds(page)).toEqual([rows[1].id, rows[2].id].sort());
  await page.goto('/login'); // A known non-board predecessor must not become the close target.
  await page.goto(`${board(workspaceId)}&q=nomatch&issue=${rows[0].id}`);
  await expect(page.locator('dialog.issue-detail #detail-title')).toHaveText(rows[0].title);
  await expect(page.locator('.board-result-count')).toHaveText('조회 결과 0 / 4개');
  await close(page); await expect(page).toHaveURL(`${board(workspaceId)}&q=nomatch`);
  await page.goBack(); await expect(page.locator('dialog.issue-detail')).toBeVisible();
  await page.goForward(); await expect(page.locator('dialog.issue-detail')).toHaveCount(0);
});

test('D10 invalid enums/UUIDs canonicalize once; unknown/foreign issue and workspace never leak data', async ({ page }) => {
  const { workspaceId, rows } = await fixture(), foreign = await fixture(outsider);
  await login(page, board(workspaceId)); await healthy(page);
  let unauthorizedReads = 0;
  page.on('request', (request) => { if (request.url().includes('/rest/v1/') && request.url().includes(foreign.workspaceId)) unauthorizedReads++; });
  await page.goto(`${board(workspaceId)}&severity=bad&priority=bad&assignee=not-uuid&sort=updated&issue=javascript:alert(1)&extra=drop&q=&q=second`);
  await expect(page).toHaveURL(board(workspaceId)); await expect(page.locator('.issue-card')).toHaveCount(4);
  for (const id of [randomUUID(), foreign.rows[0].id]) {
    await page.goto(`${board(workspaceId)}&issue=${id}`);
    await expect(page.getByText('버그가 없거나 볼 수 없는 팀입니다. 팀과 주소를 확인해 주세요.')).toBeVisible();
    await expect(page.getByText(foreign.rows[0].title, { exact: true })).toHaveCount(0); await close(page);
  }
  await page.goto(`${board(workspaceId)}&assignee=${accounts.find((a) => a.role === 'outsider').id}`);
  await expect(page.getByText('선택한 담당자가 이 팀에 없거나 조회할 수 없습니다. 담당자 필터를 변경하세요.')).toBeVisible();
  await expect(page.locator('.issue-card')).toHaveCount(0);
  await expect(page.getByRole('option', { name: '다른 팀 Owner', exact: true })).toHaveCount(0);
  for (const id of [foreign.workspaceId, randomUUID()]) {
    await page.goto(`${board(id)}&issue=${rows[0].id}`);
    await expect(page.getByText('접근할 수 있는 팀이 없습니다. 팀 주소와 로그인 계정을 확인하세요.')).toBeVisible();
    await expect(page.locator('.issue-card')).toHaveCount(0);
  }
  expect(unauthorizedReads).toBe(0);
  await page.goto('/board?workspace=bad&issue=bad&assignee=bad');
  await expect(page.locator('#workspace-select')).not.toHaveValue('');
  await expect.poll(() => query(page).get('workspace')).toMatch(/^[0-9a-f-]{36}$/);
  expect(query(page).has('issue')).toBe(false); expect(query(page).has('assignee')).toBe(false);
});

test('D10 IME composition does not navigate/refetch, debounced replace preserves newer filters and popstate cancels pending text', async ({ page }) => {
  const { workspaceId, rows } = await fixture();
  await login(page, board(workspaceId)); await healthy(page);
  await page.locator(`[data-issue-id="${rows[0].id}"] .issue-card-link`).click(); await close(page);
  const clockStart = Date.now();
  await page.clock.install({ time: clockStart });
  await page.clock.pauseAt(clockStart + 1000);
  let reads = 0;
  page.on('request', (request) => { if (request.url().includes('/rest/v1/issues?')) reads++; });
  await page.evaluate(() => {
    window.d10SearchWrites = [];
    const replace = window.history.replaceState.bind(window.history);
    window.history.replaceState = (data, unused, url) => {
      const before = new URLSearchParams(window.location.search).get('q'); replace(data, unused, url);
      const after = new URLSearchParams(window.location.search).get('q');
      if (before !== after) window.d10SearchWrites.push(after);
    };
  });
  const history = await page.evaluate(() => window.history.length), input = page.getByLabel('제목·번호 검색', { exact: true });
  await input.dispatchEvent('compositionstart'); await input.fill('ㅎ'); await page.clock.runFor(600);
  await input.fill('한글'); await page.clock.runFor(600); expect(query(page).has('q')).toBe(false);
  await input.dispatchEvent('compositionend', { data: '한글' }); await page.clock.runFor(299); expect(query(page).has('q')).toBe(false);
  await page.clock.runFor(1); await expect.poll(() => query(page).get('q')).toBe('한글');
  await expect(input).toHaveValue('한글'); await expect(input).toBeFocused();
  expect(await page.evaluate(() => window.d10SearchWrites)).toEqual(['한글']); expect(reads).toBe(0);
  await input.fill('login'); await page.getByLabel('심각도 필터', { exact: true }).selectOption('S1');
  await page.clock.runFor(300); await expect.poll(() => query(page).get('q')).toBe('login'); expect(query(page).get('severity')).toBe('S1');
  expect(await page.evaluate(() => window.history.length)).toBe(history);
  await input.fill('아직 반영하면 안 되는 입력'); await page.goBack(); await page.clock.runFor(1000);
  await expect(page.locator('dialog.issue-detail')).toBeVisible(); expect(query(page).has('q')).toBe(false);
  await expect(page.locator('.board-search input')).toHaveValue('');
  await page.goForward(); await expect(page.locator('dialog.issue-detail')).toHaveCount(0);
  await expect(input).toHaveValue('login'); expect(query(page).get('severity')).toBe('S1');
  await input.fill('초기화 직전 입력'); await page.getByRole('button', { name: '검색·필터 초기화', exact: true }).click();
  await page.clock.runFor(1000); await expect(page).toHaveURL(board(workspaceId)); await expect(input).toHaveValue('');
});
