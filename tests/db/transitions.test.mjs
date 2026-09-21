import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { localDb, localStack, readAccounts } from '../../scripts/local-stack.mjs';

const clients = {}, users = {}, teams = [];
let db, team, foreignTeam;
const complete = { title: '합성 D5 버그', steps: '1. 열기', expected: '목록 표시', actual: '빈 화면', environment: '로컬 Chromium', reproduction: 'reproduced', severity: 'S2', priority: 'P1', fix_note: '렌더링 수정', target_build: 'local-1' };
async function rpc(role, name, args) {
  const response = await clients[role].rpc(name, args);
  assert.equal(response.error, null, `RPC transport: ${response.error?.code}`); return response.data;
}
function moveArgs(row, target, extra = {}, request = randomUUID()) {
  return { p_workspace_id: row.workspace_id, p_issue_id: row.id, p_expected_version: row.version, p_request_id: request, p_payload: { target_status: target, ...extra } };
}
function inputFor(from, to) {
  if (from === 'verify') return { verification: { tested_build: 'local-1', tested_environment: ' Windows / Chromium ', note: to === 'in_progress' ? '실패: 빈 화면 유지' : '' } };
  if (to === 'inbox' || (from === 'in_progress' && to === 'ready')) return { reason: '재조사 필요' };
  return {};
}
async function move(row, to, role = 'owner', extra = inputFor(row.status, to)) { return rpc(role, 'transition_issue', moveArgs(row, to, extra)); }
async function edit(row, fields, role = 'owner') {
  return rpc(role, 'update_issue', { p_workspace_id: row.workspace_id, p_issue_id: row.id, p_expected_version: row.version, p_request_id: randomUUID(), p_payload: fields });
}
async function fixture(status = 'inbox', fields = {}) {
  const result = await rpc('owner', 'create_issue', { p_workspace_id: team, p_request_id: randomUUID(), p_payload: { ...complete, assignee_id: users.member, ...fields } });
  assert.equal(result.ok, true); let row = result.data;
  for (const target of ['ready', 'in_progress', 'verify', 'done']) {
    if (row.status === status) break;
    const moved = await move(row, target); assert.equal(moved.ok, true); row = moved.data;
  }
  return row;
}
async function counts(request) {
  return (await db.query(`select
    (select count(*)::int from private.command_receipts where request_id=$1) as receipts,
    (select count(*)::int from public.activity_events where request_id=$1) as activities,
    (select count(*)::int from public.verification_runs where request_id=$1) as runs`, [request])).rows[0];
}
async function stored(row) { return (await db.query('select * from public.issues where id=$1', [row.id])).rows[0]; }
async function rejected(row, args, code = 'VALIDATION', role = 'owner') {
  assert.equal((await rpc(role, 'transition_issue', args)).code, code);
  assert.deepEqual(await counts(args.p_request_id), { receipts: 0, activities: 0, runs: 0 });
  const latest = await stored(row); assert.equal(latest.status, row.status); assert.equal(latest.version, row.version);
}
before(async () => {
  const stack = localStack(); db = await localDb(stack);
  clients.anon = createClient(stack.API_URL, stack.PUBLISHABLE_KEY || stack.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  for (const account of readAccounts()) {
    const client = createClient(stack.API_URL, stack.PUBLISHABLE_KEY || stack.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const login = await client.auth.signInWithPassword({ email: account.email, password: account.password });
    assert.equal(login.error, null); clients[account.role] = client; users[account.role] = account.id;
  }
  for (const role of ['owner','outsider']) {
    const workspace = randomUUID(); teams.push(workspace);
    const result = await rpc(role, 'create_workspace', { p_workspace_id: workspace, p_request_id: randomUUID(), p_payload: { name: `합성 D5 ${role} 팀` } });
    assert.equal(result.ok, true);
  }
  [team, foreignTeam] = teams;
  await db.query("insert into public.workspace_members(workspace_id,user_id,role) values ($1,$2,'member'),($1,$3,'viewer')", [team, users.member, users.viewer]);
});
after(async () => {
  if (!db) return;
  await db.query('begin');
  try {
    for (const table of ['public.verification_runs','public.activity_events','private.workspace_invites','private.command_receipts','public.issues','public.workspace_members']) await db.query(`delete from ${table} where workspace_id=any($1::uuid[])`, [teams]);
    await db.query('delete from public.workspaces where id=any($1::uuid[])', [teams]); await db.query('commit');
  } catch (error) { await db.query('rollback'); throw error; } finally { await db.end(); }
});

test('D5 all 25 state pairs follow the eight PRD edges; rejected transitions have no effects', async () => {
  const states = ['inbox','ready','in_progress','verify','done'];
  const allowed = new Set(['inbox/ready','ready/inbox','ready/in_progress','in_progress/ready','in_progress/verify','verify/in_progress','verify/done','done/inbox']);
  for (const from of states) for (const to of states) {
    const row = await fixture(from), args = moveArgs(row, to, inputFor(from, to));
    if (!allowed.has(`${from}/${to}`)) { await rejected(row, args); continue; }
    const result = await rpc('member', 'transition_issue', args); assert.equal(result.ok, true);
    assert.equal(result.data.status, to); assert.equal(result.data.version, row.version + 1);
    assert.equal(result.data.updated_by, users.member);
    assert.deepEqual(await counts(args.p_request_id), { receipts: 1, activities: 1, runs: from === 'verify' ? 1 : 0 });
  }
  const row = await fixture(); await rejected(row, moveArgs(row, 'invalid'));
});

test('D5 transition prerequisites enforce reproduction, classification, current assignee, fix note and build', async () => {
  for (const fields of [{ steps: ' ' }, { expected: '' }, { actual: '' }, { environment: '' }, { reproduction: 'unknown' }, { reproduction: 'not_reproduced' }, { severity: 'unset' }, { priority: 'unset' }]) {
    const row = await fixture('inbox', fields); await rejected(row, moveArgs(row, 'ready'));
  }
  const ready = await fixture('ready', { assignee_id: null }); await rejected(ready, moveArgs(ready, 'in_progress'));
  for (const fields of [{ fix_note: '' }, { target_build: '' }]) {
    const progress = await fixture('in_progress', fields); await rejected(progress, moveArgs(progress, 'verify'));
  }
  for (const [from, to] of [['ready','inbox'],['in_progress','ready'],['done','inbox']]) {
    const row = await fixture(from);
    for (const extra of [{}, { reason: '\u3000' }, { reason: '😀'.repeat(4001) }]) await rejected(row, moveArgs(row, to, extra));
  }
});

test('D5 direct field edits cannot break current-state requirements; Done rejects every writable field', async () => {
  for (const status of ['ready','in_progress','verify','done']) {
    const row = await fixture(status);
    const invalid = [{ steps: '' }, { expected: '' }, { actual: '' }, { environment: '' }, { reproduction: 'unknown' }, { severity: 'unset' }, { priority: 'unset' }];
    if (status !== 'ready') invalid.push({ assignee_id: null });
    if (['verify','done'].includes(status)) invalid.push({ fix_note: '' }, { target_build: '' });
    if (status === 'done') invalid.push(...Object.keys(complete).map((key) => ({ [key]: complete[key] })), { reproduction_note: '변경 금지' }, { assignee_id: users.owner });
    for (const payload of invalid) {
      const args = { p_workspace_id: team, p_issue_id: row.id, p_expected_version: row.version, p_request_id: randomUUID(), p_payload: payload };
      assert.equal((await rpc('owner', 'update_issue', args)).code, 'VALIDATION');
      assert.deepEqual(await counts(args.p_request_id), { receipts: 0, activities: 0, runs: 0 });
      assert.equal((await stored(row)).version, row.version);
    }
    assert.equal((await clients.owner.from('issues').update({ status: 'done', steps: '' }).eq('id', row.id)).error?.code, '42501');
  }
  const ready = await fixture('ready');
  assert.equal((await edit(ready, { title: 'Ready에서 유효한 제목 편집' })).ok, true);
});

test('D5 verification requires current version, actual build/environment/fail note and rejects forged metadata', async () => {
  const row = await fixture('verify');
  for (const verification of [undefined, {}, { tested_build: '', tested_environment: 'dev' }, { tested_build: 'build', tested_environment: ' ' }, { tested_build: 'a'.repeat(121), tested_environment: 'dev' }, { tested_build: 'build', tested_environment: '가'.repeat(4001) }, { tested_build: 'build', tested_environment: 'dev', note: null }, ...['actor_id','result','issue_version_before','created_at'].map((key) => ({ tested_build: 'build', tested_environment: 'dev', [key]: 'forged' }))]) {
    await rejected(row, moveArgs(row, 'done', verification === undefined ? {} : { verification }));
  }
  await rejected(row, moveArgs(row, 'in_progress', { verification: { tested_build: 'build', tested_environment: 'dev', note: '\uFEFF' } }));
  const newer = await edit(row, { fix_note: '검증 직전 수정 내용 변경' }); assert.equal(newer.ok, true);
  await rejected(newer.data, moveArgs(row, 'done', inputFor('verify','done')), 'CONFLICT');
  assert.equal(Number((await db.query('select count(*) from public.verification_runs where issue_id=$1', [row.id])).rows[0].count), 0);
});

test('D5 fail, fix, pass and reopen preserve immutable verification history and bound versions', async () => {
  const original = await fixture('verify');
  const fail = await move(original, 'in_progress', 'member'); assert.equal(fail.ok, true);
  const fixed = await edit(fail.data, { fix_note: '두 번째 수정', target_build: 'local-2' }); assert.equal(fixed.ok, true);
  const verify = await move(fixed.data, 'verify'); assert.equal(verify.ok, true);
  const pass = await move(verify.data, 'done', 'member', { verification: { tested_build: ' local-2 ', tested_environment: ' 최종 환경 ', note: ' 정상 확인 ' } }); assert.equal(pass.ok, true);
  const history = (await db.query('select * from public.verification_runs where issue_id=$1 order by created_at', [original.id])).rows;
  assert.deepEqual(history.map((r) => r.result), ['fail','pass']);
  assert.deepEqual(history.map((r) => r.issue_version_before), [original.version, verify.data.version]);
  assert.equal(history[1].actor_id, users.member); assert.equal(history[1].tested_build, 'local-2'); assert.equal(history[1].tested_environment, '최종 환경');
  const reopened = await move(pass.data, 'inbox', 'owner', { reason: '  다른 환경에서 다시 발생  ' }); assert.equal(reopened.ok, true);
  assert.deepEqual((await db.query('select * from public.verification_runs where issue_id=$1 order by created_at', [original.id])).rows, history);
  const event = (await db.query("select changes from public.activity_events where issue_id=$1 and changes->>'from_status'='done'", [original.id])).rows[0];
  assert.equal(event.changes.reason, '다른 환경에서 다시 발생');
  assert.equal((await edit(reopened.data, { steps: '', title: '재오픈 후 본문 편집' })).ok, true);
});

test('D5 competing pass/fail and duplicate sends commit only one verification and reject changed payload reuse', async () => {
  const row = await fixture('verify');
  const a = moveArgs(row, 'done', inputFor('verify','done')), b = moveArgs(row, 'in_progress', inputFor('verify','in_progress'));
  const results = await Promise.all([rpc('owner','transition_issue',a),rpc('member','transition_issue',b)]);
  assert.equal(results.filter((r) => r.ok).length, 1); assert.equal(results.filter((r) => r.code === 'CONFLICT').length, 1);
  assert.equal((await stored(row)).version, row.version + 1);
  assert.equal(Number((await db.query('select count(*) from public.verification_runs where issue_id=$1', [row.id])).rows[0].count), 1);
  const duplicate = await fixture('verify'), args = moveArgs(duplicate, 'done', inputFor('verify','done'));
  const [first, second] = await Promise.all([rpc('owner','transition_issue',args),rpc('owner','transition_issue',args)]);
  assert.equal(first.ok, true); assert.deepEqual(first, second); assert.deepEqual(await counts(args.p_request_id), { receipts: 1, activities: 1, runs: 1 });
  const reopen = await move(first.data, 'inbox'); assert.equal(reopen.ok, true);
  assert.deepEqual(await rpc('owner','transition_issue',args), first);
  assert.equal((await stored(duplicate)).status, 'inbox'); assert.equal((await stored(duplicate)).version, reopen.data.version);
  assert.equal((await rpc('owner','transition_issue',{ ...args, p_payload: { ...args.p_payload, verification: { ...args.p_payload.verification, note: '다른 내용' } } })).code, 'VALIDATION');
});

test('D5 verification or activity failure rolls back verification, issue, activity and receipt together', async () => {
  for (const table of ['public.verification_runs','public.activity_events']) {
    const row = await fixture('verify'), args = moveArgs(row, 'done', inputFor('verify','done'));
    await db.query(`create function private.d5_test_failure() returns trigger language plpgsql as $$ begin if new.request_id='${args.p_request_id}'::uuid then raise exception 'D5_ROLLBACK'; end if; return new; end $$`);
    await db.query(`create trigger d5_test_failure before insert on ${table} for each row execute function private.d5_test_failure()`);
    try {
      assert.ok((await clients.owner.rpc('transition_issue', args)).error);
      assert.deepEqual(await counts(args.p_request_id), { receipts: 0, activities: 0, runs: 0 });
      assert.equal((await stored(row)).status, 'verify'); assert.equal((await stored(row)).version, row.version);
    } finally { await db.query(`drop trigger d5_test_failure on ${table}`); await db.query('drop function private.d5_test_failure()'); }
  }
});

test('D5 verification RLS/grants, Viewer/foreign denial, forged workspace and auth.uid-less calls stay closed', async () => {
  const row = await fixture('verify');
  for (const role of ['viewer','outsider']) await rejected(row, moveArgs(row, 'done', inputFor('verify','done')), 'FORBIDDEN', role);
  await rejected(row, { ...moveArgs(row, 'done', inputFor('verify','done')), p_workspace_id: foreignTeam }, 'NOT_FOUND', 'outsider');
  assert.ok((await clients.anon.rpc('transition_issue', moveArgs(row, 'done', inputFor('verify','done')))).error);
  const success = await move(row, 'done'); assert.equal(success.ok, true);
  for (const role of ['owner','member','viewer']) {
    const read = await clients[role].from('verification_runs').select('*').eq('issue_id', row.id); assert.equal(read.error, null); assert.equal(read.data.length, 1);
    assert.equal((await clients[role].from('verification_runs').insert(read.data[0])).error?.code, '42501');
    assert.equal((await clients[role].from('verification_runs').update({ note: 'forged' }).eq('issue_id', row.id)).error?.code, '42501');
    assert.equal((await clients[role].from('verification_runs').delete().eq('issue_id', row.id)).error?.code, '42501');
  }
  const outside = await clients.outsider.from('verification_runs').select('*').eq('issue_id', row.id); assert.equal(outside.error, null); assert.deepEqual(outside.data, []);
  assert.ok((await clients.anon.from('verification_runs').select('*')).error);
  assert.equal((await db.query("select has_function_privilege('authenticated','private.issue_state_errors(text,jsonb,boolean)','execute') as allowed")).rows[0].allowed, false);
  await db.query('begin');
  try {
    await db.query('set local role authenticated');
    const result = await db.query('select public.transition_issue($1,$2,$3,$4,$5) as result', [team,row.id,success.data.version,randomUUID(),{ target_status: 'inbox', reason: 'no auth uid' }]);
    assert.equal(result.rows[0].result.code, 'FORBIDDEN');
  } finally { await db.query('rollback'); }
});

test('D5 a demoted assignee blocks progress and editing until reassigned; retreat to Ready remains possible', async () => {
  const row = await fixture('in_progress');
  await db.query("update public.workspace_members set role='viewer' where workspace_id=$1 and user_id=$2", [team,users.member]);
  try {
    await rejected(row, moveArgs(row, 'verify'));
    assert.equal((await edit(row, { title: 'invalid assignee remains' })).code, 'VALIDATION');
    const retreat = await move(row, 'ready'); assert.equal(retreat.ok, true);
    await rejected(retreat.data, moveArgs(retreat.data, 'in_progress'));
    const reassigned = await edit(retreat.data, { assignee_id: users.owner }); assert.equal(reassigned.ok, true);
    assert.equal((await move(reassigned.data, 'in_progress')).ok, true);
  } finally { await db.query("update public.workspace_members set role='member' where workspace_id=$1 and user_id=$2", [team,users.member]); }
});
