import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';
import { localStack, localDb, readAccounts } from '../../scripts/local-stack.mjs';

const team = randomUUID(), clients = {}, ids = {};
let db, issue, admin, extraUser;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
before(async () => {
  const stack = localStack(); db = await localDb(stack);
  for (const account of readAccounts()) {
    clients[account.role] = createClient(stack.API_URL, stack.PUBLISHABLE_KEY || stack.ANON_KEY, options);
    assert.equal((await clients[account.role].auth.signInWithPassword({ email: account.email, password: account.password })).error, null);
    ids[account.role] = account.id;
  }
  // The admin key creates an isolated synthetic fixture only. All actions below use password sessions.
  admin = createClient(stack.API_URL, stack.SECRET_KEY || stack.SERVICE_ROLE_KEY, options);
  const email = `d9-${randomUUID()}@example.test`, password = randomUUID() + randomUUID();
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: '합성 D9 두 번째 Member' }, app_metadata: { reproboard_fixture: true } });
  assert.equal(created.error, null); extraUser = created.data.user.id; ids.member2 = extraUser;
  clients.member2 = createClient(stack.API_URL, stack.PUBLISHABLE_KEY || stack.ANON_KEY, options);
  assert.equal((await clients.member2.auth.signInWithPassword({ email, password })).error, null);
  const workspace = await clients.owner.rpc('create_workspace', { p_workspace_id: team, p_request_id: randomUUID(), p_payload: { name: '합성 D9 DB 검증 팀' } });
  assert.equal(workspace.data.ok, true);
  for (const role of ['member', 'member2', 'viewer']) await db.query('insert into public.workspace_members(workspace_id,user_id,role) values($1,$2,$3)', [team, ids[role], role === 'viewer' ? 'viewer' : 'member']);
  const createdIssue = await clients.member.rpc('create_issue', { p_workspace_id: team, p_request_id: randomUUID(), p_payload: { title: '합성 댓글 대상' } });
  assert.equal(createdIssue.data.ok, true); issue = createdIssue.data.data;
});
after(async () => {
  await Promise.all(Object.values(clients).map((client) => client.removeAllChannels()));
  if (db) {
    await db.query('begin');
    try {
      await db.query('drop trigger if exists d9_test_receipt_failure on private.command_receipts');
      await db.query('drop function if exists private.d9_test_receipt_failure()');
      for (const table of ['public.notifications', 'public.comments', 'public.verification_runs', 'public.activity_events', 'private.command_receipts', 'public.issues', 'public.workspace_members']) await db.query(`delete from ${table} where workspace_id=$1`, [team]);
      await db.query('delete from public.workspaces where id=$1', [team]);
      if (extraUser) await db.query('delete from public.profiles where user_id=$1', [extraUser]);
      await db.query('commit');
    } catch (error) { await db.query('rollback'); throw error; } finally { await db.end(); }
  }
  if (extraUser) assert.equal((await admin.auth.admin.deleteUser(extraUser)).error, null);
});
async function add(role, body, mentions = [], requestId = randomUUID(), issueId = issue.id, payload = {}) {
  const result = await clients[role].rpc('add_comment', { p_workspace_id: team, p_issue_id: issueId, p_request_id: requestId, p_payload: { body, mention_ids: mentions, ...payload } });
  assert.equal(result.error, null); return result.data;
}
async function notifications(role, commentId) {
  const result = await clients[role].from('notifications').select('*').eq('comment_id', commentId);
  assert.equal(result.error, null); return result.data;
}
async function counts(requestId) {
  return (await db.query(`select
    (select count(*)::int from public.comments where request_id=$1) comments,
    (select count(*)::int from public.activity_events where request_id=$1) activities,
    (select count(*)::int from private.command_receipts where request_id=$1) receipts,
    (select count(*)::int from public.notifications n join public.comments c on c.id=n.comment_id where c.request_id=$1) notifications`, [requestId])).rows[0];
}

test('D9 two Member sessions: concurrent replay gives one comment/activity/receipt and deduplicated non-self notifications; body version unchanged', async () => {
  const requestId = randomUUID(), recipients = [ids.member, ids.member2, ids.member2, ids.viewer];
  const [a, b] = await Promise.all([add('member', '  실제 합성 댓글  ', recipients, requestId), add('member', '  실제 합성 댓글  ', recipients, requestId)]);
  assert.equal(a.ok, true); assert.deepEqual(a, b); assert.equal(a.data.body, '실제 합성 댓글'); assert.equal(a.data.mention_ids.length, 3);
  assert.deepEqual(await counts(requestId), { comments: 1, activities: 1, receipts: 1, notifications: 2 });
  assert.equal((await notifications('member', a.data.id)).length, 0);
  assert.equal((await notifications('member2', a.data.id)).length, 1);
  assert.equal((await add('member2', '두 번째 Member의 답변', [ids.member])).ok, true);
  assert.equal((await add('member', '다른 내용', recipients, requestId)).code, 'VALIDATION');
  const cross = await clients.member.rpc('create_issue', { p_workspace_id: team, p_request_id: requestId, p_payload: { title: '명령 종류 재사용 거부' } });
  assert.equal(cross.data.code, 'VALIDATION');
  assert.deepEqual((await db.query('select version,updated_at from public.issues where id=$1', [issue.id])).rows[0], { version: issue.version, updated_at: new Date(issue.updated_at) });
});

