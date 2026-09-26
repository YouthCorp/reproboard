import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { localDb, localStack, readAccounts } from '../../scripts/local-stack.mjs';

const accounts = readAccounts(), teams = new Set(), clients = {};
let db;
test.beforeAll(async () => {
  const stack = localStack(); db = await localDb(stack);
  for (const role of ['owner', 'member']) {
    const account = accounts.find((a) => a.role === role);
    clients[role] = createClient(stack.API_URL, stack.PUBLISHABLE_KEY || stack.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    expect((await clients[role].auth.signInWithPassword({ email: account.email, password: account.password })).error).toBeNull();
  }
});
test.afterAll(async () => {
  if (!db) return;
  await db.query('begin');
  try {
    for (const table of ['public.verification_runs', 'public.activity_events', 'private.workspace_invites', 'private.command_receipts', 'public.issues', 'public.workspace_members']) await db.query(`delete from ${table} where workspace_id=any($1::uuid[])`, [[...teams]]);
    await db.query('delete from public.workspaces where id=any($1::uuid[])', [[...teams]]); await db.query('commit');
  } catch (error) { await db.query('rollback'); throw error; } finally { await db.end(); }
});
async function team() {
  const id = randomUUID(); teams.add(id);
  const result = await clients.owner.rpc('create_workspace', { p_workspace_id: id, p_request_id: randomUUID(), p_payload: { name: '합성 D6 지연·복구 검증 팀' } });
  expect(result.error).toBeNull(); expect(result.data.ok).toBe(true);
  await db.query("insert into public.workspace_members(workspace_id,user_id,role) values ($1,$2,'member'),($1,$3,'viewer')", [id, accounts.find((a) => a.role === 'member').id, accounts.find((a) => a.role === 'viewer').id]);
  return id;
}
async function issue(workspaceId, title, status = 'inbox') {
  const result = await clients.owner.rpc('create_issue', { p_workspace_id: workspaceId, p_request_id: randomUUID(), p_payload: { title, steps: '1. 목록 열기', expected: '목록 표시', actual: '빈 화면', environment: 'Windows Chromium', reproduction: 'reproduced', severity: 'S2', priority: 'P1', assignee_id: accounts.find((a) => a.role === 'member').id, fix_note: '초기 렌더링 수정', target_build: 'local-d6' } });
  expect(result.error).toBeNull(); expect(result.data.ok).toBe(true); let row = result.data.data;
  for (const target of ['ready', 'in_progress', 'verify'].slice(0, ['inbox', 'ready', 'in_progress', 'verify'].indexOf(status))) row = await move(row, target);
  return row;
}
async function move(row, status, role = 'owner') {
  const result = await clients[role].rpc('transition_issue', { p_workspace_id: row.workspace_id, p_issue_id: row.id, p_expected_version: row.version, p_request_id: randomUUID(), p_payload: { target_status: status } });
  expect(result.error).toBeNull(); expect(result.data.ok).toBe(true); return result.data.data;
}
async function login(page, workspaceId, role = 'owner') {
  await page.goto(`/login?next=${encodeURIComponent(`/board?workspace=${workspaceId}`)}`);
  await page.getByLabel('개발 계정', { exact: true }).selectOption(role);
  await page.getByRole('button', { name: '개발 계정으로 로그인', exact: true }).click();
  await expect(page.getByText(`역할: ${role}`, { exact: true })).toBeVisible();
}
const card = (page, row) => page.locator(`[data-issue-id="${row.id}"]`);
const column = (page, status) => page.locator(`section[data-status="${status}"]`);
const inColumn = (page, row, status) => column(page, status).locator(`[data-issue-id="${row.id}"]`);
const modal = (page) => page.locator('dialog.transition-dialog');
const stored = async (row) => (await db.query('select * from public.issues where id=$1', [row.id])).rows[0];
function deferred() { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; }
const inputClocks = new WeakSet();
async function drag(page, row, status) {
  if (!inputClocks.has(page)) { await page.clock.install(); inputClocks.add(page); }
  const handle = card(page, row).locator('.drag-handle');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.locator('[data-realtime-state]')).toHaveAttribute('data-realtime-state', 'subscribed');
  // Keep the pointer away from the viewport edge's auto-scroll zone before measuring.
  await handle.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  await handle.scrollIntoViewIfNeeded();
  const source = await handle.boundingBox(), target = await column(page, status).boundingBox();
  expect(source).toBeTruthy(); expect(target).toBeTruthy();
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 + 12, source.y + source.height / 2, { steps: 3 });
  await page.mouse.move(target.x + target.width / 2, Math.max(30, target.y + 85), { steps: 16 });
  await page.mouse.up();
  await expect(page.locator('.drag-preview')).toHaveCount(0);
  // dnd-kit 6.3.1 removes document click suppression after 50ms. Advance that
  // real lifecycle timer; success still requires the existing DOM/RPC/SQL checks.
  await page.clock.runFor(60);
}
async function oneEffect(row, requestId) {
  const { rows } = await db.query(`select (select count(*)::int from public.activity_events where issue_id=$1 and request_id=$2) as activity,
    (select count(*)::int from private.command_receipts where workspace_id=$3 and request_id=$2) as receipts`, [row.id, requestId, row.workspace_id]);
  expect(rows[0]).toEqual({ activity: 1, receipts: 1 });
}
async function videoContext(browser, info) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, recordVideo: { dir: info.outputPath('video'), size: { width: 1440, height: 1050 } } });
  const page = await context.newPage();
  return { context, page, video: page.video() };
}

