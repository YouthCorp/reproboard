/* global document, window */
import { expect, test } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { URL } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { localDb, localStack, readAccounts } from '../../scripts/local-stack.mjs';

const teams = new Set();
let db, accounts, ownerClient;
test.beforeAll(async () => {
  const status = localStack();
  accounts = readAccounts();
  db = await localDb(status);
  const owner = accounts.find((item) => item.role === 'owner');
  ownerClient = createClient(status.API_URL, status.PUBLISHABLE_KEY || status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const result = await ownerClient.auth.signInWithPassword({ email: owner.email, password: owner.password });
  expect(result.error).toBeNull();
});
test.afterAll(async () => {
  if (!db) return;
  await db.query('begin');
  try {
    const owned = await db.query('select id, name from public.workspaces where id=any($1::uuid[])', [[...teams]]);
    expect(owned.rows.every((row) => row.name.startsWith('합성 브라우저 팀 ') || row.name.startsWith('합성 D3 UI '))).toBe(true);
    for (const table of ['public.activity_events', 'private.workspace_invites', 'private.command_receipts', 'public.issues', 'public.workspace_members']) {
      await db.query(`delete from ${table} where workspace_id=any($1::uuid[])`, [[...teams]]);
    }
    await db.query('delete from public.workspaces where id=any($1::uuid[])', [[...teams]]);
    await db.query('commit');
  } catch (error) { await db.query('rollback'); throw error; }
  finally { await db.end(); }
});
async function login(page, role, path = '/login') {
  await page.goto(path);
  await page.getByLabel('개발 계정', { exact: true }).selectOption(role);
  await page.getByRole('button', { name: '개발 계정으로 로그인', exact: true }).click();
  await expect(page).toHaveURL(/\/(board|invite)(\?|$)/);
}
async function fixture() {
  const workspace = randomUUID(); teams.add(workspace);
  const created = await ownerClient.rpc('create_workspace', { p_workspace_id: workspace, p_request_id: randomUUID(), p_payload: { name: `합성 D3 UI ${workspace}` } });
  expect(created.error).toBeNull(); expect(created.data.ok).toBe(true);
  const raw = randomBytes(32).toString('hex');
  const invite = await ownerClient.rpc('create_invite', { p_workspace_id: workspace, p_request_id: randomUUID(), p_payload: { token: raw } });
  expect(invite.error).toBeNull(); expect(invite.data.ok).toBe(true);
  return { workspace, raw, inviteId: invite.data.data.inviteId };
}
async function sessionCookies(context) {
  return (await context.cookies()).filter((item) => /^sb-.+-auth-token(?:\.\d+)?$/.test(item.name)).sort((a, b) => a.name.localeCompare(b.name));
}
function decodeSession(cookies) {
  return JSON.parse(Buffer.from(cookies.map((item) => item.value).join('').slice('base64-'.length), 'base64url').toString('utf8'));
}
async function expireSessionCookie(context, cookies, session) {
  session.expires_at = Math.floor(Date.now() / 1000) - 60;
  const value = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url');
  await context.clearCookies();
  const base = cookies[0].name.replace(/\.\d+$/, '');
  const chunks = [];
  for (let offset = 0; offset < value.length; offset += 3000) chunks.push({ name: `${base}.${chunks.length}`, value: value.slice(offset, offset + 3000), url: 'http://127.0.0.1:3000', sameSite: 'Lax' });
  await context.addCookies(chunks);
}

test('create workspace, share a fragment invitation, join and switch Member/Viewer through actual sessions', async ({ page, browser }, info) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const name = `합성 브라우저 팀 ${randomUUID()}`;
  await login(page, 'owner');
  await page.getByText('새 워크스페이스 만들기', { exact: true }).click();
  await page.getByLabel('새 워크스페이스 이름', { exact: true }).fill(name);
  await page.getByRole('button', { name: '워크스페이스 생성', exact: true }).click();
  await expect(page.getByRole('combobox', { name: '워크스페이스', exact: true })).toContainText(name);
  const created = await db.query('select id from public.workspaces where name=$1', [name]);
  expect(created.rows).toHaveLength(1);
  const workspace = created.rows[0].id; teams.add(workspace);
  await expect(page).toHaveURL(new RegExp(`workspace=${workspace}`));
  await expect(page.locator('#workspace-select option:checked')).toHaveText(name);
  await expect(page.getByText('역할: owner', { exact: true })).toBeVisible();
  expect((await db.query('select owner_id from public.workspaces where id=$1', [workspace])).rows[0].owner_id).toBe(accounts.find((item) => item.role === 'owner').id);
  await page.getByText('팀 멤버와 권한', { exact: true }).click();
  await expect(page.getByRole('button', { name: '합성 Owner → Viewer', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Member 초대 링크 생성', exact: true }).click();
  const linkInput = page.getByLabel('초대 링크', { exact: true });
  await expect(linkInput).toHaveValue(/\/invite#[0-9a-f]{64}$/);
  const link = await linkInput.inputValue();
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:3000' });
  const memberPage = await context.newPage();
  const requestUrls = [];
  memberPage.on('request', (request) => requestUrls.push(request.url()));
  try {
    await memberPage.goto(link);
    await memberPage.getByRole('link', { name: '로그인하고 초대 계속하기', exact: true }).click();
    await memberPage.getByLabel('개발 계정', { exact: true }).selectOption('member');
    await memberPage.getByRole('button', { name: '개발 계정으로 로그인', exact: true }).click();
    await expect(memberPage).toHaveURL(/\/invite$/);
    await memberPage.getByRole('button', { name: '초대 수락하고 Member로 참여', exact: true }).click();
    await expect(memberPage).toHaveURL(new RegExp(`workspace=${workspace}`));
    await expect(memberPage.getByText('역할: member', { exact: true })).toBeVisible();
    await expect(memberPage.getByLabel('새 이슈 제목', { exact: true })).toBeVisible();
    expect(requestUrls.some((url) => url.includes(link.split('#')[1]))).toBe(false);
    await page.reload();
    await page.getByText('팀 멤버와 권한', { exact: true }).click();
    await page.getByRole('button', { name: '합성 Member → Viewer', exact: true }).click();
    await expect(page.getByRole('button', { name: '합성 Member → Member', exact: true })).toBeVisible();
    await memberPage.reload();
    await expect(memberPage.getByText('Viewer는 조회만 할 수 있습니다.', { exact: true })).toBeVisible();
    await memberPage.getByText('팀 멤버와 권한', { exact: true }).click();
    await expect(memberPage.getByRole('button', { name: 'Member 초대 링크 생성', exact: true })).toHaveCount(0);
    await expect(memberPage.getByLabel('새 이슈 제목', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: '합성 Member → Member', exact: true }).click();
    await memberPage.reload();
    await expect(memberPage.getByLabel('새 이슈 제목', { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    // Reload removed the raw link; this capture contains no invitation token.
    await info.attach('d3-team-roles', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('expired invitations show a recoverable rejection; a foreign team profile stays hidden', async ({ page }) => {
  const data = await fixture();
  await db.query("update private.workspace_invites set created_at=statement_timestamp()-interval '25 hours', expires_at=statement_timestamp()-interval '1 hour' where id=$1", [data.inviteId]);
  await login(page, 'viewer');
  await page.goto(`/invite#${data.raw}`);
  await page.getByRole('button', { name: '초대 수락하고 Member로 참여', exact: true }).click();
  await expect(page.getByText('만료되었거나 사용할 수 없는 초대입니다.', { exact: true })).toBeVisible();
  await page.goto('/board?workspace=b2000000-0000-4000-8000-000000000002');
  await expect(page.getByText('접근할 수 있는 팀이 없습니다.', { exact: false })).toBeVisible();
  await expect(page.getByText('다른 팀 Owner', { exact: true })).toHaveCount(0);
});

test('SSR refresh updates cookies; revoked refresh session leads to expiry guidance; logout clears cookies', async ({ page, context }) => {
  await login(page, 'owner');
  await expect(page.getByLabel('새 이슈 제목', { exact: true })).toBeVisible();
  const response = await page.reload();
  // Next dev rewrites page Cache-Control. Auth route no-store and production headers are checked separately.
  expect(response.headers()['cache-control']).toContain('no-cache');
  let cookies = await sessionCookies(context);
  expect(cookies.length).toBeGreaterThan(0);
  let session = decodeSession(cookies);
  // Stop the browser's automatic refresh before mutating the cookie for the server-only scenario.
  await page.close();
  await expireSessionCookie(context, cookies, session);
  const refreshed = await context.request.get('/board', { maxRedirects: 0 });
  expect(refreshed.status()).toBe(200);
  expect(!!refreshed.headers()['set-cookie']).toBe(true);
  cookies = await sessionCookies(context);
  session = decodeSession(cookies);
  expect(session.expires_at > Date.now() / 1000).toBe(true);
  const claims = JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url').toString('utf8'));
  // Revoke only this test browser's session, then force its next server-side refresh.
  await db.query('delete from auth.sessions where id=$1 and user_id=$2', [claims.session_id, accounts.find((item) => item.role === 'owner').id]);
  await expireSessionCookie(context, cookies, session);
  page = await context.newPage();
  await page.goto('/board');
  await expect(page).toHaveURL(/\/login\?reason=session-expired/);
  await expect(page.getByText('세션이 만료되었거나 종료됐습니다. 다시 로그인하세요.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('새 이슈 제목', { exact: true })).toHaveCount(0);
  await login(page, 'owner');
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await expect(page.getByText('로그아웃했습니다.', { exact: true })).toBeVisible();
  expect((await context.cookies()).filter((item) => /^sb-.+-auth-token(?:\.\d+)?$/.test(item.name)).length).toBe(0);
  await page.goto('/board');
  await expect(page.getByText(/아래는 실제 조회 결과가 아닙니다/)).toBeVisible();
});

test('OAuth callback errors are sanitized, safe return state survives, and external redirects are refused', async ({ request }) => {
  const result = await request.get('/auth/callback?error=access_denied&error_description=DO_NOT_REFLECT&next=https://evil.invalid', {
    maxRedirects: 0, headers: { Cookie: 'reproboard-auth-next=%2Finvite' },
  });
  expect(result.status()).toBe(307);
  const target = new URL(result.headers().location);
  expect(target.origin).toBe('http://127.0.0.1:3000');
  expect(target.pathname).toBe('/login');
  expect(target.searchParams.get('next')).toBe('/invite');
  expect(target.search).not.toContain('DO_NOT_REFLECT');
  expect(result.headers()['cache-control']).toContain('no-store');
  const hostile = await request.get('/auth/callback', { maxRedirects: 0, headers: { Cookie: 'reproboard-auth-next=https%3A%2F%2Fevil.invalid' } });
  expect(new URL(hostile.headers().location).searchParams.get('next')).toBe('/board');
  const invalidCode = await request.get('/auth/callback?code=synthetic-invalid-code', { maxRedirects: 0 });
  expect(new URL(invalidCode.headers().location).searchParams.get('reason')).toBe('callback-error');
});