test('D9 plaintext trim/codepoints, blank/overlong/invalid payload/foreign mentions/unknown issue reject without effects', async () => {
  const result = await add('member', '\uFEFF\u3000' + '😀'.repeat(4000) + '\u00A0');
  assert.equal(result.ok, true); assert.equal(Array.from(result.data.body).length, 4000);
  for (const [body, mentions, target, payload] of [
    [' \n\uFEFF', [], issue.id, {}], ['😀'.repeat(4001), [], issue.id, {}], ['타팀', [ids.outsider], issue.id, {}],
    ['형식', ['bad'], issue.id, {}], ['형식', [null], issue.id, {}], ['한도', Array.from({ length: 9 }, () => randomUUID()), issue.id, {}],
    ['주입', [], issue.id, { actor_id: ids.owner }], ['없음', [], randomUUID(), {}],
  ]) {
    const request = randomUUID(); assert.equal((await add('member', body, mentions, request, target, payload)).ok, false);
    assert.deepEqual(await counts(request), { comments: 0, activities: 0, receipts: 0, notifications: 0 });
  }
  const request = randomUUID();
  const raced = await Promise.all([add('member', '경합 A', [], request), add('member', '경합 B', [], request)]);
  assert.equal(raced.filter((r) => r.ok).length, 1); assert.equal(raced.filter((r) => r.code === 'VALIDATION').length, 1);
});

test('D9 Viewer reads comments/activity but cannot write; outsider and direct DML are denied; only own notifications readable', async () => {
  const created = await add('member', 'Viewer 멘션', [ids.viewer]);
  for (const role of ['viewer', 'outsider']) assert.equal((await add(role, '금지')).code, 'FORBIDDEN');
  for (const table of ['comments', 'activity_events']) {
    const viewer = await clients.viewer.from(table).select('id').eq('workspace_id', team);
    assert.equal(viewer.error, null); assert.ok(viewer.data.length > 0);
    const foreign = await clients.outsider.from(table).select('id').eq('workspace_id', team);
    assert.equal(foreign.error, null); assert.deepEqual(foreign.data, []);
  }
  assert.equal((await notifications('viewer', created.data.id)).length, 1);
  for (const role of ['owner', 'member', 'member2', 'outsider']) assert.equal((await notifications(role, created.data.id)).length, 0);
  for (const role of ['owner', 'member', 'viewer', 'outsider']) {
    for (const table of ['comments', 'notifications']) {
      for (const method of ['insert', 'update', 'delete']) {
        const response = method === 'insert' ? await clients[role].from(table).insert({}) : method === 'update'
          ? await clients[role].from(table).update(table === 'comments' ? { body: '우회' } : { read_at: new Date().toISOString() }).eq('workspace_id', team)
          : await clients[role].from(table).delete().eq('workspace_id', team);
        assert.ok(response.error, `${role} direct ${table} ${method}`);
      }
    }
  }
  const grants = await db.query("select has_function_privilege('anon','public.add_comment(uuid,uuid,uuid,jsonb)','execute') anon, has_function_privilege('authenticated','public.add_comment(uuid,uuid,uuid,jsonb)','execute') authenticated");
  assert.deepEqual(grants.rows[0], { anon: false, authenticated: true });
});

test('D9 read RPC is recipient-only, Viewer allowed, same request replays and different request does not change read time; revoked membership denies old receipt', async () => {
  const created = await add('member', '읽음 대상', [ids.viewer]);
  const [notification] = await notifications('viewer', created.data.id), request = randomUUID();
  const mark = (role, requestId, notificationId = notification.id) => clients[role].rpc('mark_notification_read', { p_workspace_id: team, p_notification_id: notificationId, p_request_id: requestId });
  assert.equal((await mark('owner', randomUUID())).data.code, 'NOT_FOUND');
  assert.equal((await mark('outsider', randomUUID())).data.code, 'FORBIDDEN');
  const a = await mark('viewer', request), b = await mark('viewer', request), c = await mark('viewer', randomUUID());
  assert.equal(a.data.ok, true); assert.deepEqual(a.data, b.data); assert.deepEqual(a.data, c.data);
  assert.equal((await mark('viewer', request, randomUUID())).data.code, 'VALIDATION');
  await db.query('delete from public.workspace_members where workspace_id=$1 and user_id=$2', [team, ids.viewer]);
  try { assert.equal((await mark('viewer', request)).data.code, 'FORBIDDEN'); assert.equal((await notifications('viewer', created.data.id)).length, 0); }
  finally { await db.query("insert into public.workspace_members values($1,$2,'viewer',now())", [team, ids.viewer]); }
});

