/* global process, console */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { localStack, root, runCli } from './local-stack.mjs';

try {
  const [command, ...args] = process.argv.slice(2);
  if (!['migrate', 'types', 'env', 'reset'].includes(command)) throw new Error('Unknown local DB command.');
  if ((command === 'reset' && args.join(' ') !== '--confirm-local-reproboard')
    || (command !== 'reset' && args.length !== 0)) {
    throw new Error('Reset requires --confirm-local-reproboard; other commands accept no target overrides.');
  }
  const status = localStack();
  if (command === 'migrate') runCli(['migration', 'up', '--local']);
  if (command === 'reset') runCli(['db', 'reset', '--local', '--yes']);
  if (command === 'types') {
    const types = runCli(['gen', 'types', 'typescript', '--local', '--schema', 'public']);
    if (!types.includes('export type Database')) throw new Error('Type generation did not return TypeScript.');
    mkdirSync(resolve(root, 'src/lib/supabase'), { recursive: true });
    writeFileSync(resolve(root, 'src/lib/supabase/database.types.ts'), `${types.trimEnd()}\n`);
  }
  if (command === 'env') {
    const key = status.PUBLISHABLE_KEY || status.ANON_KEY;
    if (!key || key === status.SECRET_KEY || key === status.SERVICE_ROLE_KEY) throw new Error('Public client key unavailable.');
    const path = resolve(root, '.env.local');
    const content = [
      '# Generated for the guarded local reproboard stack. Never commit this file.',
      `NEXT_PUBLIC_SUPABASE_URL=${status.API_URL}`,
      `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${key}`,
      'NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000',
      'DEV_LOGIN_ENABLED=true', '',
    ].join('\n');
    if (existsSync(path)) {
      if (readFileSync(path, 'utf8') !== content) throw new Error('.env.local exists with different content; preserve it and configure local public values manually.');
    } else writeFileSync(path, content, { flag: 'wx', mode: 0o600 });
  }
  console.log(`PASS local db:${command} (reproboard, loopback only; credentials not printed)`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