test('D6 delayed A rejects against the actual DB while B succeeds; only A overlay disappears', async ({ browser }, info) => {
  test.setTimeout(60_000);
  const workspaceId = await team(), a = await issue(workspaceId, 'A · 지연 중 다른 사용자가 수정'), b = await issue(workspaceId, 'B · 독립적으로 저장할 카드');
  const { context, page, video } = await videoContext(browser, info);
  const gate = deferred(), arrived = deferred(); const payloads = []; const pageErrors = []; let heldAt = 0;
  page.on('pageerror', (error) => pageErrors.push(error.message));
  try {
    await login(page, workspaceId);
    await page.route('**/rpc/transition_issue', async (route) => {
      const payload = route.request().postDataJSON(); payloads.push(payload);
      if (payload.p_issue_id === a.id) { heldAt = Date.now(); arrived.resolve(); await gate.promise; }
      const response = await route.fetch(); await route.fulfill({ response });
    });
    await drag(page, a, 'ready'); await arrived.promise;
    await expect(inColumn(page, a, 'ready').getByText('저장 중…', { exact: true })).toBeVisible();
    expect((await stored(a)).status).toBe('inbox');
    await expect(card(page, a).locator('.drag-handle')).toBeDisabled();
    await card(page, a).locator('.issue-card-link').click();
    await expect(page.getByLabel('이슈 제목', { exact: true })).toBeDisabled();
    await expect(page.locator('dialog.issue-detail .detail-toolbar')).toContainText('Ready');
    await page.getByRole('button', { name: '상세 닫기', exact: true }).click();
    await drag(page, b, 'ready');
    await expect(inColumn(page, b, 'ready').getByText(`${b.issue_key} 저장했습니다.`, { exact: true })).toBeVisible();
    const update = await clients.member.rpc('update_issue', { p_workspace_id: workspaceId, p_issue_id: a.id, p_expected_version: a.version, p_request_id: randomUUID(), p_payload: { title: 'A · 다른 사용자의 최신 제목 보존' } });
    expect(update.error).toBeNull(); expect(update.data.ok).toBe(true);
    // Deliberate latency injection, independent of waiting for any success response.
    await expect.poll(() => Date.now() - heldAt).toBeGreaterThanOrEqual(1000);
    gate.resolve();
    await expect(inColumn(page, a, 'inbox')).toBeVisible();
    await expect(card(page, a)).toContainText('다른 변경이 먼저 저장됐습니다.');
    await expect(card(page, a)).toContainText('다른 사용자의 최신 제목 보존');
    await expect(inColumn(page, b, 'ready')).toBeVisible();
    expect((await stored(b)).version).toBe(b.version + 1);
    expect(payloads.filter((p) => p.p_issue_id === a.id)).toHaveLength(1);
    const denied = payloads.find((p) => p.p_issue_id === a.id);
    expect((await db.query('select count(*)::int as n from private.command_receipts where workspace_id=$1 and request_id=$2', [workspaceId, denied.p_request_id])).rows[0].n).toBe(0);
    await oneEffect(b, payloads.find((p) => p.p_issue_id === b.id).p_request_id);
    expect(pageErrors).toEqual([]);
    await info.attach('isolated-failure', { body: await page.screenshot(), contentType: 'image/png' });
  } finally { gate.resolve(); await context.close(); }
  await info.attach('d6-request-isolation', { path: await video.path(), contentType: 'video/webm' });
});

