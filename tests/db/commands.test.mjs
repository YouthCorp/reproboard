import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { localDb, localStack, readAccounts } from '../../scripts/local-stack.mjs';

const team = 'a1000000-0000-4000-8000-000000000001';
const otherTeam = 'b2000000-0000-4000-8000-000000000002';
const clients = {};
const users = {};
const created = new Set();
let db, sample, foreign;

async function rpc(role, operation, payload) {
  const result = await clients[role].rpc(operation, payload);
  assert.equal(result.error, null, `Unexpected RPC transport failure: ${result.error?.code}`);
  if (result.data.ok) created.add(result.data.data.id);
  return result.data;
}
function createArgs(title, workspace = team, request = randomUUID()) {
  return { p_workspace_id: workspace, p_request_id: request, p_payload: { title } };
}
function updateArgs(issue, title, request = randomUUID()) {
  return { ...createArgs(title, issue.workspace_id, request), p_issue_id: issue.id, p_expected_version: issue.version };
}
async function receiptCount(request) {
  return Number((await db.query('select count(*) from private.command_receipts where request_id=$1', [request])).rows[0].count);
}
async function activityCount(request) {
  return Number((await db.query('select count(*) from public.activity_events where request_id=$1', [request])).rows[0].count);
}
async function removeTestWorkspace(workspace) {
  await db.query('begin');
  try {
    await db.query('delete from public.activity_events where workspace_id=$1', [workspace]);
    await db.query('delete from private.command_receipts where workspace_id=$1', [workspace]);
    await db.query('delete from public.issues where workspace_id=$1', [workspace]);
    await db.query('delete from public.workspace_members where workspace_id=$1', [workspace]);
    await db.query('delete from public.workspaces where id=$1', [workspace]);
    await db.query('commit');
  } catch (error) { await db.query('rollback'); throw error; }
}

