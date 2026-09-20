/* global document, window */
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { localDb, localStack, readAccounts } from '../../scripts/local-stack.mjs';

const team = 'a1000000-0000-4000-8000-000000000001';
let db, owner;
const created = new Set();
const accounts = readAccounts();
test.beforeAll(async () => {
  const status = localStack();
  db = await localDb(status);
  const account = accounts.find((item) => item.role === 'owner');
  owner = createClient(status.API_URL, status.PUBLISHABLE_KEY || status.ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } });
  const result = await owner.auth.signInWithPassword({ email: account.email, password: account.password });
  expect(result.error).toBeNull();
});
test.afterAll(async () => {
  if (!db) return;
  await db.query('begin');
  try {
    await db.query('delete from public.activity_events where issue_id=any($1::uuid[])', [[...created]]);
    await db.query("delete from private.command_receipts where result->'data'->>'id'=any($1::text[])", [[...created]]);
    await db.query('delete from public.issues where id=any($1::uuid[])', [[...created]]);
    await db.query('commit');
  } catch (error) { await db.query('rollback'); throw error; }
  finally { await db.end(); }
});
async function login(page, role) {
  await page.goto('/login');
  await page.getByLabel('개발 계정', { exact: true }).selectOption(role);
  await page.getByRole('button', { name: '개발 계정으로 로그인', exact: true }).click();
  await expect(page.getByText('로그인됨 ·', { exact: false })).toBeVisible();
  await expect(page.getByText(`역할: ${role === 'outsider' ? 'owner' : role}`, { exact: true })).toBeVisible();
}
async function fixture(title) {
  const result = await owner.rpc('create_issue', { p_workspace_id: team, p_request_id: randomUUID(), p_payload: { title } });
  expect(result.error).toBeNull();
  expect(result.data.ok).toBe(true);
  created.add(result.data.data.id);
  return result.data.data;
}
function card(page, title) { return page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: title, exact: true }) }); }

test('real session creates, reads, edits and preserves the title after reload', async ({ page }, info) => {
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  await login(page, 'owner');
  const title = `브라우저 합성 ${randomUUID()}`;
  await page.getByLabel('새 이슈 제목', { exact: true }).fill(title);
  await page.getByRole('button', { name: 'Inbox에 생성', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  const row = (await db.query('select * from public.issues where workspace_id=$1 and title=$2', [team, title])).rows[0];
  created.add(row.id);
  expect(row.version).toBe(1);
  expect(row.created_by).toBe(accounts.find((account) => account.role === 'owner').id);
  const finalTitle = `${title} 수정`;
  await card(page, title).getByRole('button').click();
  const original = page.getByRole('dialog');
  await original.getByLabel('이슈 제목', { exact: true }).fill(finalTitle);
  await original.getByRole('button', { name: '변경 저장', exact: true }).click();
  await expect(original.getByRole('heading', { name: finalTitle, exact: true })).toBeVisible();
  await page.reload();
  await expect(original.getByRole('heading', { name: finalTitle, exact: true })).toBeVisible();
  await expect(page.getByRole('dialog').getByLabel('이슈 제목', { exact: true })).toHaveValue(finalTitle);
  const stored = (await db.query('select title, version from public.issues where id=$1', [row.id])).rows[0];
  expect(stored).toEqual({ title: finalTitle, version: 2 });
  expect(Number((await db.query('select count(*) from public.activity_events where issue_id=$1', [row.id])).rows[0].count)).toBe(2);
  await info.attach('d4-saved-title', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(runtimeErrors).toEqual([]);
});

test('Viewer reads without edit controls; logout and another team login clear visible data', async ({ page }) => {
  const row = await fixture(`Viewer 확인 ${randomUUID()}`);
  await login(page, 'viewer');
  await expect(page.getByRole('heading', { name: row.title, exact: true })).toBeVisible();
  await expect(page.getByText('Viewer는 조회만 할 수 있습니다.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('새 이슈 제목', { exact: true })).toHaveCount(0);
  await expect(card(page, row.title).getByRole('textbox')).toHaveCount(0);
  await card(page, row.title).getByRole('button').click();
  await expect(page.getByRole('dialog').getByText('Viewer는 조회만 할 수 있습니다.', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('textbox')).toHaveCount(0);
  await page.getByRole('button', { name: '상세 닫기', exact: true }).click();
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await expect(page.getByRole('heading', { name: row.title, exact: true })).toHaveCount(0);
  await login(page, 'outsider');
  await expect(page.getByRole('heading', { name: row.title, exact: true })).toHaveCount(0);
  await page.goto(`/board?workspace=${team}`);
  await expect(page.getByText('접근할 수 있는 팀이 없습니다.', { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: row.title, exact: true })).toHaveCount(0);
});

test('two independent users keep a stale draft on conflict and explicitly reload before another edit', async ({ page, browser }, info) => {
  const row = await fixture(`충돌 원본 ${randomUUID()}`);
  const otherContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3000' });
  const otherPage = await otherContext.newPage();
  try {
    await login(page, 'owner');
    await login(otherPage, 'member');
    await card(page, row.title).getByRole('button').click();
    await card(otherPage, row.title).getByRole('button').click();
    const own = page.getByRole('dialog');
    const other = otherPage.getByRole('dialog');
    await other.getByLabel('이슈 제목', { exact: true }).fill('Member가 작성 중인 초안');
    await other.getByLabel('재현 단계', { exact: true }).fill('아직 저장하지 않은 여러 줄\n로컬 입력');
    await own.getByLabel('이슈 제목', { exact: true }).fill('Owner가 먼저 저장');
    await own.getByRole('button', { name: '변경 저장', exact: true }).click();
    await expect(own.getByRole('heading', { name: 'Owner가 먼저 저장', exact: true })).toBeVisible();
    await other.getByRole('button', { name: '변경 저장', exact: true }).click();
    const conflicted = otherPage.getByRole('dialog');
    await expect(conflicted.getByLabel('이슈 제목', { exact: true })).toHaveValue('Member가 작성 중인 초안');
    await expect(conflicted.getByLabel('재현 단계', { exact: true })).toHaveValue('아직 저장하지 않은 여러 줄\n로컬 입력');
    await expect(conflicted.getByText('다른 변경이 있습니다. 작성 중인 입력은 유지했습니다.', { exact: true })).toBeVisible();
    expect((await db.query('select version from public.issues where id=$1', [row.id])).rows[0].version).toBe(2);
    await info.attach('d4-stale-fields', { body: await otherPage.screenshot({ fullPage: true }), contentType: 'image/png' });
    await conflicted.getByRole('button', { name: '최신 값으로 다시 편집', exact: true }).click();
    await conflicted.getByLabel('이슈 제목', { exact: true }).fill('Member가 확인하고 다시 저장');
    await conflicted.getByRole('button', { name: '변경 저장', exact: true }).click();
    await expect(conflicted.getByRole('heading', { name: 'Member가 확인하고 다시 저장', exact: true })).toBeVisible();
    const result = (await db.query('select version, updated_by from public.issues where id=$1', [row.id])).rows[0];
    expect(result.version).toBe(3);
    expect(result.updated_by).toBe(accounts.find((account) => account.role === 'member').id);
  } finally { await otherContext.close(); }
});
