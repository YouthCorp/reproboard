/* global navigator */
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { createClient } from '@supabase/supabase-js';
import { localDb, localStack, readAccounts } from '../../scripts/local-stack.mjs';

const accounts = readAccounts(), teams = new Set();
let db, owner;
test.beforeAll(async () => {
  const stack = localStack(); db = await localDb(stack);
  owner = createClient(stack.API_URL, stack.PUBLISHABLE_KEY || stack.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const account = accounts.find((a) => a.role === 'owner');
  expect((await owner.auth.signInWithPassword({ email: account.email, password: account.password })).error).toBeNull();
});
test.afterAll(async () => {
  if (!db) return;
  await db.query('begin');
  try {
    for (const table of ['public.verification_runs', 'public.activity_events', 'private.workspace_invites', 'private.command_receipts', 'public.issues', 'public.workspace_members']) await db.query(`delete from ${table} where workspace_id=any($1::uuid[])`, [[...teams]]);
    await db.query('delete from public.workspaces where id=any($1::uuid[])', [[...teams]]); await db.query('commit');
  } catch (error) { await db.query('rollback'); throw error; } finally { await db.end(); }
});
async function fixture() {
  const workspaceId = randomUUID(); teams.add(workspaceId);
  const team = await owner.rpc('create_workspace', { p_workspace_id: workspaceId, p_request_id: randomUUID(), p_payload: { name: '합성 D8 장애 복구 팀' } });
  expect(team.error).toBeNull(); expect(team.data.ok).toBe(true);
  await db.query("insert into public.workspace_members(workspace_id,user_id,role) values ($1,$2,'member')", [workspaceId, accounts.find((a) => a.role === 'member').id]);
  const issue = await owner.rpc('create_issue', { p_workspace_id: workspaceId, p_request_id: randomUUID(), p_payload: { title: '합성 복구 검증 이슈' } });
  expect(issue.error).toBeNull(); expect(issue.data.ok).toBe(true);
  return { workspaceId, row: issue.data.data };
}
async function login(page, workspace, role = 'owner') {
  await page.goto(`/login?next=${encodeURIComponent(`/board?workspace=${workspace}`)}`);
  await page.getByLabel('개발 계정', { exact: true }).selectOption(role);
  await page.getByRole('button', { name: '개발 계정으로 로그인', exact: true }).click();
  await expect(page.getByText(`역할: ${role}`, { exact: true })).toBeVisible();
}
const status = (page) => page.locator('[data-connection-state]');
const healthy = (page) => expect(status(page)).toHaveAttribute('data-connection-state', 'normal', { timeout: 25_000 });
const card = (page, row) => page.locator(`[data-issue-id="${row.id}"]`);
const detail = (page) => page.locator('dialog.issue-detail');
const stored = async (row) => (await db.query('select * from public.issues where id=$1', [row.id])).rows[0];
async function open(page, row) { await card(page, row).locator('.issue-card-link').click(); await expect(detail(page).getByLabel('이슈 제목', { exact: true })).toBeVisible(); }
async function saveTitle(page, title) {
  await detail(page).getByLabel('이슈 제목', { exact: true }).fill(title);
  await detail(page).getByRole('button', { name: '변경 저장', exact: true }).click();
  await expect(detail(page).locator('.form-message')).toContainText('저장했습니다.');
}
function deferred() { let resolve, settled = false; const promise = new Promise((done) => { resolve = () => { settled = true; done(); }; }); return { promise, resolve, wait: () => expect.poll(() => settled, { timeout: 8000 }).toBe(true) }; }
function packet(message) { const p = JSON.parse(message.toString()); return Array.isArray(p) ? { topic: p[2], event: p[3], payload: p[4] } : p; }
async function actor(browser, info, video = false) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, ...(video ? { recordVideo: { dir: info.outputPath('video'), size: { width: 1440, height: 1100 } } } : {}) });
  const page = await context.newPage(); return { context, page, video: page.video() };
}