before(async () => {
  const status = localStack();
  db = await localDb(status);
  const key = status.PUBLISHABLE_KEY || status.ANON_KEY;
  clients.anon = createClient(status.API_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
  for (const account of readAccounts()) {
    const client = createClient(status.API_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.auth.signInWithPassword({ email: account.email, password: account.password });
    assert.equal(error, null, `Synthetic ${account.role} login failed.`);
    assert.equal(data.user.id, account.id);
    users[account.role] = data.user.id;
    clients[account.role] = client;
  }
  sample = (await rpc('owner', 'create_issue', createArgs('DB 검증용 합성 이슈'))).data;
  foreign = (await rpc('outsider', 'create_issue', createArgs('다른 팀 합성 이슈', otherTeam))).data;
});
after(async () => {
  if (!db) return;
  // Delete only ids produced by this run, never reset a shared/developer database.
  await db.query('begin');
  try {
    await db.query('delete from public.activity_events where issue_id = any($1::uuid[])', [[...created]]);
    await db.query("delete from private.command_receipts where result->'data'->>'id' = any($1::text[])", [[...created]]);
    await db.query('delete from public.issues where id = any($1::uuid[])', [[...created]]);
    await db.query('commit');
  } catch (error) { await db.query('rollback'); throw error; }
  finally { await db.end(); }
});

test('actual Owner/Member/Viewer sessions read only their team; anonymous cannot read', async () => {
  for (const role of ['owner', 'member', 'viewer']) {
    const permitted = (await db.query('select workspace_id from public.workspace_members where user_id=$1', [users[role]])).rows.map((row) => row.workspace_id);
    for (const table of ['workspaces', 'workspace_members', 'issues', 'activity_events']) {
      const result = await clients[role].from(table).select('*');
      assert.equal(result.error, null, `${role}/${table} read failed`);
      assert.ok(result.data.length > 0);
      assert.ok(result.data.every((row) => permitted.includes(table === 'workspaces' ? row.id : row.workspace_id)));
      assert.ok(result.data.some((row) => (table === 'workspaces' ? row.id : row.workspace_id) === team));
    }
  }
  const outside = await clients.outsider.from('issues').select('*').eq('workspace_id', team);
  assert.equal(outside.error, null);
  assert.deepEqual(outside.data, []);
  assert.ok((await clients.anon.from('issues').select('*')).error);
});

test('all client roles are denied direct table insert/update/delete', async () => {
  for (const role of ['owner', 'member', 'viewer', 'outsider']) {
    const issueResult = await clients[role].from('issues').insert({ workspace_id: team, title: 'bypass', created_by: users[role], updated_by: users[role] });
    assert.equal(issueResult.error?.code, '42501');
    for (const table of ['workspaces', 'workspace_members', 'issues', 'activity_events']) {
      const field = table === 'workspaces' ? 'name' : table === 'workspace_members' ? 'role' : table === 'issues' ? 'title' : 'event_type';
      assert.equal((await clients[role].from(table).update({ [field]: 'injected' }).not(field, 'is', null)).error?.code, '42501');
      assert.equal((await clients[role].from(table).delete().not(field, 'is', null)).error?.code, '42501');
    }
  }
});

test('Viewer, other team, missing workspace and anonymous RPC writes are rejected without effects', async () => {
  const cases = [['viewer', team], ['outsider', team], ['owner', randomUUID()]];
  for (const [role, workspace] of cases) {
    const args = createArgs('拒否', workspace);
    assert.equal((await rpc(role, 'create_issue', args)).code, 'FORBIDDEN');
    assert.equal(await receiptCount(args.p_request_id), 0);
    assert.equal(await activityCount(args.p_request_id), 0);
  }
  for (const role of ['viewer', 'outsider']) {
    const args = updateArgs(sample, 'cannot edit');
    assert.equal((await rpc(role, 'update_issue', args)).code, 'FORBIDDEN');
    assert.equal(await receiptCount(args.p_request_id), 0);
  }
  assert.ok((await clients.anon.rpc('create_issue', createArgs('anonymous'))).error);
});

test('forged issue/workspace relationship and nonexistent ids return the same NOT_FOUND', async () => {
  for (const id of [foreign.id, randomUUID()]) {
    const args = { ...updateArgs(sample, 'injection'), p_issue_id: id };
    assert.equal((await rpc('member', 'update_issue', args)).code, 'NOT_FOUND');
    assert.equal(await receiptCount(args.p_request_id), 0);
  }
});

test('server validates title, trim and Unicode length; actor/version/status cannot be injected', async () => {
  for (const payload of [{ title: '' }, { title: ' \t\n\u3000' }, { title: 'x'.repeat(121) }, { title: 123 }, { title: null },
    { title: 'ok', status: 'done' }, { title: 'ok', created_by: users.outsider }, { title: 'ok', version: 99 }, {}, [], null]) {
    const args = { ...createArgs('unused'), p_payload: payload };
    assert.equal((await rpc('owner', 'create_issue', args)).code, 'VALIDATION');
    assert.equal(await receiptCount(args.p_request_id), 0);
    assert.equal(await activityCount(args.p_request_id), 0);
  }
  const result = await rpc('member', 'create_issue', createArgs(`\uFEFF\u3000${'😀'.repeat(120)}\t`));
  assert.equal(result.ok, true);
  assert.equal(result.data.title, '😀'.repeat(120));
  assert.equal(result.data.created_by, users.member);
  assert.equal(result.data.status, 'inbox');
  assert.equal(result.data.version, 1);
});

test('successful create/update persist in DB with one activity and receipt each', async () => {
  const args = createArgs('  한글 제목  ');
  const first = await rpc('owner', 'create_issue', args);
  const edit = updateArgs(first.data, '수정된 제목');
  const second = await rpc('member', 'update_issue', edit);
  assert.equal(second.data.version, 2);
  assert.equal(second.data.updated_by, users.member);
  const stored = (await db.query('select * from public.issues where id=$1', [first.data.id])).rows[0];
  assert.equal(stored.title, '수정된 제목');
  assert.equal(stored.created_by, users.owner);
  for (const request of [args.p_request_id, edit.p_request_id]) {
    assert.equal(await receiptCount(request), 1);
    assert.equal(await activityCount(request), 1);
  }
});

test('two actual sessions updating the same version produce one success and one CONFLICT', async () => {
  const row = (await rpc('owner', 'create_issue', createArgs('경합 원본'))).data;
  const a = updateArgs(row, 'Owner 변경');
  const b = updateArgs(row, 'Member 변경');
  const results = await Promise.all([rpc('owner', 'update_issue', a), rpc('member', 'update_issue', b)]);
  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.equal(results.filter((result) => result.code === 'CONFLICT').length, 1);
  const stored = (await db.query('select title, version from public.issues where id=$1', [row.id])).rows[0];
  assert.equal(stored.version, 2);
  assert.equal(stored.title, results.find((result) => result.ok).data.title);
  const loser = results[0].ok ? b : a;
  assert.equal(await receiptCount(loser.p_request_id), 0);
  assert.equal(await activityCount(loser.p_request_id), 0);
});

test('concurrent duplicate creation returns the same result and commits only once', async () => {
  const args = createArgs('동시 중복 생성');
  const results = await Promise.all([rpc('owner', 'create_issue', args), rpc('owner', 'create_issue', args)]);
  assert.equal(results[0].ok, true);
  assert.deepEqual(results[0], results[1]);
  assert.equal(await receiptCount(args.p_request_id), 1);
  assert.equal(await activityCount(args.p_request_id), 1);
});

test('concurrent duplicate update and replay after a newer edit never increment version twice', async () => {
  const row = (await rpc('member', 'create_issue', createArgs('재전송 원본'))).data;
  const args = updateArgs(row, '동일 수정');
  const [a, b] = await Promise.all([rpc('member', 'update_issue', args), rpc('member', 'update_issue', args)]);
  assert.equal(a.ok, true);
  assert.deepEqual(a, b);
  await rpc('owner', 'update_issue', updateArgs(a.data, '그 이후 수정'));
  assert.deepEqual(await rpc('member', 'update_issue', args), a);
  assert.equal((await db.query('select version from public.issues where id=$1', [row.id])).rows[0].version, 3);
  assert.equal(await receiptCount(args.p_request_id), 1);
  assert.equal(await activityCount(args.p_request_id), 1);
});

test('same request id with different payload/operation is rejected, including concurrent first submissions', async () => {
  const args = createArgs('request payload A');
  const changed = { ...args, p_payload: { title: 'request payload B' } };
  const results = await Promise.all([rpc('owner', 'create_issue', args), rpc('owner', 'create_issue', changed)]);
  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.equal(results.filter((result) => result.code === 'VALIDATION').length, 1);
  const row = results.find((result) => result.ok).data;
  assert.equal((await rpc('owner', 'update_issue', updateArgs(row, row.title, args.p_request_id))).code, 'VALIDATION');
  assert.equal(await activityCount(args.p_request_id), 1);
});

test('receipt replay rechecks current role; revoked write permission cannot read a previous success', async () => {
  const args = createArgs('권한 회수 재전송');
  await rpc('member', 'create_issue', args);
  await db.query("update public.workspace_members set role='viewer' where workspace_id=$1 and user_id=$2", [team, users.member]);
  try { assert.equal((await rpc('member', 'create_issue', args)).code, 'FORBIDDEN'); }
  finally { await db.query("update public.workspace_members set role='member' where workspace_id=$1 and user_id=$2", [team, users.member]); }
  assert.equal(await receiptCount(args.p_request_id), 1);
});

test('activity failure rolls back the issue change and leaves no success receipt', async () => {
  const row = (await rpc('owner', 'create_issue', createArgs('롤백 검증 원본'))).data;
  const args = updateArgs(row, '저장되면 안 됨');
  // Test-owned UUID only. This trigger cannot affect unrelated requests.
  await db.query(`create function private.d2_test_activity_failure() returns trigger language plpgsql as $$
    begin if new.request_id = '${args.p_request_id}'::uuid then raise exception 'D2_TEST_ROLLBACK'; end if; return new; end $$`);
  await db.query('create trigger d2_test_activity_failure before insert on public.activity_events for each row execute function private.d2_test_activity_failure()');
  try {
    const result = await clients.owner.rpc('update_issue', args);
    assert.ok(result.error);
    const stored = (await db.query('select title, version from public.issues where id=$1', [row.id])).rows[0];
    assert.equal(stored.title, row.title);
    assert.equal(stored.version, 1);
    assert.equal(await receiptCount(args.p_request_id), 0);
    assert.equal(await activityCount(args.p_request_id), 0);
  } finally {
    await db.query('drop trigger d2_test_activity_failure on public.activity_events');
    await db.query('drop function private.d2_test_activity_failure()');
  }
});

test('receipts/internal helpers are inaccessible; authenticated role alone is insufficient without auth.uid', async () => {
  assert.ok((await clients.owner.schema('private').from('command_receipts').select('*')).error);
  const privileges = await db.query(`select
    has_function_privilege('authenticated','private.apply_issue_command(text,uuid,uuid,integer,uuid,jsonb)','execute') as internal,
    has_function_privilege('anon','public.create_issue(uuid,uuid,jsonb)','execute') as anonymous,
    has_table_privilege('authenticated','private.command_receipts','select') as receipt`);
  assert.deepEqual(privileges.rows[0], { internal: false, anonymous: false, receipt: false });
  await db.query('begin');
  try {
    await db.query('set local role authenticated');
    const result = await db.query('select public.create_issue($1,$2,$3) as result', [team, randomUUID(), { title: 'no auth.uid' }]);
    assert.equal(result.rows[0].result.code, 'FORBIDDEN');
  } finally { await db.query('rollback'); }
});

test('workspace capacity check stays at 500 under concurrent creation', async () => {
  const workspace = randomUUID();
  await db.query('insert into public.workspaces (id,name,owner_id) values ($1,$2,$3)', [workspace, '합성 용량 검증 팀', users.owner]);
  try {
    await db.query("insert into public.workspace_members(workspace_id,user_id,role) values ($1,$2,'owner')", [workspace, users.owner]);
    await db.query(`insert into public.issues(workspace_id,title,created_by,updated_by)
      select $1, '용량 검증 ' || n, $2, $2 from generate_series(1,499) n`, [workspace, users.owner]);
    const results = await Promise.all([
      rpc('owner', 'create_issue', createArgs('마지막 자리 A', workspace)),
      rpc('owner', 'create_issue', createArgs('마지막 자리 B', workspace)),
    ]);
    assert.equal(results.filter((result) => result.ok).length, 1);
    assert.equal(results.filter((result) => result.code === 'VALIDATION').length, 1);
    assert.equal(Number((await db.query('select count(*) from public.issues where workspace_id=$1', [workspace])).rows[0].count), 500);
  } finally { await removeTestWorkspace(workspace); }
});

test('D4 title-only defaults and all structured fields use the same trim/code-point limits', async () => {
  const bare = (await rpc('owner', 'create_issue', createArgs('제목만'))).data;
  for (const key of ['steps','expected','actual','environment','reproduction_note','fix_note','target_build']) assert.equal(bare[key], '');
  assert.equal(bare.reproduction, 'unknown'); assert.equal(bare.severity, 'unset'); assert.equal(bare.priority, 'unset'); assert.equal(bare.assignee_id, null);
  const payload = { title: ' \uFEFF최대 입력\u3000 ', reproduction: ' intermittent ', severity: ' S2 ', priority: ' P3 ', assignee_id: users.member };
  for (const key of ['steps','expected','actual','environment','reproduction_note','fix_note']) payload[key] = `\uFEFF${'😀'.repeat(4000)}\u3000`;
  payload.target_build = ` ${'한'.repeat(120)} `;
  const args = { ...createArgs('unused'), p_payload: payload };
  const saved = await rpc('owner', 'create_issue', args);
  assert.equal(saved.ok, true); assert.equal(saved.data.title, '최대 입력'); assert.equal(saved.data.status, 'inbox');
  for (const key of ['steps','expected','actual','environment','reproduction_note','fix_note']) assert.equal(saved.data[key], '😀'.repeat(4000));
  assert.equal(saved.data.target_build, '한'.repeat(120)); assert.equal(saved.data.priority, 'P3'); assert.equal(saved.data.severity, 'S2');
  const event = (await db.query('select changes from public.activity_events where request_id=$1', [args.p_request_id])).rows[0];
  assert.equal(event.changes.new_fields.steps, saved.data.steps);
  assert.deepEqual(await rpc('owner', 'create_issue', args), saved);
  assert.equal((await rpc('owner', 'create_issue', { ...args, p_payload: { ...payload, actual: 'changed' } })).code, 'VALIDATION');
  assert.equal(await activityCount(args.p_request_id), 1); assert.equal(await receiptCount(args.p_request_id), 1);
});

test('D4 oversized/null/unknown fields, invalid enums, intermittent without a memo, and injected assignees reject atomically', async () => {
  const invalid = [
    ...['steps','expected','actual','environment','reproduction_note','fix_note'].map((key) => ({ [key]: '한'.repeat(4001) })),
    { target_build: 'a'.repeat(121) }, { steps: null }, { actual: 1 }, { extra: 'injection' },
    { reproduction: 'invalid' }, { severity: 'S0' }, { priority: 'P4' },
    { reproduction: 'intermittent', reproduction_note: '\uFEFF\u3000' },
    ...[users.viewer, users.outsider, randomUUID(), 'bad', '', 12].map((assignee_id) => ({ assignee_id })),
  ];
  for (const fields of invalid) {
    const args = { ...createArgs('거부되어야 하는 합성 이슈'), p_payload: { title: '거부', ...fields } };
    assert.equal((await rpc('owner', 'create_issue', args)).code, 'VALIDATION');
    assert.equal(await receiptCount(args.p_request_id), 0); assert.equal(await activityCount(args.p_request_id), 0);
  }
  const row = (await rpc('member', 'create_issue', { ...createArgs('간헐 이슈'), p_payload: { title: '간헐 이슈', reproduction: 'intermittent', reproduction_note: '처음 실행할 때' } })).data;
  const edit = { ...updateArgs(row, 'unused'), p_payload: { reproduction_note: ' ' } };
  assert.equal((await rpc('member', 'update_issue', edit)).code, 'VALIDATION');
  const stored = (await db.query('select version,reproduction_note from public.issues where id=$1', [row.id])).rows[0];
  assert.deepEqual(stored, { version: 1, reproduction_note: '처음 실행할 때' });
});

test('D4 partial structured edits race by issue version and keep activity/receipt atomic on rollback', async () => {
  const row = (await rpc('owner', 'create_issue', createArgs('구조화 경합'))).data;
  const a = { ...updateArgs(row, 'unused'), p_payload: { steps: 'Owner 재현 단계', expected: '예상' } };
  const b = { ...updateArgs(row, 'unused'), p_payload: { environment: 'Member 환경' } };
  const results = await Promise.all([rpc('owner', 'update_issue', a), rpc('member', 'update_issue', b)]);
  assert.equal(results.filter((r) => r.ok).length, 1); assert.equal(results.filter((r) => r.code === 'CONFLICT').length, 1);
  const winner = results.find((r) => r.ok).data;
  assert.equal(winner.title, row.title); assert.equal(winner.version, 2);
  const edit = { ...updateArgs(winner, 'unused'), p_payload: { actual: 'must roll back', fix_note: 'must roll back' } };
  await db.query(`create function private.d4_test_failure() returns trigger language plpgsql as $$ begin if new.request_id='${edit.p_request_id}'::uuid then raise exception 'D4_TEST_ROLLBACK'; end if; return new; end $$`);
  await db.query('create trigger d4_test_failure before insert on public.activity_events for each row execute function private.d4_test_failure()');
  try {
    assert.ok((await clients.owner.rpc('update_issue', edit)).error);
    const stored = (await db.query('select actual,fix_note,version from public.issues where id=$1', [row.id])).rows[0];
    assert.deepEqual(stored, { actual: '', fix_note: '', version: 2 });
    assert.equal(await receiptCount(edit.p_request_id), 0); assert.equal(await activityCount(edit.p_request_id), 0);
  } finally {
    await db.query('drop trigger d4_test_failure on public.activity_events'); await db.query('drop function private.d4_test_failure()');
  }
});

test('D4 a demoted assignee is retained for reassignment but cannot be newly assigned', async () => {
  const row = (await rpc('owner', 'create_issue', { ...createArgs('담당자 강등'), p_payload: { title: '담당자 강등', assignee_id: users.member } })).data;
  await db.query("update public.workspace_members set role='viewer' where workspace_id=$1 and user_id=$2", [team, users.member]);
  try {
    const retained = await rpc('owner', 'update_issue', { ...updateArgs(row, 'unused'), p_payload: { steps: '보존', assignee_id: users.member } });
    assert.equal(retained.ok, true); assert.equal(retained.data.assignee_id, users.member);
    const removed = await rpc('owner', 'update_issue', { ...updateArgs(retained.data, 'unused'), p_payload: { assignee_id: null } });
    assert.equal(removed.ok, true);
    assert.equal((await rpc('owner', 'update_issue', { ...updateArgs(removed.data, 'unused'), p_payload: { assignee_id: users.member } })).code, 'VALIDATION');
  } finally { await db.query("update public.workspace_members set role='member' where workspace_id=$1 and user_id=$2", [team, users.member]); }
});