test('D6 Verify drag waits for the form; committed verification response loss replays one request without duplicate effects', async ({ browser }, info) => {
  test.setTimeout(60_000);
  const workspaceId = await team(), row = await issue(workspaceId, '검증 저장 후 응답 유실 복구', 'verify');
  const { context, page, video } = await videoContext(browser, info); const payloads = [];
  try {
    await login(page, workspaceId);
    await drag(page, row, 'done'); await expect(modal(page)).toBeVisible();
    await expect(inColumn(page, row, 'verify')).toBeVisible();
    expect((await stored(row)).status).toBe('verify');
    await modal(page).getByRole('button', { name: '이동 취소', exact: true }).click();
    await expect(inColumn(page, row, 'verify')).toBeVisible();
    await page.route('**/rpc/transition_issue', async (route) => {
      payloads.push(route.request().postDataJSON());
      const response = await route.fetch(); expect((await response.json()).ok).toBe(true);
      // The real RPC has committed. Only its response is lost on the way to this browser.
      if (payloads.length === 1) { expect((await stored(row)).status).toBe('done'); await route.abort('connectionreset'); }
      else await route.fulfill({ response });
    });
    await drag(page, row, 'done');
    await modal(page).getByLabel('검증 환경', { exact: true }).fill('Windows Chromium · 실제 로컬 DB');
    await modal(page).getByRole('button', { name: '통과 기록 후 Done', exact: true }).click();
    await expect(modal(page)).toContainText('결과 확인 중');
    await expect(modal(page).getByLabel('검증 환경', { exact: true })).toHaveValue('Windows Chromium · 실제 로컬 DB');
    await modal(page).getByRole('button', { name: '보드에서 계속 작업', exact: true }).click();
    await expect(inColumn(page, row, 'done')).toContainText('결과 확인 중');
    await expect(card(page, row).locator('.drag-handle')).toBeDisabled();
    await card(page, row).getByRole('button', { name: '같은 요청으로 결과 확인', exact: true }).click();
    await expect(card(page, row)).toContainText(`${row.issue_key} 저장했습니다.`);
    expect(payloads).toHaveLength(2); expect(payloads[0]).toEqual(payloads[1]);
    expect((await stored(row)).version).toBe(row.version + 1);
    await oneEffect(row, payloads[0].p_request_id);
    expect((await db.query('select count(*)::int as n from public.verification_runs where issue_id=$1', [row.id])).rows[0].n).toBe(1);
    await card(page, row).locator('.issue-card-link').click();
    await expect(page.getByRole('region', { name: '검증과 상태 이력' })).toContainText('통과 · local-d6');
    await info.attach('recovered-verification', { body: await page.screenshot(), contentType: 'image/png' });
  } finally { await context.close(); }
  await info.attach('d6-receipt-recovery', { path: await video.path(), contentType: 'video/webm' });
});