test('D8 A offline, B changes, A rejoins and drains a change during recovery without sending its draft', async ({ browser }, info) => {
  test.setTimeout(90_000);
  const { workspaceId, row } = await fixture(), a = await actor(browser, info, true), b = await actor(browser, info);
  const gate = deferred(), arrived = deferred();
  let hold = false, held = false, events = 0, writes = 0, snapshots = 0;
  try {
    await a.page.routeWebSocket('**/realtime/v1/websocket**', (ws) => {
      const server = ws.connectToServer(); ws.onMessage((m) => server.send(m));
      server.onMessage((m) => { if (packet(m).event === 'postgres_changes') events++; ws.send(m); });
    });
    await a.page.route('**/rest/v1/issues?**', async (route) => {
      const response = await route.fetch(); snapshots++;
      if (hold && !held) { held = true; arrived.resolve(); await gate.promise; }
      await route.fulfill({ response });
    });
    a.page.on('request', (request) => { if (request.url().includes('/rpc/create_issue')) writes++; });
    await login(a.page, workspaceId); await login(b.page, workspaceId, 'member'); await healthy(a.page); await healthy(b.page);
    await status(a.page).evaluate((element) => element.scrollIntoView({ block: 'start' }));
    await a.page.getByLabel('새 이슈 제목', { exact: true }).fill('연결이 끊겨도 남을 내 초안');
    await a.context.setOffline(true);
    await expect(status(a.page)).toHaveAttribute('data-connection-state', 'offline');
    await a.page.getByLabel('새 이슈 제목', { exact: true }).fill('오프라인에서 계속 작성한 초안');
    await expect(a.page.getByRole('button', { name: 'Inbox에 생성', exact: true })).toBeDisabled();
    await open(b.page, row); await saveTitle(b.page, 'B가 A 단절 중 저장한 제목');
    await expect(card(a.page, row)).toContainText(row.title);
    const before = snapshots; hold = true;
    await a.context.setOffline(false); await arrived.wait();
    await expect(status(a.page)).toHaveAttribute('data-connection-state', 'syncing');
    await expect(status(a.page)).toHaveAttribute('data-ws-state', 'connected');
    await expect(status(a.page)).not.toHaveAttribute('data-connection-state', 'normal');
    await saveTitle(b.page, 'B가 복구 조회 도중 다시 저장한 제목');
    await expect.poll(() => events).toBeGreaterThan(0); gate.resolve();
    await expect(card(a.page, row)).toContainText('B가 복구 조회 도중 다시 저장한 제목'); await healthy(a.page);
    expect(snapshots - before).toBeGreaterThanOrEqual(2);
    await expect(a.page.getByLabel('새 이슈 제목', { exact: true })).toHaveValue('오프라인에서 계속 작성한 초안');
    expect(writes).toBe(0); expect((await stored(row)).version).toBe(3);
    await a.page.getByRole('button', { name: 'Inbox에 생성', exact: true }).click();
    await expect(a.page.getByRole('heading', { name: '오프라인에서 계속 작성한 초안', exact: true })).toHaveCount(1);
    expect(writes).toBe(1);
  } finally { gate.resolve(); await Promise.all([a.context.close(), b.context.close()]); }
  await info.attach('d8-offline-recovery', { path: await a.video.path(), contentType: 'video/webm' });
});

