import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { accountFile, localDb, localStack, root } from './local-stack.mjs';

const labels = { owner: '합성 Owner', member: '합성 Member', viewer: '합성 Viewer', outsider: '다른 팀 Owner' };
export async function createTestIdentities() {
  const stack = localStack(), run = randomUUID(), accounts = [], team = randomUUID(), other = randomUUID();
  const fixture = { run, accounts, file: resolve(root, accountFile(run)) };
  const admin = createClient(stack.API_URL, stack.SECRET_KEY || stack.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    for (const role of Object.keys(labels)) {
      const account = { role, label: labels[role], email: `${run}-${role}@reproboard.test`, password: randomBytes(24).toString('base64url'), workspaceId: role === 'outsider' ? other : team };
      const { data, error } = await admin.auth.admin.createUser({ email: account.email, password: account.password, email_confirm: true, app_metadata: { reproboard_test_run: run }, user_metadata: { display_name: account.label } });
      if (error) throw new Error('Could not prepare isolated test user');
      accounts.push({ ...account, id: data.user.id });
    }
    const db = await localDb(stack);
    try {
      await db.query('begin');
      for (const [id, role] of [[team, 'owner'], [other, 'outsider']]) await db.query('insert into public.workspaces(id,name,owner_id) values($1,$2,$3)', [id, `합성 격리 ${run} ${role}`, accounts.find((a) => a.role === role).id]);
      for (const a of accounts) await db.query('insert into public.workspace_members(workspace_id,user_id,role) values($1,$2,$3)', [a.workspaceId, a.id, a.role === 'outsider' ? 'owner' : a.role]);
      await db.query('commit');
    } catch (error) { await db.query('rollback'); throw error; } finally { await db.end(); }
    mkdirSync(dirname(fixture.file), { recursive: true });
    writeFileSync(fixture.file, JSON.stringify(accounts), { flag: 'wx', mode: 0o600 });
    return fixture;
  } catch (error) { await cleanupTestIdentities(fixture); throw error; }
}

export async function cleanupTestIdentities(fixture) {
  const db = await localDb(localStack());
  try {
    await db.query('begin');
    const ids = fixture.accounts.map((a) => a.id);
    const users = (await db.query('select id,raw_app_meta_data from auth.users where id=any($1::uuid[]) for update', [ids])).rows;
    if (users.length !== ids.length || users.some((u) => u.raw_app_meta_data?.reproboard_test_run !== fixture.run)) throw new Error('Refusing cleanup: test identity mismatch');
    const workspaces = (await db.query('select id from public.workspaces where owner_id=any($1::uuid[]) for update', [ids])).rows.map((r) => r.id);
    // If a fixture user joined someone else's team, do not widen deletion to that team.
    for (const table of ['public.notifications','public.comments','public.verification_runs','public.activity_events','private.workspace_invites','private.command_receipts','public.issues','public.workspace_members']) await db.query(`delete from ${table} where workspace_id=any($1::uuid[])`, [workspaces]);
    await db.query('delete from public.workspaces where id=any($1::uuid[])', [workspaces]);
    await db.query('delete from public.workspace_members where user_id=any($1::uuid[])', [ids]);
    await db.query('delete from public.profiles where user_id=any($1::uuid[])', [ids]);
    await db.query('delete from auth.users where id=any($1::uuid[])', [ids]);
    await db.query('commit');
  } catch (error) { await db.query('rollback'); throw error; } finally { await db.end(); }
  try { unlinkSync(fixture.file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
