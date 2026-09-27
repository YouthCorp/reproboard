/* global navigator */
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
  const result = await clients.owner.rpc('create_workspace', { p_workspace_id: id, p_request_id: randomUUID(), p_payload: { name: '합성 D7 실제 협업 검증 팀' } });
  expect(result.error).toBeNull(); expect(result.data.ok).toBe(true);
  await db.query("insert into public.workspace_members(workspace_id,user_id,role) values ($1,$2,'member'),($1,$3,'viewer')", [id, accounts.find((a) => a.role === 'member').id, accounts.find((a) => a.role === 'viewer').id]);
  return id;
}
async function issue(workspaceId, title, status = 'inbox') {
  const result = await clients.owner.rpc('create_issue', { p_workspace_id: workspaceId, p_request_id: randomUUID(), p_payload: { title, steps: '1. 목록 열기', expected: '목록 표시', actual: '빈 화면', environment: 'Windows Chromium', reproduction: 'reproduced', severity: 'S2', priority: 'P1', assignee_id: accounts.find((a) => a.role === 'member').id, fix_note: '초기 렌더링 수정', target_build: 'local-d7' } });
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
  await expect(page.getByText(`역할: ${{owner:'관리자',member:'멤버',viewer:'읽기 전용'}[role]}`, { exact: true })).toBeVisible();
}
const card = (page, row) => page.locator(`[data-issue-id="${row.id}"]`);
const column = (page, status) => page.locator(`section[data-status="${status}"]`);
const inColumn = (page, row, status) => column(page, status).locator(`[data-issue-id="${row.id}"]`);

