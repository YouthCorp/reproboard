import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
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
    for (const table of ['public.notifications', 'public.comments', 'public.activity_events', 'private.command_receipts', 'public.issues', 'public.workspace_members']) await db.query(`delete from ${table} where workspace_id=any($1::uuid[])`, [[...teams]]);
    await db.query('delete from public.workspaces where id=any($1::uuid[])', [[...teams]]); await db.query('commit');
  } catch (error) { await db.query('rollback'); throw error; } finally { await db.end(); }
});
async function fixture() {
  const workspaceId = randomUUID(); teams.add(workspaceId);
  const team = await owner.rpc('create_workspace', { p_workspace_id: workspaceId, p_request_id: randomUUID(), p_payload: { name: '합성 D9 댓글·멘션 팀' } });
  expect(team.data.ok).toBe(true);
  for (const role of ['member', 'viewer']) await db.query('insert into public.workspace_members(workspace_id,user_id,role) values($1,$2,$3)', [workspaceId, accounts.find((a) => a.role === role).id, role]);
  const issue = await owner.rpc('create_issue', { p_workspace_id: workspaceId, p_request_id: randomUUID(), p_payload: { title: '합성 D9 댓글로 재현 정보 공유' } });
  expect(issue.data.ok).toBe(true); return { workspaceId, row: issue.data.data };
}
async function login(page, workspace, role = 'owner') {
  await page.goto(`/login?next=${encodeURIComponent(`/board?workspace=${workspace}`)}`);
  await page.getByLabel('개발 계정', { exact: true }).selectOption(role);
  await page.getByRole('button', { name: '개발 계정으로 로그인', exact: true }).click();
  if (role !== 'outsider') await expect(page.getByText(`역할: ${role}`, { exact: true })).toBeVisible();
  else await expect(page.getByText('접근할 수 있는 팀이 없습니다. 팀 주소와 로그인 계정을 확인하세요.')).toBeVisible();
}
async function open(page, row) { await page.locator(`[data-issue-id="${row.id}"] .issue-card-link`).click(); await expect(page.getByRole('region', { name: '댓글과 활동' })).toBeVisible(); }
const comments = (page) => page.getByRole('region', { name: '댓글과 활동' });
const healthy = (page) => expect(page.locator('[data-connection-state]')).toHaveAttribute('data-connection-state', 'normal', { timeout: 25_000 });
async function actor(browser) { const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } }); return { context, page: await context.newPage() }; }
async function submit(page, body, mentions = []) {
  await page.getByLabel('댓글 내용', { exact: true }).fill(body);
  for (const label of mentions) await comments(page).getByRole('checkbox', { name: label, exact: true }).check();
  await comments(page).getByRole('button', { name: '댓글 등록', exact: true }).click();
  await expect(comments(page).getByText('댓글을 저장했습니다.', { exact: true })).toBeVisible();
}

