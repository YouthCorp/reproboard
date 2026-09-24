import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { localDb, localStack, readAccounts } from '../../scripts/local-stack.mjs';

export async function createUxFixture(count = 100) {
  const stack = localStack(), account = readAccounts().find((user) => user.role === 'owner');
  const client = createClient(stack.API_URL, stack.PUBLISHABLE_KEY || stack.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const login = await client.auth.signInWithPassword({ email: account.email, password: account.password });
  if (login.error) throw new Error('Synthetic Owner login failed');
  const workspaceId = randomUUID(), name = `합성 D11 UX ${workspaceId}`;
  async function rpc(operation, args) {
    const result = await client.rpc(operation, { ...args, p_request_id: randomUUID() });
    if (result.error || !result.data.ok) throw new Error(`UX fixture ${operation} failed`);
    return result.data.data;
  }
  await rpc('create_workspace', { p_workspace_id: workspaceId, p_payload: { name } });
  const rows = [];
  for (let index = 0; index < count; index++) {
    let row = await rpc('create_issue', { p_workspace_id: workspaceId, p_payload: {
      title: Array.from(`합성 ${index + 1} 로그인 화면에서 긴 한글 제목을 읽고 상태를 확인합니다 ` + '띄어쓰기없는한글제목'.repeat(12)).slice(0, 120).join(''),
      steps: '1. 합성 앱을 엽니다.\n2. 로그인 버튼을 누릅니다.', expected: '대시보드가 표시됩니다.', actual: '로딩 안내가 남습니다.', environment: 'Windows / Chromium / 로컬 합성 환경',
      reproduction: 'reproduced', severity: 'S2', priority: index % 2 ? 'P1' : 'P2', assignee_id: account.id,
      fix_note: '합성 수정: 로딩 상태를 해제했습니다.', target_build: 'local-d11',
    } });
    for (const status of ['ready', 'in_progress', 'verify'].slice(0, index % 4)) row = await rpc('transition_issue', { p_workspace_id: workspaceId, p_issue_id: row.id, p_expected_version: row.version, p_payload: { target_status: status } });
    rows.push(row);
  }
  await client.auth.signOut();
  return { workspaceId, name, rows };
}

export async function cleanupUxFixture(fixture) {
  const db = await localDb(localStack());
  try {
    await db.query('begin');
    const result = await db.query('select name from public.workspaces where id=$1 for update', [fixture.workspaceId]);
    if (result.rows.length !== 1 || result.rows[0].name !== `합성 D11 UX ${fixture.workspaceId}` || result.rows[0].name !== fixture.name) throw new Error('UX fixture identity mismatch');
    for (const table of ['public.notifications', 'public.comments', 'public.verification_runs', 'public.activity_events', 'private.workspace_invites', 'private.command_receipts', 'public.issues', 'public.workspace_members']) await db.query(`delete from ${table} where workspace_id=$1`, [fixture.workspaceId]);
    await db.query('delete from public.workspaces where id=$1', [fixture.workspaceId]);
    await db.query('commit');
  } catch (error) { await db.query('rollback'); throw error; } finally { await db.end(); }
}