test('D9 Done permits comments without reopening or version change, and a demoted author cannot replay an old comment receipt', async () => {
  const created = await clients.member.rpc('create_issue', { p_workspace_id: team, p_request_id: randomUUID(), p_payload: {
    title: '합성 완료 이슈', steps: '열기', expected: '표시', actual: '안 표시', environment: '로컬 Chromium', reproduction: 'reproduced',
    severity: 'S2', priority: 'P1', assignee_id: ids.member, fix_note: '수정함', target_build: 'local-d9',
  } });
  assert.equal(created.data.ok, true); let row = created.data.data;
  for (const target of ['ready', 'in_progress', 'verify', 'done']) {
    const moved = await clients.member.rpc('transition_issue', { p_workspace_id: team, p_issue_id: row.id, p_expected_version: row.version, p_request_id: randomUUID(),
      p_payload: { target_status: target, ...(target === 'done' ? { verification: { tested_build: 'local-d9', tested_environment: '로컬 Chromium' } } : {}) } });
    assert.equal(moved.data.ok, true); row = moved.data.data;
  }
  const request = randomUUID(); assert.equal((await add('member2', '완료 후 추가 정보', [], request, row.id)).ok, true);
  assert.deepEqual((await db.query('select status,version from public.issues where id=$1', [row.id])).rows[0], { status: 'done', version: row.version });
  await db.query("update public.workspace_members set role='viewer' where workspace_id=$1 and user_id=$2", [team, ids.member2]);
  try { assert.equal((await add('member2', '완료 후 추가 정보', [], request, row.id)).code, 'FORBIDDEN'); }
  finally { await db.query("update public.workspace_members set role='member' where workspace_id=$1 and user_id=$2", [team, ids.member2]); }
});

test('D9 failure at final receipt rolls comment/activity/notifications back; same id retry commits exactly once', async () => {
  const request = randomUUID();
  await db.query(`create function private.d9_test_receipt_failure() returns trigger language plpgsql set search_path='' as $$ begin if new.request_id='${request}'::uuid then raise exception 'synthetic receipt failure'; end if; return new; end $$`);
  await db.query('create trigger d9_test_receipt_failure before insert on private.command_receipts for each row execute function private.d9_test_receipt_failure()');
  try {
    const result = await clients.member.rpc('add_comment', { p_workspace_id: team, p_issue_id: issue.id, p_request_id: request, p_payload: { body: '원자성', mention_ids: [ids.member2] } });
    assert.ok(result.error); assert.deepEqual(await counts(request), { comments: 0, activities: 0, receipts: 0, notifications: 0 });
  } finally { await db.query('drop trigger d9_test_receipt_failure on private.command_receipts'); await db.query('drop function private.d9_test_receipt_failure()'); }
  assert.equal((await add('member', '원자성', [ids.member2], request)).ok, true);
  assert.deepEqual(await counts(request), { comments: 1, activities: 1, receipts: 1, notifications: 1 });
});

test('D9 actual Postgres Changes: Member and Viewer see comments/activity; only recipients receive notification insert/update; outsiders see neither', { timeout: 30_000 }, async () => {
  const events = { member: [], member2: [], viewer: [], outsider: [] }, channels = [];
  async function until(check) { for (let n = 0; n < 150; n++) { if (check()) return; await delay(100); } assert.fail('Expected authorized event missing: ' + JSON.stringify(Object.fromEntries(Object.entries(events).map(([role, values]) => [role, values.map((e) => e.table + ':' + e.event)])))); }
  try {
    for (const role of Object.keys(events)) {
      const channel = clients[role].channel(`d9-${randomUUID()}`); channels.push([role, channel]);
      for (const table of ['comments', 'activity_events', 'notifications']) channel.on('postgres_changes', { event: '*', schema: 'public', table }, (event) => events[role].push({ table, event: event.eventType, row: event.new }));
      await new Promise((resolve, reject) => channel.subscribe((state) => { if (state === 'SUBSCRIBED') resolve(); else if (['CHANNEL_ERROR', 'TIMED_OUT'].includes(state)) reject(new Error('Subscription failed')); }));
    }
    const request = randomUUID(), created = await add('member', '실제 스트림', [ids.member2, ids.viewer], request);
    await until(() => ['member', 'member2', 'viewer'].every((role) => ['comments', 'activity_events'].every((table) => events[role].some((e) => e.table === table && e.row.request_id === request)))
      && ['member2', 'viewer'].every((role) => events[role].some((e) => e.table === 'notifications' && e.row.comment_id === created.data.id)));
    const [notification] = await notifications('viewer', created.data.id);
    assert.equal((await clients.viewer.rpc('mark_notification_read', { p_workspace_id: team, p_notification_id: notification.id, p_request_id: randomUUID() })).data.ok, true);
    await until(() => events.viewer.some((e) => e.table === 'notifications' && e.event === 'UPDATE' && e.row.id === notification.id));
    await delay(1500);
    assert.equal(events.member.filter((e) => e.table === 'notifications').length, 0);
    assert.equal(events.member2.filter((e) => e.row.id === notification.id).length, 0);
    assert.equal(events.outsider.filter((e) => e.row.workspace_id === team).length, 0);
  } finally { await Promise.all(channels.map(([role, channel]) => clients[role].removeChannel(channel))); }
});