test('D9 two browser users: literal text, realtime comment/activity, dedup frames, recipient notification/read and drafts', async ({ browser }) => {
  test.setTimeout(90_000);
  const { workspaceId, row } = await fixture(), a = await actor(browser), b = await actor(browser);
  let events = 0;
  try {
    await b.page.routeWebSocket('**/realtime/v1/websocket**', (ws) => {
      const server = ws.connectToServer(); ws.onMessage((message) => server.send(message));
      server.onMessage((message) => {
        ws.send(message); const packet = JSON.parse(message.toString()), event = Array.isArray(packet) ? packet[3] : packet.event;
        if (event === 'postgres_changes') { events++; ws.send(message); }
      });
    });
    await login(a.page, workspaceId); await login(b.page, workspaceId, 'member'); await healthy(a.page); await healthy(b.page);
    await a.page.locator('.notifications summary').click();
    await expect(a.page.getByText('아직 알림이 없습니다.')).toBeVisible();
    await a.page.locator('.notifications summary').click();
    await open(a.page, row); await open(b.page, row);
    await expect(comments(a.page).getByText('아직 댓글이 없습니다.', { exact: true })).toBeVisible();
    await b.page.getByLabel('댓글 내용', { exact: true }).fill('원격 댓글이 와도 남아 있는 내 초안');
    await b.page.getByLabel('이슈 제목', { exact: true }).fill('댓글 도착 전부터 편집한 제목');
    const body = '<img src=x onerror=alert(1)> 합성 재현 결과: 모바일에서도 발생합니다.';
    await submit(a.page, body, ['합성 Owner', '합성 Member', '합성 Viewer']);
    await expect(comments(b.page).locator('.comment-body').filter({ hasText: body })).toHaveCount(1);
    await expect(comments(b.page).locator('img')).toHaveCount(0); await expect.poll(() => events).toBeGreaterThan(0);
    await expect(b.page.getByLabel('댓글 내용', { exact: true })).toHaveValue('원격 댓글이 와도 남아 있는 내 초안');
    await expect(b.page.getByLabel('이슈 제목', { exact: true })).toHaveValue('댓글 도착 전부터 편집한 제목');
    await comments(b.page).locator('.comment-activity summary').click();
    await expect(comments(b.page).locator('.comment-activity li').filter({ hasText: '댓글 등록' })).toHaveCount(1);
    await submit(b.page, '합성 Member: 같은 환경에서 확인했습니다.', ['합성 Owner']);
    await expect(comments(a.page).locator('.comment-body')).toHaveCount(2);
    mkdirSync('docs/evidence', { recursive: true });
    await comments(a.page).scrollIntoViewIfNeeded(); await a.page.screenshot({ path: 'docs/evidence/d9-comments.png' });
    await b.page.getByRole('button', { name: '상세 닫기', exact: true }).click();
    await b.page.locator('.notifications summary').click();
    await expect(b.page.locator('.notifications li')).toHaveCount(1);
    await expect(b.page.locator('.notifications summary')).toContainText('1건 안 읽음');
    await b.page.locator('.notifications').getByRole('button', { name: '읽음으로 표시', exact: true }).click();
    await expect(b.page.locator('.notifications summary')).toContainText('0건 안 읽음');
    await expect(b.page.locator('.notifications li')).toContainText('읽음');
    await b.page.locator('.notifications').scrollIntoViewIfNeeded(); await b.page.screenshot({ path: 'docs/evidence/d9-notifications.png' });
    await b.page.locator('.notification-link').click(); await expect(b.page.getByLabel('댓글 내용', { exact: true })).toBeVisible();
    expect((await db.query('select version from public.issues where id=$1', [row.id])).rows[0].version).toBe(1);
    await b.page.getByLabel('이슈 제목', { exact: true }).fill('댓글 이후 본문 수정도 충돌 없이 저장');
    await b.page.getByRole('button', { name: '변경 저장', exact: true }).click();
    await expect(b.page.locator('dialog .form-message')).toContainText('저장했습니다.');
    expect((await db.query('select version from public.issues where id=$1', [row.id])).rows[0].version).toBe(2);
  } finally { await Promise.all([a.context.close(), b.context.close()]); }
});