test('D8 WS-only failure permits HTTP writes and fallback polling; HTTP-only lost response keeps the same request', async ({ browser }, info) => {
  test.setTimeout(120_000);
  const { workspaceId, row } = await fixture(), a = await actor(browser, info, true), b = await actor(browser, info);
  let blocked = false, drop = () => {}, httpBlocked = false, loseResponse = true, pollReads = 0;
  const sent = [];
  try {
    await a.page.routeWebSocket('**/realtime/v1/websocket**', (ws) => {
      if (blocked) { ws.close({ code: 1011, reason: 'synthetic WS outage' }); return; }
      const server = ws.connectToServer(); ws.onMessage((m) => server.send(m)); server.onMessage((m) => ws.send(m));
      drop = () => { ws.close({ code: 1011, reason: 'synthetic WS outage' }); server.close(); };
    });
    await a.page.route('**/rest/v1/issues?**', async (route) => {
      if (httpBlocked) return route.abort('failed');
      if (blocked) pollReads++;
      await route.continue();
    });
    await login(a.page, workspaceId); await login(b.page, workspaceId, 'member'); await healthy(a.page); await healthy(b.page);
    await status(a.page).evaluate((element) => element.scrollIntoView({ block: 'start' }));
    blocked = true; drop();
    await expect(status(a.page)).toHaveAttribute('data-connection-state', 'degraded');
    await a.page.getByLabel('새 이슈 제목', { exact: true }).fill('WS가 끊겨도 HTTP로 저장');
    await a.page.getByRole('button', { name: 'Inbox에 생성', exact: true }).click();
    await expect(a.page.getByRole('heading', { name: 'WS가 끊겨도 HTTP로 저장', exact: true })).toHaveCount(1);
    await expect(status(a.page)).toHaveAttribute('data-ws-state', 'error');
    await open(b.page, row); await saveTitle(b.page, '실시간 단절 중 B 변경 · 임시 조회로 복구');
    const before = pollReads;
    await expect(card(a.page, row)).toContainText('실시간 단절 중 B 변경 · 임시 조회로 복구', { timeout: 22_000 });
    expect(pollReads).toBeGreaterThan(before);
    blocked = false; await healthy(a.page);
    await a.page.route('**/rpc/update_issue', async (route) => {
      sent.push(route.request().postDataJSON()); const response = await route.fetch();
      expect((await response.json()).ok).toBe(true);
      if (loseResponse) { loseResponse = false; httpBlocked = true; await route.abort('failed'); }
      else await route.fulfill({ response });
    });
    await open(a.page, row);
    await detail(a.page).getByLabel('이슈 제목', { exact: true }).fill('DB commit 후 HTTP 응답만 유실');
    await detail(a.page).getByRole('button', { name: '변경 저장', exact: true }).click();
    await expect(detail(a.page).getByRole('button', { name: '같은 요청으로 다시 확인', exact: true })).toBeVisible();
    await expect(status(a.page)).toHaveAttribute('data-connection-state', 'http-error');
    await expect(status(a.page)).toHaveAttribute('data-ws-state', 'connected');
    expect(await a.page.evaluate(() => navigator.onLine)).toBe(true);
    await expect(detail(a.page).getByLabel('이슈 제목', { exact: true })).toHaveValue('DB commit 후 HTTP 응답만 유실');
    await detail(a.page).getByRole('button', { name: '상세 닫기', exact: true }).click();
    await expect(detail(a.page)).toHaveCount(0);
    await status(a.page).evaluate((element) => element.scrollIntoView({ block: 'start' }));
    httpBlocked = false;
    await a.page.getByRole('button', { name: '연결 상태 다시 확인', exact: true }).click(); await healthy(a.page);
    expect(sent).toHaveLength(1); // Recovery never resends mutations.
    await card(a.page, row).getByRole('button', { name: '같은 요청으로 결과 확인', exact: true }).click();
    await expect(card(a.page, row)).not.toContainText('결과 확인 중');
    expect(sent).toHaveLength(2); expect(sent[0]).toEqual(sent[1]);
    expect((await stored(row)).version).toBe(3);
    const counts = await db.query(`select (select count(*)::int from public.activity_events where issue_id=$1 and request_id=$2) as activities,
      (select count(*)::int from private.command_receipts where workspace_id=$3 and request_id=$2) as receipts`, [row.id, sent[0].p_request_id, workspaceId]);
    expect(counts.rows[0]).toEqual({ activities: 1, receipts: 1 });
  } finally { blocked = false; httpBlocked = false; await Promise.all([a.context.close(), b.context.close()]); }
  await info.attach('d8-partial-failures', { path: await a.video.path(), contentType: 'video/webm' });
});

test('D8 live role downgrade rejects an in-flight command, preserves draft and disables forbidden actions', async ({ browser }, info) => {
  const { workspaceId, row } = await fixture(), a = await actor(browser, info), b = await actor(browser, info);
  const gate = deferred(), arrived = deferred(); let result;
  try {
    await login(a.page, workspaceId, 'member'); await login(b.page, workspaceId); await healthy(a.page); await healthy(b.page);
    await open(a.page, row);
    await a.page.route('**/rpc/update_issue', async (route) => {
      arrived.resolve(); await gate.promise; const response = await route.fetch(); result = await response.json(); await route.fulfill({ response });
    });
    await detail(a.page).getByLabel('이슈 제목', { exact: true }).fill('권한 강등 뒤에도 남을 초안');
    await detail(a.page).getByRole('button', { name: '변경 저장', exact: true }).click(); await arrived.wait();
    await b.page.getByText('팀 멤버와 권한', { exact: true }).click();
    await b.page.getByRole('button', { name: '합성 Member → Viewer', exact: true }).click();
    await expect(b.page.getByRole('button', { name: '합성 Member → Member', exact: true })).toBeVisible();
    gate.resolve(); await expect.poll(() => result?.code).toBe('FORBIDDEN');
    await expect(a.page.getByText('역할: viewer', { exact: true })).toBeVisible();
    await expect(detail(a.page).getByLabel('이슈 제목', { exact: true })).toHaveValue('권한 강등 뒤에도 남을 초안');
    await expect(detail(a.page).getByLabel('이슈 제목', { exact: true })).toHaveAttribute('readonly', '');
    await expect(detail(a.page).getByRole('button', { name: '변경 저장', exact: true })).toBeDisabled();
    await expect(detail(a.page).getByRole('button', { name: 'Ready로 이동', exact: true })).toBeDisabled();
    expect((await stored(row)).version).toBe(1);
    // No membership-removal product feature: fixture-only revocation exercises actual RLS and cache eviction.
    await db.query('delete from public.workspace_members where workspace_id=$1 and user_id=$2', [workspaceId, accounts.find((u) => u.role === 'member').id]);
    await detail(a.page).getByRole('button', { name: '최신 상세 조회', exact: true }).click();
    await expect(a.page.getByText('팀 권한을 확인할 수 없습니다.', { exact: false })).toBeVisible();
    await expect(card(a.page, row)).toHaveCount(0); await expect(detail(a.page)).toHaveCount(0);
  } finally { gate.resolve(); await Promise.all([a.context.close(), b.context.close()]); }
});

