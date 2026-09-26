/* global process, console */
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { localProjectId, root } from './local-stack.mjs';

try {
  if (process.argv.length !== 2 || resolve(process.cwd()) !== resolve(root)) throw new Error('Run from a fresh archived source root, without arguments');
  // A normal checkout/runtime must never have its Docker identity silently changed.
  if (['.git','.env','.env.local','.local','supabase/.temp','supabase/.branches'].some((p) => existsSync(resolve(root,p)))) throw new Error('Refusing existing checkout/runtime; use a fresh git archive copy');
  const path = resolve(root,'supabase/config.toml'), config = readFileSync(path,'utf8');
  if (localProjectId(config) !== 'reproboard') throw new Error('Cleanroom already prepared');
  const project = `reproboard-cleanroom-${randomBytes(6).toString('hex')}`;
  for (const args of [['volume','ls','--format','{{.Name}}'],['ps','-a','--format','{{.Names}}']]) {
    const names = execFileSync('docker',args,{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe'],timeout:15000});
    if (names.includes(project)) throw new Error('Fresh project identity already exists');
  }
  writeFileSync(path,config.replace(/^project_id\s*=\s*"reproboard"\s*$/m,`project_id = "${project}"`));
  console.log(`PASS fresh local project ${project}; original volumes untouched`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