const stored = async (row) => (await db.query('select * from public.issues where id=$1', [row.id])).rows[0];
function deferred() { let resolve, settled = false; const promise = new Promise((done) => { resolve = () => { settled = true; done(); }; }); return { promise, resolve, wait: () => expect.poll(() => settled, { timeout: 8000 }).toBe(true) }; }
const inputClocks = new WeakSet();
async function drag(page, row, status) {
  if (!inputClocks.has(page)) { await page.clock.install(); inputClocks.add(page); }
  const handle = card(page, row).locator('.drag-handle');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
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
  await page.clock.runFor(60); // dnd-kit's 50ms input cleanup, not a success wait.
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

const detail = (page) => page.locator('dialog.issue-detail');
const synced = (page) => expect(page.locator('[data-realtime-state]')).toHaveAttribute('data-realtime-state', 'subscribed', { timeout: 20_000 });
async function open(page, row) { await card(page, row).locator('.issue-card-link').click(); await expect(detail(page).getByLabel('버그 제목', { exact: true })).toBeVisible(); }
async function save(page) { await detail(page).getByRole('button', { name: '변경 저장', exact: true }).click(); }
function packet(message) {
  const data = JSON.parse(message.toString());
  return Array.isArray(data) ? { event: data[3], payload: data[4], topic: data[2] } : data;
}

test('D7 two browser users race different fields: one commit, one conflict, copy and explicit re-edit', async ({ browser }, info) => {
  test.setTimeout(90_000);
  const workspaceId = await team(), row = await issue(workspaceId, '합성 협업 · 같은 버전에서 편집');
  const owner = await videoContext(browser, info), member = await videoContext(browser, info);
  const participants = [owner, member], gate = deferred(), requests = [], responses = [], errors = [];
  try {
    for (const [index, actor] of participants.entries()) {
      await actor.context.grantPermissions(['clipboard-read', 'clipboard-write']);
      actor.page.on('pageerror', (error) => errors.push(error.message));
      await login(actor.page, workspaceId, index === 0 ? 'owner' : 'member'); await synced(actor.page); await open(actor.page, row);
      await actor.page.route('**/rpc/update_issue', async (route) => {
        const input = route.request().postDataJSON(); requests.push({ index, input }); await gate.promise;
        const response = await route.fetch(); responses.push({ index, result: await response.json() }); await route.fulfill({ response });
      });
    }
    await detail(owner.page).getByLabel('버그 제목', { exact: true }).fill('Owner가 고친 제목');
    await detail(member.page).getByLabel('환경', { exact: true }).fill('Member의 보존할 환경 초안');
    await Promise.all(participants.map((actor) => save(actor.page)));
    await expect.poll(() => requests.length).toBe(2);
    expect(requests.map((r) => r.input.p_expected_version)).toEqual([row.version, row.version]);
    gate.resolve(); await expect.poll(() => responses.length).toBe(2);
    expect(responses.filter((r) => r.result.ok)).toHaveLength(1);
    expect(responses.filter((r) => r.result.code === 'CONFLICT')).toHaveLength(1);
    const loserIndex = responses.find((r) => !r.result.ok).index;
    const loser = participants[loserIndex], winner = participants[1 - loserIndex];
    const current = await stored(row); expect(current.version).toBe(row.version + 1);
    const ids = requests.map((r) => r.input.p_request_id);
    expect((await db.query('select count(*)::int as n from public.activity_events where issue_id=$1 and request_id=any($2::uuid[])', [row.id, ids])).rows[0].n).toBe(1);
    expect((await db.query('select count(*)::int as n from private.command_receipts where workspace_id=$1 and request_id=any($2::uuid[])', [workspaceId, ids])).rows[0].n).toBe(1);
    await expect(detail(loser.page).locator('.form-message')).toContainText('다른 변경이 먼저 저장됐습니다.');
    await expect(detail(loser.page).getByRole('region', { name: '충돌 복구' })).toBeVisible();
    const localField = loserIndex === 0 ? '버그 제목' : '환경', localValue = loserIndex === 0 ? 'Owner가 고친 제목' : 'Member의 보존할 환경 초안';
    await expect(detail(loser.page).getByLabel(localField, { exact: true })).toHaveValue(localValue);
    await detail(loser.page).getByRole('button', { name: '최신 값 보기', exact: true }).scrollIntoViewIfNeeded();
    await detail(loser.page).getByRole('button', { name: '최신 값 보기', exact: true }).click();
    await expect(detail(loser.page).getByRole('table', { name: '최신 내용과 내 입력 비교' })).toContainText(localValue);
    await detail(loser.page).getByRole('button', { name: '내 입력 복사', exact: true }).click();
    await expect(detail(loser.page).getByText('내 입력을 복사했습니다.', { exact: true })).toBeVisible();
    expect(await loser.page.evaluate(() => navigator.clipboard.readText())).toContain(localValue);
    // Other user's result arrives via Postgres Changes, without manual list refresh.
    await expect(detail(winner.page).getByRole('heading', { level: 2 })).toHaveText(current.title);
    expect(requests).toHaveLength(2);
    await info.attach('d7-conflict', { body: await loser.page.screenshot(), contentType: 'image/png' });
    await detail(loser.page).getByRole('button', { name: '최신 값으로 다시 편집', exact: true }).click();
    await expect(detail(loser.page).getByLabel('버그 제목', { exact: true })).toBeFocused();
    expect(requests).toHaveLength(2);
    await detail(loser.page).getByLabel(localField, { exact: true }).fill(`${localValue} · 확인 후 수정`);
    await save(loser.page); await expect.poll(() => requests.length).toBe(3);
    await expect.poll(async () => (await stored(row)).version).toBe(row.version + 2);
    const last = requests[2].input; expect(last.p_expected_version).toBe(row.version + 1); expect(ids).not.toContain(last.p_request_id);
    const final = await stored(row);
    expect(final.title).toBe(loserIndex === 0 ? 'Owner가 고친 제목 · 확인 후 수정' : 'Owner가 고친 제목');
    expect(final.environment).toBe(loserIndex === 1 ? 'Member의 보존할 환경 초안 · 확인 후 수정' : 'Member의 보존할 환경 초안');
    await expect(detail(winner.page).getByRole('heading', { level: 2 })).toHaveText(final.title);
    await expect(detail(winner.page).getByRole('region', { name: '충돌 복구' })).toBeVisible();
    await detail(loser.page).getByRole('heading', { level: 2 }).scrollIntoViewIfNeeded();
    await detail(winner.page).getByRole('button', { name: '최신 값 보기', exact: true }).scrollIntoViewIfNeeded();
    await oneEffect(row, last.p_request_id); expect(errors).toEqual([]);
  } finally { gate.resolve(); await Promise.all(participants.map((actor) => actor.context.close())); }
  await info.attach('d7-owner', { path: await owner.video.path(), contentType: 'video/webm' });
  await info.attach('d7-member', { path: await member.video.path(), contentType: 'video/webm' });
});

test('D7 subscription handshake gap, an event during snapshot, and duplicate real frames converge without duplicate cards', async ({ browser }, info) => {
  test.setTimeout(90_000);
  const workspaceId = await team(), row = await issue(workspaceId, '구독 전 제목');
  const ca = await browser.newContext(), cb = await browser.newContext(), a = await ca.newPage(), b = await cb.newPage();
  const joinGate = deferred(), joinArrived = deferred(), snapshotGate = deferred(), snapshotArrived = deferred();
  let holdSnapshot = false, heldSnapshot = false, events = 0, gets = 0;
  try {
    await login(b, workspaceId, 'member'); await synced(b); await open(b, row);
    await a.routeWebSocket('**/realtime/v1/websocket**', (ws) => {
      const server = ws.connectToServer();
      ws.onMessage(async (message) => { if (packet(message).event === 'phx_join') { joinArrived.resolve(); await joinGate.promise; } server.send(message); });
      server.onMessage((message) => { ws.send(message); if (packet(message).event === 'postgres_changes') { events++; ws.send(message); } });
    });
    await a.route('**/rest/v1/issues?**', async (route) => {
      gets++; const response = await route.fetch();
      if (holdSnapshot && !heldSnapshot) { heldSnapshot = true; snapshotArrived.resolve(); await snapshotGate.promise; }
      await route.fulfill({ response });
    });
    await login(a, workspaceId); await joinArrived.wait();
    await expect(card(a, row)).toContainText('구독 전 제목');
    await detail(b).getByLabel('버그 제목', { exact: true }).fill('구독 공백 사이의 변경'); await save(b);
    await expect.poll(async () => (await stored(row)).version).toBe(2);
    holdSnapshot = true; joinGate.resolve(); await snapshotArrived.wait();
    await detail(b).getByLabel('버그 제목', { exact: true }).fill('구독 완료 조회 도중의 변경'); await save(b);
    await expect.poll(() => events).toBeGreaterThan(0); snapshotGate.resolve();
    await expect(card(a, row)).toContainText('구독 완료 조회 도중의 변경'); await synced(a);
    expect(gets).toBeGreaterThanOrEqual(3); await expect(card(a, row)).toHaveCount(1);
    await open(a, row); await expect(detail(a).getByLabel('버그 제목', { exact: true })).toHaveValue('구독 완료 조회 도중의 변경');
    await detail(a).getByRole('button', { name: '상세 닫기', exact: true }).click();
    await detail(b).getByRole('button', { name: '상세 닫기', exact: true }).click();
    await expect(detail(a)).toHaveCount(0); await expect(detail(b)).toHaveCount(0);
    await b.getByLabel('새 버그 제목', { exact: true }).fill('중복 INSERT 알림 카드');
    await expect(b.getByLabel('새 버그 제목', { exact: true })).toHaveValue('중복 INSERT 알림 카드');
    await b.getByRole('button', { name: '버그 등록', exact: true }).click();
    await expect(b.getByRole('heading', { name: '중복 INSERT 알림 카드', exact: true })).toHaveCount(1);
    await expect(a.getByRole('heading', { name: '중복 INSERT 알림 카드', exact: true })).toHaveCount(1);
    expect((await db.query('select count(*)::int as n from public.issues where workspace_id=$1', [workspaceId])).rows[0].n).toBe(2);
  } catch (error) {
    await info.attach('d7-gap-failure', { body: await b.screenshot(), contentType: 'image/png' });
    await info.attach('d7-gap-ui', { body: await b.locator('body').innerText(), contentType: 'text/plain' });
    throw error;
  } finally { joinGate.resolve(); snapshotGate.resolve(); await Promise.all([ca.close(), cb.close()]); }
});

test('D7 actual remote change supersedes pending A, B succeeds and late conflict/success cannot lower server state', async ({ browser }) => {
  test.setTimeout(90_000);
  const workspaceId = await team(), aRow = await issue(workspaceId, 'A · 다른 사용자와 경합'), bRow = await issue(workspaceId, 'B · 독립 작업');
  const ca = await browser.newContext({ viewport: { width: 1440, height: 1050 } }), cb = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  const a = await ca.newPage(), b = await cb.newPage(), gate = deferred(), arrived = deferred(), successGate = deferred(), successArrived = deferred();
  let reject = true;
  try {
    await login(a, workspaceId); await login(b, workspaceId, 'member'); await synced(a); await synced(b);
    await a.route('**/rpc/transition_issue', async (route) => {
      if (route.request().postDataJSON().p_issue_id === aRow.id && reject) { arrived.resolve(); await gate.promise; }
      const response = await route.fetch();
      if (route.request().postDataJSON().p_issue_id === aRow.id && !reject) { successArrived.resolve(); await successGate.promise; }
      await route.fulfill({ response });
    });
    await drag(a, aRow, 'ready'); await arrived.wait();
    await expect(inColumn(a, aRow, 'ready')).toContainText('저장 중');
    await drag(a, bRow, 'ready'); await expect(inColumn(b, bRow, 'ready')).toBeVisible();
    await open(b, aRow); await detail(b).getByLabel('버그 제목', { exact: true }).fill('Member의 최신 A 제목'); await save(b);
    await expect(inColumn(a, aRow, 'inbox')).toContainText('Member의 최신 A 제목');
    await expect(card(a, aRow)).toContainText('저장 중'); await expect(card(a, aRow).locator('.drag-handle')).toBeDisabled();
    gate.resolve(); await expect(card(a, aRow)).toContainText('다른 변경이 먼저 저장됐습니다.');
    await expect(inColumn(a, bRow, 'ready')).toBeVisible();
    reject = false;
    await drag(a, aRow, 'ready'); await successArrived.wait();
    // The successful response is held after commit. B sees it via the actual socket.
    await expect(detail(b).locator('.detail-toolbar')).toContainText('진행 대기');
    await detail(b).getByRole('button', { name: '최신 값으로 다시 편집', exact: true }).click();
    await detail(b).getByRole('button', { name: '수정 중으로 이동', exact: true }).click();
    await b.locator('dialog.transition-dialog').getByRole('button', { name: '이동 확인', exact: true }).click();
    await expect(inColumn(a, aRow, 'in_progress')).toContainText('저장 중');
    successGate.resolve(); await expect(card(a, aRow).locator('.drag-handle')).toBeEnabled();
    await expect(inColumn(a, aRow, 'in_progress')).toBeVisible();
    expect((await stored(aRow)).version).toBe(4); expect((await stored(bRow)).status).toBe('ready');
  } finally { gate.resolve(); successGate.resolve(); await Promise.all([ca.close(), cb.close()]); }
});
