/* global process, console */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { localProjectId, localStack, root, runCli } from './local-stack.mjs';

try {
  const [action, ...extra] = process.argv.slice(2);
  if (!['start','stop'].includes(action) || extra.length || resolve(process.cwd()) !== resolve(root)) throw new Error('Only the repository local stack may be managed');
  localProjectId(readFileSync(resolve(root,'supabase/config.toml'),'utf8'));
  if (action === 'start') { runCli(['start']); localStack(); }
  else { localStack(); runCli(['stop']); }
  console.log(`PASS local stack ${action}; CLI credentials suppressed, volumes preserved`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
