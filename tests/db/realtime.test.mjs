import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';
import { localDb, localStack, readAccounts, testTeam } from '../../scripts/local-stack.mjs';

test('D7 publication retains RLS: actual Viewer stream reads own team, outsider stream excludes it', { timeout: 30_000 }, async () => {
  const stack = localStack(), db = await localDb(stack), accounts = readAccounts(), clients = {}, issueIds = [], requestIds = [];
  const team = testTeam(), otherTeam = testTeam('outsider');
  const events = { viewer: [], outsider: [] };
  async function until(condition) {
    for (let n = 0; n < 100; n++) { if (condition()) return; await delay(100); }
    assert.fail('Expected authorized Realtime event was not received');
  }
  async function create(role, workspaceId) {
    const requestId = randomUUID(); requestIds.push(requestId);
    const result = await clients[role].rpc('create_issue', { p_workspace_id: workspaceId, p_request_id: requestId, p_payload: { title: '합성 D7 RLS 실제 스트림' } });
    assert.equal(result.error, null); assert.equal(result.data.ok, true); issueIds.push(result.data.data.id); return result.data.data;
  }
  try {
    assert.deepEqual((await db.query("select schemaname,tablename from pg_catalog.pg_publication_tables where pubname='supabase_realtime' order by schemaname,tablename")).rows,
      ['activity_events', 'comments', 'issues', 'notifications'].map((tablename) => ({ schemaname: 'public', tablename })));
    assert.equal((await db.query("select relrowsecurity from pg_catalog.pg_class where oid='public.issues'::regclass")).rows[0].relrowsecurity, true);
    for (const role of ['owner', 'viewer', 'outsider']) {
      const account = accounts.find((a) => a.role === role);
      clients[role] = createClient(stack.API_URL, stack.PUBLISHABLE_KEY || stack.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
      assert.equal((await clients[role].auth.signInWithPassword({ email: account.email, password: account.password })).error, null);
    }
    for (const role of ['viewer', 'outsider']) {
      await new Promise((resolve, reject) => {
        clients[role].channel(`d7-rls-${role}-${randomUUID()}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'issues' }, (event) => events[role].push(event.new))
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'issues' }, (event) => events[role].push(event.new))
          .subscribe((state) => { if (state === 'SUBSCRIBED') resolve(); else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') reject(new Error('Realtime subscription failed')); });
      });
    }
    const own = await create('owner', team), foreign = await create('outsider', otherTeam);
    const requestId = randomUUID(); requestIds.push(requestId);
    const result = await clients.owner.rpc('update_issue', { p_workspace_id: team, p_issue_id: own.id, p_expected_version: own.version, p_request_id: requestId, p_payload: { environment: '팀 구성원에게만 보이는 합성 내용' } });
    assert.equal(result.data.ok, true);
    await until(() => events.viewer.some((event) => event.id === own.id && event.version === 2) && events.outsider.some((event) => event.id === foreign.id));
    // Bounded absence observation after both authorized streams demonstrated delivery.
    await delay(2000);
    assert.equal(events.outsider.some((event) => event.workspace_id === team), false);
    assert.equal(events.viewer.some((event) => event.workspace_id === otherTeam), false);
    assert.deepEqual((await clients.outsider.from('issues').select('*').eq('id', own.id)).data, []);
    assert.equal((await clients.viewer.from('issues').select('id').eq('id', own.id)).data.length, 1);
  } finally {
    for (const client of Object.values(clients)) { await client.removeAllChannels(); client.realtime.disconnect(); }
    async function cleanup() {
      await db.query('begin');
      try {
      await db.query('delete from public.activity_events where issue_id=any($1::uuid[])', [issueIds]);
      await db.query('delete from private.command_receipts where request_id=any($1::uuid[])', [requestIds]);
      await db.query('delete from public.issues where id=any($1::uuid[])', [issueIds]);
      await db.query('commit');
      } catch (error) { await db.query('rollback'); throw error; } finally { await db.end(); }
    }
    await cleanup();
  }
});