test('D8 workspace switching and logout remove old subscriptions, polling and cached rows', async ({ browser }, info) => {
  test.setTimeout(90_000);
  const first = await fixture(), second = await fixture(), a = await actor(browser, info);
  const topics = new Set(); let oldReads = 0, countReads = false;
  try {
    await a.page.clock.install();
    await a.page.routeWebSocket('**/realtime/v1/websocket**', (ws) => {
      const server = ws.connectToServer();
      ws.onMessage((m) => { const p = packet(m); if (p.event === 'phx_join') topics.add(p.topic); if (p.event === 'phx_leave') topics.delete(p.topic); server.send(m); });
      server.onMessage((m) => ws.send(m));
    });
    a.page.on('request', (request) => { if (countReads && request.url().includes('/rest/v1/') && request.url().includes(first.workspaceId)) oldReads++; });
    await login(a.page, first.workspaceId); await healthy(a.page);
    for (const workspace of [second.workspaceId, first.workspaceId, second.workspaceId]) {
      await a.page.getByLabel('워크스페이스', { exact: true }).selectOption(workspace); await healthy(a.page);
      await expect.poll(() => topics.size).toBe(1);
    }
    countReads = true;
    // Advance beyond the 15s polling period: exercise stale timers without wall-clock sleep.
    await a.page.clock.runFor(16_000); expect(oldReads).toBe(0);
    await expect(card(a.page, first.row)).toHaveCount(0);
    // Returning to a removed query cannot flash its old authorized rows before a fresh read.
    const gate = deferred(), arrived = deferred();
    await a.page.route('**/rest/v1/issues?**', async (route) => {
      if (route.request().url().includes(first.workspaceId)) { arrived.resolve(); await gate.promise; }
      await route.continue();
    });
    await a.page.getByLabel('워크스페이스', { exact: true }).selectOption(first.workspaceId); await arrived.wait();
    await expect(card(a.page, first.row)).toHaveCount(0); gate.resolve(); await healthy(a.page);
    await a.page.getByRole('button', { name: '로그아웃', exact: true }).click();
    await expect(a.page).toHaveURL(/login\?reason=signed-out/);
    await expect.poll(() => topics.size).toBe(0);
    oldReads = 0; await a.page.clock.runFor(16_000); expect(oldReads).toBe(0);
    await a.page.goBack(); await expect(card(a.page, first.row)).toHaveCount(0);
  } finally { await a.context.close(); }
});

test('D8 actual revoked refresh session expires an open board and clears its private UI', async ({ browser }, info) => {
  test.setTimeout(60_000);
  const { workspaceId, row } = await fixture(), a = await actor(browser, info);
  try {
    await login(a.page, workspaceId); await healthy(a.page);
    await a.page.getByLabel('새 이슈 제목', { exact: true }).fill('로그인 종료 때 메모리에서 제거할 합성 초안');
    const cookies = (await a.context.cookies()).filter((c) => /^sb-.+-auth-token(?:\.\d+)?$/.test(c.name)).sort((x, y) => x.name.localeCompare(y.name));
    const session = JSON.parse(Buffer.from(cookies.map((c) => c.value).join('').slice('base64-'.length), 'base64url').toString('utf8'));
    const claims = JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url').toString('utf8'));
    await db.query('delete from auth.sessions where id=$1 and user_id=$2', [claims.session_id, accounts.find((u) => u.role === 'owner').id]);
    // Advance only the browser clock to trigger renewal. Auth/refresh rejects the real revoked session.
    await a.page.clock.install();
    await a.page.clock.fastForward(Math.max(0, session.expires_at * 1000 - Date.now()) + 90_000);
    await expect(a.page).toHaveURL(/login\?reason=session-expired/, { timeout: 20_000 });
    await expect(a.page.getByText('세션이 만료되었거나 종료됐습니다. 다시 로그인하세요.', { exact: true })).toBeVisible();
    await expect(card(a.page, row)).toHaveCount(0);
    await expect(a.page.getByLabel('새 이슈 제목', { exact: true })).toHaveCount(0);
  } finally { await a.context.close(); }
});
