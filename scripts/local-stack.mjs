/* global process, URL */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { stackFailure } from './stack-diagnostics.mjs';

export const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const cli = resolve(dirname(require.resolve('supabase/package.json')), 'dist/supabase.js');

export function runCli(args) {
  try {
    return execFileSync(process.execPath, [cli, ...args], {
      cwd: root, encoding: 'utf8', windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'], timeout: args[0] === 'start' ? 600_000 : 180_000, maxBuffer: 8 * 1024 * 1024,
    });
  } catch (error) {
    // CLI errors can include URLs/keys. Do not forward raw stdout/stderr.
    // eslint-disable-next-line preserve-caught-error -- Raw cause contains CLI credentials; only allowlisted diagnostics may escape.
    throw new Error(`Local Supabase command failed (${args.slice(0, 2).join(' ')}). Safe diagnostics: ${JSON.stringify(stackFailure(error))}`);
  }
}

export function localProjectId(config) {
  const id = /^project_id\s*=\s*"([^"]+)"\s*$/m.exec(config)?.[1];
  if (id !== 'reproboard' && !/^reproboard-cleanroom-[0-9a-f]{12}$/.test(id ?? '')) throw new Error('Unexpected local project id');
  return id;
}

// Cleanup must also work after a failed start, when status/DB health is unavailable.
// Validate ownership independently; never accept another checkout's containers.
export function assertStackOwnership(containers, project, workdir = root) {
  for (const container of containers) {
    const labels = container.Config?.Labels ?? {};
    if (labels['com.supabase.cli.project'] !== project
      || typeof labels['com.supabase.cli.workdir'] !== 'string'
      || !labels['com.supabase.cli.workdir']
      || resolve(labels['com.supabase.cli.workdir']) !== resolve(workdir)) {
      throw new Error('Refusing stack cleanup: Docker container belongs to another project or checkout.');
    }
  }
}

export function stopLocalStack() {
  if (resolve(process.cwd()) !== resolve(root)) throw new Error('Run from the repository root.');
  const project = localProjectId(readFileSync(resolve(root, 'supabase/config.toml'), 'utf8'));
  const options = { cwd: root, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 15_000 };
  let containers;
  try {
    const ids = execFileSync('docker', ['ps', '-aq', '--filter', `label=com.supabase.cli.project=${project}`], options).trim().split(/\s+/).filter(Boolean);
    containers = ids.length ? JSON.parse(execFileSync('docker', ['inspect', ...ids], options)) : [];
  } catch { throw new Error('Cannot verify Docker ownership for local stack cleanup.'); }
  assertStackOwnership(containers, project);
  runCli(['stop']); // Project scoped, default backup enabled; no volume deletion.
}

export function assertLocalTarget(status, container, config, cwd = root) {
  const project = localProjectId(config);
  if (resolve(cwd) !== resolve(root)) {
    throw new Error('Run from the reproboard repository with its local project config.');
  }
  const api = new URL(status.API_URL);
  const db = new URL(status.DB_URL);
  if (api.origin !== 'http://127.0.0.1:54321' || api.pathname !== '/' || api.username || api.password || api.search || api.hash
    || !['postgres:', 'postgresql:'].includes(db.protocol) || db.hostname !== '127.0.0.1'
    || db.port !== '54322' || db.pathname !== '/postgres' || db.username !== 'postgres' || db.search || db.hash) {
    throw new Error('Refusing a non-local or unexpected Supabase target.');
  }
  const labels = container.Config?.Labels ?? {};
  const ports = container.NetworkSettings?.Ports?.['5432/tcp'] ?? [];
  if (container.Name !== `/supabase_db_${project}` || container.State?.Running !== true
    || labels['com.supabase.cli.project'] !== project
    || resolve(labels['com.supabase.cli.workdir'] ?? '') !== resolve(root)
    || !ports.some((port) => port.HostPort === '54322' && ['127.0.0.1', '0.0.0.0', '::'].includes(port.HostIp))) {
    throw new Error('Local Docker database identity or port does not match this repository.');
  }
}

export function localStack() {
  const config = readFileSync(resolve(root, 'supabase/config.toml'), 'utf8');
  const project = localProjectId(config);
  const status = JSON.parse(runCli(['status', '--output', 'json']));
  let container;
  try {
    container = JSON.parse(execFileSync('docker', ['inspect', `supabase_db_${project}`], {
      cwd: root, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 15_000,
    }))[0];
  } catch { throw new Error('Start the local Docker/Supabase stack first.'); }
  assertLocalTarget(status, container, config, process.cwd());
  return status;
}

export async function localDb(status) {
  const db = new pg.Client({ connectionString: status.DB_URL, ssl: false, connectionTimeoutMillis: 5000 });
  await db.connect();
  return db;
}

export function readAccounts() {
  return JSON.parse(readFileSync(resolve(root, accountFile()), 'utf8'));
}

export function accountFile(run = process.env.REPROBOARD_TEST_RUN) {
  if (run === undefined) return '.local/dev-accounts.json';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(run)) throw new Error('Invalid isolated test identity');
  return `.local/test-runs/${run}/accounts.json`;
}
export function testTeam(role = 'owner') {
  return process.env.REPROBOARD_TEST_RUN ? readAccounts().find((a) => a.role === role).workspaceId : role === 'outsider' ? 'b2000000-0000-4000-8000-000000000002' : 'a1000000-0000-4000-8000-000000000001';
}
export const testBaseURL = process.env.REPROBOARD_TEST_RUN ? 'http://127.0.0.1:3200' : 'http://127.0.0.1:3000';