test('D9 Viewer reads and marks own mention, outsider cannot access, read failure retries and mobile overflow is absent', async ({ browser }) => {
  test.setTimeout(75_000);
  const { workspaceId, row } = await fixture(), viewer = await actor(browser), outsider = await actor(browser);
  try {
    const result = await owner.rpc('add_comment', { p_workspace_id: workspaceId, p_issue_id: row.id, p_request_id: randomUUID(), p_payload: { body: 'Viewer도 이 댓글을 읽고 본인 알림을 읽음 처리합니다.', mention_ids: [accounts.find((u) => u.role === 'viewer').id] } });
    expect(result.data.ok).toBe(true);
    let fail = true, failNotifications = true;
    await viewer.page.route('**/rest/v1/comments?**', (route) => fail ? route.fulfill({ status: 503, body: '{}' }) : route.continue());
    await viewer.page.route('**/rest/v1/activity_events?**', (route) => fail ? route.fulfill({ status: 503, body: '{}' }) : route.continue());
    await viewer.page.route('**/rest/v1/notifications?**', (route) => failNotifications ? route.fulfill({ status: 503, body: '{}' }) : route.continue());
    await login(viewer.page, workspaceId, 'viewer');
    await viewer.page.locator('.notifications summary').click();
    await expect(viewer.page.getByRole('button', { name: '알림 다시 조회' })).toBeVisible();
    failNotifications = false; await viewer.page.getByRole('button', { name: '알림 다시 조회' }).click();
    await expect(viewer.page.locator('.notifications li')).toHaveCount(1);
    await open(viewer.page, row);
    await expect(comments(viewer.page).getByRole('button', { name: '댓글 다시 조회' })).toBeVisible();
    await comments(viewer.page).locator('.comment-activity summary').click();
    await expect(comments(viewer.page).getByRole('button', { name: '활동 다시 조회' })).toBeVisible();
    await expect(comments(viewer.page).getByRole('button', { name: '댓글 등록', exact: true })).toHaveCount(0);
    fail = false; await comments(viewer.page).getByRole('button', { name: '댓글 다시 조회' }).click();
    await comments(viewer.page).getByRole('button', { name: '활동 다시 조회' }).click();
    await expect(comments(viewer.page).locator('.comment-body')).toHaveCount(1);
    await expect(comments(viewer.page).locator('.comment-activity li')).toHaveCount(2);
    await viewer.page.setViewportSize({ width: 390, height: 844 });
    expect(await viewer.page.locator('dialog.issue-detail').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await viewer.page.getByRole('button', { name: '상세 닫기', exact: true }).click();
    await viewer.page.getByRole('button', { name: '읽음으로 표시', exact: true }).click();
    await expect(viewer.page.locator('.notifications summary')).toContainText('0건 안 읽음');
    await login(outsider.page, workspaceId, 'outsider'); await expect(outsider.page.locator('.notifications')).toHaveCount(0);
  } finally { await Promise.all([viewer.context.close(), outsider.context.close()]); }
});

test('D9 commit then response loss: preserve draft, explicit same request replay; offline never queues; validation focuses textarea', async ({ browser }) => {
  test.setTimeout(75_000);
  const { workspaceId, row } = await fixture(), a = await actor(browser);
  const requests = []; let lose = true;
  try {
    await login(a.page, workspaceId); await healthy(a.page); await open(a.page, row);
    await a.page.getByLabel('댓글 내용', { exact: true }).fill('  ');
    await comments(a.page).getByRole('button', { name: '댓글 등록', exact: true }).click();
    await expect(a.page.getByLabel('댓글 내용', { exact: true })).toBeFocused();
    await expect(comments(a.page).getByRole('alert')).toContainText('1~4,000자');
    await a.page.route('**/rest/v1/rpc/add_comment', async (route) => {
      requests.push(route.request().postDataJSON());
      const response = await route.fetch();
      if (lose) { lose = false; await route.abort('failed'); } else await route.fulfill({ response });
    });
    await a.context.setOffline(true); await a.page.getByLabel('댓글 내용', { exact: true }).fill('오프라인에서 이어 쓴 댓글');
    await expect(comments(a.page).getByRole('button', { name: '댓글 등록', exact: true })).toBeDisabled();
    await a.context.setOffline(false); await healthy(a.page); expect(requests).toHaveLength(0);
    await comments(a.page).getByRole('checkbox', { name: '합성 Member', exact: true }).check();
    await comments(a.page).getByRole('button', { name: '댓글 등록', exact: true }).click();
    await expect(comments(a.page).getByRole('button', { name: '같은 댓글 요청 확인' })).toBeVisible();
    await expect(a.page.getByLabel('댓글 내용', { exact: true })).toHaveValue('오프라인에서 이어 쓴 댓글');
    await comments(a.page).getByRole('button', { name: '같은 댓글 요청 확인' }).click();
    await expect(comments(a.page).getByText('댓글을 저장했습니다.', { exact: true })).toBeVisible();
    expect(requests).toHaveLength(2); expect(requests[0]).toEqual(requests[1]);
    await expect(comments(a.page).locator('.comment-body')).toHaveCount(1);
    const counts = await db.query('select (select count(*)::int from public.comments where workspace_id=$1) comments, (select count(*)::int from public.notifications where workspace_id=$1) notifications, (select version from public.issues where id=$2) version', [workspaceId, row.id]);
    expect(counts.rows[0]).toEqual({ comments: 1, notifications: 1, version: 1 });
  } finally { await a.context.close(); }
});
