/* global console, process */
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { localDb, localStack, root } from './local-stack.mjs';

const roles = ['owner', 'member', 'viewer', 'outsider'];
const labels = { owner: '합성 Owner', member: '합성 Member', viewer: '합성 Viewer', outsider: '다른 팀 Owner' };
const teamA = 'a1000000-0000-4000-8000-000000000001';
const teamB = 'b2000000-0000-4000-8000-000000000002';

try {
  if (process.argv.length !== 2) throw new Error('Seed accepts no URL or target overrides.');
  const status = localStack();
  const db = await localDb(status);
  try {
    const path = resolve(root, '.local/dev-accounts.json');
    const previous = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : [];
    const accounts = roles.map((role) => ({ role, label: labels[role], email: `${role}@reproboard.test`,
      password: previous.find((item) => item.role === role)?.password ?? randomBytes(24).toString('base64url') }));
    const admin = createClient(status.API_URL, status.SECRET_KEY || status.SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } });
    for (const account of accounts) {
      const existing = await db.query('select id, raw_app_meta_data from auth.users where email = $1', [account.email]);
      if (existing.rows.length) {
        const user = existing.rows[0];
        if (user.raw_app_meta_data?.reproboard_fixture !== true) throw new Error('Reserved fixture email belongs to a non-fixture user; seed stopped.');
        const { error } = await admin.auth.admin.updateUserById(user.id, { password: account.password, email_confirm: true });
        if (error) throw new Error(`Could not refresh synthetic ${account.role} account.`);
        account.id = user.id;
      } else {
        const { data, error } = await admin.auth.admin.createUser({ email: account.email, password: account.password,
          email_confirm: true, app_metadata: { reproboard_fixture: true }, user_metadata: { display_name: account.label } });
        if (error) throw new Error(`Could not create synthetic ${account.role} account.`);
        account.id = data.user.id;
      }
    }
    await db.query('begin');
    try {
      for (const [id, name, ownerRole] of [[teamA, '합성 ReproBoard 팀', 'owner'], [teamB, '합성 격리 팀', 'outsider']]) {
        const owner = accounts.find((account) => account.role === ownerRole);
        const existing = await db.query('select name, owner_id from public.workspaces where id = $1', [id]);
        if (existing.rows.length && (existing.rows[0].name !== name || existing.rows[0].owner_id !== owner.id)) {
          throw new Error('Fixture workspace id already belongs to different data; seed stopped.');
        }
        await db.query('insert into public.workspaces (id, name, owner_id) values ($1, $2, $3) on conflict (id) do nothing', [id, name, owner.id]);
      }
      for (const account of accounts) {
        const workspace = account.role === 'outsider' ? teamB : teamA;
        const role = account.role === 'outsider' ? 'owner' : account.role;
        await db.query(`insert into public.workspace_members (workspace_id, user_id, role) values ($1,$2,$3)
          on conflict (workspace_id,user_id) do update set role = excluded.role`, [workspace, account.id, role]);
      }
      await db.query('commit');
    } catch (error) { await db.query('rollback'); throw error; }
    mkdirSync(resolve(root, '.local'), { recursive: true });
    writeFileSync(path, JSON.stringify(accounts, null, 2) + '\n', { mode: 0o600 });
    console.log('PASS synthetic local seed: 4 accounts, 2 teams; existing issues preserved. Credentials written only to ignored .local/dev-accounts.json.');
  } finally { await db.end(); }
} catch (error) {
  // Do not expose driver/HTTP details that might contain connection credentials.
  console.error(error.code ? `Local seed failed (${error.code}).` : error.message);
  process.exitCode = 1;
}