test('D6 later success receipt cannot overwrite a newer GET; timeout remains uncertain and explicitly retries', async ({ page }) => {
  test.setTimeout(60_000); await page.setViewportSize({ width: 1440, height: 1050 });
  const workspaceId = await team(), a = await issue(workspaceId, '늦은 성공 응답'), b = await issue(workspaceId, '응답 시간 초과');
  const gate = deferred(), committed = deferred(), timeoutGate = deferred(); const payloads = [];
  await login(page, workspaceId);
  await page.route('**/rpc/transition_issue', async (route) => {
    const payload = route.request().postDataJSON(); payloads.push(payload);
    const response = await route.fetch(); const result = await response.json(); expect(result.ok).toBe(true);
    if (payload.p_issue_id === a.id) { committed.resolve(result.data); await gate.promise; }
    if (payload.p_issue_id === b.id && payloads.filter((p) => p.p_issue_id === b.id).length === 1) { await timeoutGate.promise; return; }
    await route.fulfill({ response });
  });
  try {
    await drag(page, a, 'ready'); const ready = await committed.promise;
    const newer = await move(ready, 'in_progress', 'member');
    await page.getByRole('button', { name: '최신 목록 조회', exact: true }).click();
    await expect(inColumn(page, a, 'in_progress')).toContainText('저장 중…');
    gate.resolve();
    await expect(inColumn(page, a, 'in_progress')).toContainText(`${a.issue_key} 저장했습니다.`);
    await expect(inColumn(page, a, 'ready')).toHaveCount(0);
    await card(page, a).locator('.issue-card-link').click();
    await expect(page.locator('dialog.issue-detail .detail-toolbar')).toContainText('In Progress');
    await page.getByRole('button', { name: '상세 닫기', exact: true }).click();
    expect((await stored(a)).version).toBe(newer.version);
    await drag(page, b, 'ready');
    await expect(card(page, b)).toContainText('결과 확인 중', { timeout: 15_000 });
    expect((await stored(b)).status).toBe('ready');
    await expect(card(page, b).locator('.drag-handle')).toBeDisabled();
    timeoutGate.resolve();
    await card(page, b).getByRole('button', { name: '같은 요청으로 결과 확인', exact: true }).click();
    await expect(card(page, b)).toContainText(`${b.issue_key} 저장했습니다.`);
    const sends = payloads.filter((p) => p.p_issue_id === b.id); expect(sends).toHaveLength(2); expect(sends[0]).toEqual(sends[1]);
    await oneEffect(b, sends[0].p_request_id);
    expect((await stored(b)).version).toBe(b.version + 1);
  } finally { gate.resolve(); timeoutGate.resolve(); }
});

test('D6 same-column and forbidden drops send nothing; keyboard menu stays available and Viewer has no drag handles', async ({ page, browser }) => {
  await page.setViewportSize({ width: 1440, height: 1050 });
  const workspaceId = await team(), row = await issue(workspaceId, '키보드 메뉴 대안'); let sends = 0;
  await login(page, workspaceId);
  page.on('request', (request) => { if (request.url().endsWith('/rpc/transition_issue')) sends++; });
  await drag(page, row, 'inbox'); await drag(page, row, 'done');
  await expect(page.locator('.board-move-message')).toContainText('허용되지 않은 상태 이동');
  expect(sends).toBe(0); expect((await stored(row)).status).toBe('inbox');
  const open = card(page, row).locator('.issue-card-link'); await open.focus(); await page.keyboard.press('Enter');
  const ready = page.getByRole('button', { name: 'Ready로 이동', exact: true }); await ready.focus(); await page.keyboard.press('Enter');
  const confirm = modal(page).getByRole('button', { name: '이동 확인', exact: true }); await confirm.focus(); await page.keyboard.press('Enter');
  await expect(modal(page)).toHaveCount(0); expect((await stored(row)).status).toBe('ready'); expect(sends).toBe(1);
  const viewer = await browser.newContext(); const other = await viewer.newPage();
  try { await login(other, workspaceId, 'viewer'); await expect(card(other, row)).toBeVisible(); await expect(other.locator('.drag-handle')).toHaveCount(0); }
  finally { await viewer.close(); }
});
