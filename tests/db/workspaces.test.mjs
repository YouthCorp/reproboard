import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { localDb, localStack, readAccounts, testTeam } from '../../scripts/local-stack.mjs';

const team = testTeam();
const otherTeam = testTeam('outsider');
const clients = {}, users = {}, created = new Set();
let db;
const token = () => randomBytes(32).toString('hex');
async function call(role, name, args) {
  const result = await clients[role].rpc(name, args);
  assert.equal(result.error, null, `RPC ${name} transport failed: ${result.error?.code}`);
  return result.data;
}
async function createTeam(role = 'owner') {
  const id = randomUUID(); created.add(id);
  const result = await call(role, 'create_workspace', { p_workspace_id: id, p_request_id: randomUUID(), p_payload: { name: 'D3 합성 검증 팀' } });
  assert.equal(result.ok, true);
  return id;
}
async function invitation(workspace, role = 'owner') {
  const raw = token();
  const args = { p_workspace_id: workspace, p_request_id: randomUUID(), p_payload: { token: raw } };
  const result = await call(role, 'create_invite', args);
  assert.equal(result.ok, true);
  return { raw, args, result };
}
async function join(workspace, role) {
  const invite = await invitation(workspace);
  const result = await call(role, 'accept_invite', { p_request_id: randomUUID(), p_token: invite.raw });
  assert.equal(result.ok, true);
}
function roleArgs(workspace, target, role, expectedRole = 'member') {
  return { p_workspace_id: workspace, p_request_id: randomUUID(), p_payload: { userId: users[target], role, expectedRole } };
}
async function receiptCount(request) {
  return Number((await db.query('select count(*) from private.command_receipts where request_id=$1', [request])).rows[0].count);
}
before(async () => {
  const status = localStack();
  db = await localDb(status);
  const key = status.PUBLISHABLE_KEY || status.ANON_KEY;
  clients.anon = createClient(status.API_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
  for (const account of readAccounts()) {
    const client = createClient(status.API_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const result = await client.auth.signInWithPassword({ email: account.email, password: account.password });
    assert.equal(result.error, null, `Synthetic ${account.role} login failed`);
    users[account.role] = result.data.user.id;
    clients[account.role] = client;
  }
});
after(async () => {
  if (!db) return;
  await db.query('begin');
  try {
    for (const table of ['public.activity_events', 'private.workspace_invites', 'private.command_receipts', 'public.issues', 'public.workspace_members']) {
      await db.query(`delete from ${table} where workspace_id = any($1::uuid[])`, [[...created]]);
    }
    await db.query('delete from public.workspaces where id = any($1::uuid[])', [[...created]]);
    await db.query('commit');
  } catch (error) { await db.query('rollback'); throw error; }
  finally { await db.end(); }
});

test('same-team profiles expose only display names; permission matrix includes planned verify/comment gates', async () => {
  for (const role of ['owner', 'member', 'viewer']) {
    const profiles = await clients[role].from('profiles').select('*');
    assert.equal(profiles.error, null);
    assert.equal(profiles.data.some((row) => row.user_id === users.outsider), false);
    assert.ok(profiles.data.every((row) => Object.keys(row).sort().join(',') === 'display_name,user_id'));
    const members = await call(role, 'list_workspace_members', { p_workspace_id: team });
    assert.equal(members.length, 3);
    assert.ok(members.every((row) => Object.keys(row).sort().join(',') === 'display_name,role,user_id'));
    const permissions = await call(role, 'workspace_permissions', { p_workspace_id: team });
    assert.deepEqual(permissions, { read: true, write: role !== 'viewer', verify: role !== 'viewer', comment: role !== 'viewer', invite: role === 'owner', manage_members: role === 'owner' });
    assert.deepEqual(await call(role, 'list_workspace_members', { p_workspace_id: otherTeam }), []);
    assert.ok(Object.values(await call(role, 'workspace_permissions', { p_workspace_id: otherTeam })).every((value) => value === false));
  }
  assert.deepEqual(await call('outsider', 'list_workspace_members', { p_workspace_id: team }), []);
  assert.ok((await clients.anon.from('profiles').select('*')).error);
});

test('creator becomes Owner atomically; concurrent replay creates one team and rejects owner injection', async () => {
  const id = randomUUID(); created.add(id);
  const args = { p_workspace_id: id, p_request_id: randomUUID(), p_payload: { name: ' 새로운 합성 팀 ' } };
  const results = await Promise.all([call('viewer', 'create_workspace', args), call('viewer', 'create_workspace', args)]);
  assert.equal(results[0].ok, true); assert.deepEqual(results[0], results[1]);
  assert.equal((await db.query('select owner_id from public.workspaces where id=$1', [id])).rows[0].owner_id, users.viewer);
  assert.deepEqual((await db.query('select user_id, role from public.workspace_members where workspace_id=$1', [id])).rows, [{ user_id: users.viewer, role: 'owner' }]);
  assert.equal(await receiptCount(args.p_request_id), 1);
  assert.equal((await call('viewer', 'create_workspace', { ...args, p_payload: { name: '다른 payload' } })).code, 'VALIDATION');
  for (const payload of [{ name: '주입', owner_id: users.owner }, { name: '주입', role: 'owner' }, { name: ' ' }]) {
    assert.equal((await call('member', 'create_workspace', { p_workspace_id: randomUUID(), p_request_id: randomUUID(), p_payload: payload })).code, 'VALIDATION');
  }
  assert.equal((await call('outsider', 'create_workspace', { ...args, p_request_id: randomUUID() })).code, 'FORBIDDEN');
});

test('new auth-user trigger initializes only a bounded display name and metadata cannot grant membership', async () => {
  const id = randomUUID();
  await db.query('begin');
  try {
    await db.query('insert into auth.users (id, email, raw_user_meta_data) values ($1,$2,$3::jsonb)', [
      id, `d3-trigger-${id}@reproboard.test`, JSON.stringify({ display_name: '합'.repeat(100), role: 'owner', workspace_id: team }),
    ]);
    const profile = (await db.query('select * from public.profiles where user_id=$1', [id])).rows[0];
    assert.deepEqual(profile, { user_id: id, display_name: '합'.repeat(80) });
    assert.equal((await db.query('select count(*) from public.workspace_members where user_id=$1', [id])).rows[0].count, '0');
  } finally { await db.query('rollback'); }
});

test('all direct profile/workspace/membership writes and anonymous bootstrap commands are blocked', async () => {
  for (const role of ['owner', 'member', 'viewer', 'outsider']) {
    for (const [table, row, field] of [
      ['profiles', { user_id: users[role], display_name: '주입' }, 'display_name'],
      ['workspaces', { name: '주입', owner_id: users[role] }, 'name'],
      ['workspace_members', { workspace_id: otherTeam, user_id: users[role], role: 'owner' }, 'role'],
    ]) {
      assert.equal((await clients[role].from(table).insert(row)).error?.code, '42501');
      assert.equal((await clients[role].from(table).update({ [field]: '주입' }).not(field, 'is', null)).error?.code, '42501');
      assert.equal((await clients[role].from(table).delete().not(field, 'is', null)).error?.code, '42501');
    }
  }
  for (const name of ['create_workspace', 'create_invite', 'change_member_role']) {
    assert.ok((await clients.anon.rpc(name, { p_workspace_id: team, p_request_id: randomUUID(), p_payload: { name: '익명' } })).error);
  }
  assert.ok((await clients.anon.rpc('accept_invite', { p_request_id: randomUUID(), p_token: token() })).error);
});

test('only Owner can invite, role is fixed, hashes alone persist and concurrent replay returns one receipt', async () => {
  const workspace = await createTeam();
  for (const role of ['member', 'viewer', 'outsider']) {
    const request = randomUUID();
    assert.equal((await call(role, 'create_invite', { p_workspace_id: team, p_request_id: request, p_payload: { token: token() } })).code, 'FORBIDDEN');
    assert.equal(await receiptCount(request), 0);
  }
  const raw = token();
  const args = { p_workspace_id: workspace, p_request_id: randomUUID(), p_payload: { token: raw } };
  const [initial, replay] = await Promise.all([call('owner', 'create_invite', args), call('owner', 'create_invite', args)]);
  const invite = { raw, args, result: initial };
  assert.equal(initial.ok, true);
  assert.deepEqual(replay, invite.result);
  assert.equal(await receiptCount(invite.args.p_request_id), 1);
  const stored = (await db.query('select * from private.workspace_invites where id=$1', [invite.result.data.inviteId])).rows[0];
  assert.equal(stored.token_hash.toString('hex'), createHash('sha256').update(invite.raw).digest('hex'));
  assert.equal(stored.role, 'member');
  assert.equal(stored.expires_at - stored.created_at, 24 * 60 * 60 * 1000);
  assert.equal(JSON.stringify(stored).includes(invite.raw), false);
  const receipt = (await db.query('select * from private.command_receipts where request_id=$1', [invite.args.p_request_id])).rows[0];
  assert.equal(JSON.stringify(receipt).includes(invite.raw), false);
  assert.equal((await call('owner', 'create_invite', { ...invite.args, p_payload: { token: token() } })).code, 'VALIDATION');
  assert.equal((await call('owner', 'create_invite', { ...invite.args, p_request_id: randomUUID(), p_payload: { token: token(), role: 'owner' } })).code, 'VALIDATION');
});

test('two different sessions racing one invite add exactly one Member; same-request retry has no additional effect', async () => {
  const workspace = await createTeam();
  const invite = await invitation(workspace);
  const args = { p_request_id: randomUUID(), p_token: invite.raw };
  const results = await Promise.all(['member', 'viewer'].map((role) => call(role, 'accept_invite', args)));
  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.equal(results.find((result) => !result.ok).code, 'INVITE_UNAVAILABLE');
  const winner = results[0].ok ? 'member' : 'viewer';
  const membership = (await db.query("select user_id, role from public.workspace_members where workspace_id=$1 and role<>'owner'", [workspace])).rows;
  assert.deepEqual(membership, [{ user_id: users[winner], role: 'member' }]);
  assert.equal((await db.query('select accepted_by from private.workspace_invites where id=$1', [invite.result.data.inviteId])).rows[0].accepted_by, users[winner]);
  assert.equal(await receiptCount(args.p_request_id), 1);
  assert.deepEqual(await call(winner, 'accept_invite', args), results.find((result) => result.ok));
  assert.equal((await call(winner, 'accept_invite', { ...args, p_request_id: randomUUID() })).code, 'INVITE_UNAVAILABLE');
});

test('expired/unknown invites reject without membership or receipt; existing members do not consume or escalate', async () => {
  const workspace = await createTeam();
  const invite = await invitation(workspace);
  const ownAttempt = await call('owner', 'accept_invite', { p_request_id: randomUUID(), p_token: invite.raw });
  assert.equal(ownAttempt.code, 'ALREADY_MEMBER');
  assert.equal((await db.query('select accepted_by from private.workspace_invites where id=$1', [invite.result.data.inviteId])).rows[0].accepted_by, null);
  await db.query("update private.workspace_invites set created_at=statement_timestamp()-interval '25 hours', expires_at=statement_timestamp()-interval '1 hour' where id=$1", [invite.result.data.inviteId]);
  const request = randomUUID();
  assert.equal((await call('member', 'accept_invite', { p_request_id: request, p_token: invite.raw })).code, 'INVITE_UNAVAILABLE');
  assert.equal(await receiptCount(request), 0);
  assert.equal((await call('member', 'accept_invite', { p_request_id: randomUUID(), p_token: token() })).code, 'INVITE_UNAVAILABLE');
  assert.equal((await db.query('select count(*) from public.workspace_members where workspace_id=$1', [workspace])).rows[0].count, '1');
  await join(workspace, 'member');
  await call('owner', 'change_member_role', roleArgs(workspace, 'member', 'viewer'));
  const next = await invitation(workspace);
  assert.equal((await call('member', 'accept_invite', { p_request_id: randomUUID(), p_token: next.raw })).code, 'ALREADY_MEMBER');
  assert.equal((await db.query('select role from public.workspace_members where workspace_id=$1 and user_id=$2', [workspace, users.member])).rows[0].role, 'viewer');
});

test('Owner role and nonmembers cannot be targeted; non-Owners cannot change any role', async () => {
  const workspace = await createTeam();
  await join(workspace, 'member');
  for (const target of ['owner', 'outsider']) {
    assert.equal((await call('owner', 'change_member_role', roleArgs(workspace, target, 'viewer'))).code, 'FORBIDDEN');
  }
  for (const role of ['member', 'viewer', 'outsider']) {
    assert.equal((await call(role, 'change_member_role', roleArgs(workspace, 'member', 'viewer'))).code, 'FORBIDDEN');
  }
  assert.equal((await call('owner', 'change_member_role', roleArgs(workspace, 'member', 'owner'))).code, 'VALIDATION');
  assert.equal((await call('owner', 'change_member_role', roleArgs(otherTeam, 'outsider', 'viewer'))).code, 'FORBIDDEN');
  assert.equal((await db.query('select owner_id from public.workspaces where id=$1', [workspace])).rows[0].owner_id, users.owner);
});

test('role changes enforce the latest role on the same JWT; stale role commands conflict and replay stays idempotent', async () => {
  const workspace = await createTeam();
  await join(workspace, 'member');
  const issueArgs = { p_workspace_id: workspace, p_request_id: randomUUID(), p_payload: { title: '역할 회수 확인' } };
  assert.equal((await call('member', 'create_issue', issueArgs)).ok, true);
  const first = roleArgs(workspace, 'member', 'viewer');
  const second = roleArgs(workspace, 'member', 'viewer');
  const changed = await Promise.all([call('owner', 'change_member_role', first), call('owner', 'change_member_role', second)]);
  assert.equal(changed.filter((result) => result.ok).length, 1);
  assert.equal(changed.find((result) => !result.ok).code, 'CONFLICT');
  const winningArgs = changed[0].ok ? first : second;
  assert.deepEqual(await call('owner', 'change_member_role', winningArgs), changed.find((result) => result.ok));
  assert.equal((await call('member', 'create_issue', { ...issueArgs, p_request_id: randomUUID() })).code, 'FORBIDDEN');
  assert.equal((await clients.member.from('issues').select('id').eq('workspace_id', workspace)).data.length, 1);
  const capabilities = await call('member', 'workspace_permissions', { p_workspace_id: workspace });
  assert.equal(capabilities.verify, false); assert.equal(capabilities.comment, false);
  assert.equal((await call('owner', 'change_member_role', roleArgs(workspace, 'member', 'member', 'viewer'))).ok, true);
  assert.equal((await call('member', 'create_issue', { ...issueArgs, p_request_id: randomUUID() })).ok, true);
});

test('membership insertion failure rolls back workspace/invite/receipt together', async () => {
  const workspace = await createTeam();
  const invite = await invitation(workspace);
  const blockedTeam = randomUUID(); created.add(blockedTeam);
  await db.query(`create function private.d3_test_membership_failure() returns trigger language plpgsql set search_path='' as $$
    begin if new.workspace_id in ('${workspace}'::uuid, '${blockedTeam}'::uuid) then raise exception 'synthetic D3 rollback'; end if; return new; end; $$`);
  await db.query('create trigger d3_test_membership_failure before insert on public.workspace_members for each row execute function private.d3_test_membership_failure()');
  try {
    const request = randomUUID();
    const accepted = await clients.member.rpc('accept_invite', { p_request_id: request, p_token: invite.raw });
    assert.ok(accepted.error);
    assert.equal(await receiptCount(request), 0);
    assert.equal((await db.query('select accepted_by from private.workspace_invites where id=$1', [invite.result.data.inviteId])).rows[0].accepted_by, null);
    const createdTeam = await clients.owner.rpc('create_workspace', { p_workspace_id: blockedTeam, p_request_id: randomUUID(), p_payload: { name: '롤백' } });
    assert.ok(createdTeam.error);
    assert.equal((await db.query('select count(*) from public.workspaces where id=$1', [blockedTeam])).rows[0].count, '0');
  } finally {
    await db.query('drop trigger d3_test_membership_failure on public.workspace_members');
    await db.query('drop function private.d3_test_membership_failure()');
  }
});

test('private invitation hashes/internal commands and auth.uid-less calls cannot bypass authorization', async () => {
  for (const sql of ['select * from private.workspace_invites', "select private.apply_workspace_command('create_workspace', gen_random_uuid(), gen_random_uuid(), '{}'::jsonb)"]) {
    await db.query('begin');
    try {
      await db.query('set local role authenticated');
      await db.query("select set_config('request.jwt.claim.sub', $1, true)", [users.owner]);
      await assert.rejects(db.query(sql), { code: '42501' });
    } finally { await db.query('rollback'); }
  }
  await db.query('begin');
  try {
    await db.query('set local role authenticated');
    const result = await db.query("select public.create_workspace(gen_random_uuid(), gen_random_uuid(), '{\"name\":\"no session\"}'::jsonb) as result");
    assert.equal(result.rows[0].result.code, 'FORBIDDEN');
  } finally { await db.query('rollback'); }
});
