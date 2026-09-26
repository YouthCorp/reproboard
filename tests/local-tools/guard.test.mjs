/* global structuredClone, process */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { accountFile, assertLocalTarget, root } from '../../scripts/local-stack.mjs';

const status = { API_URL: 'http://127.0.0.1:54321', DB_URL: 'postgresql://postgres:placeholder@127.0.0.1:54322/postgres' };
const container = {
  Name: '/supabase_db_reproboard', State: { Running: true },
  Config: { Labels: { 'com.supabase.cli.project': 'reproboard', 'com.supabase.cli.workdir': root } },
  NetworkSettings: { Ports: { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '54322' }] } },
};

test('test identity paths cannot escape the ignored local directory or fall back on malformed ids', () => {
  assert.equal(accountFile('12345678-1234-4567-8123-123456789abc'), '.local/test-runs/12345678-1234-4567-8123-123456789abc/accounts.json');
  for (const run of ['', '../dev-accounts', 'C:/secret', 'test', '12345678-1234-4567-8123-123456789abc/..']) assert.throws(() => accountFile(run));
});
test('allows the exact local project and refuses remote URLs, altered ports, credentials-in-API and wrong Docker identity', () => {
  assert.doesNotThrow(() => assertLocalTarget(status, container, 'project_id = "reproboard"'));
  for (const changes of [
    { API_URL: 'https://project.supabase.co' },
    { API_URL: 'http://user:placeholder@127.0.0.1:54321' },
    { API_URL: 'http://127.0.0.1:54321/?forward=remote' },
    { DB_URL: 'postgresql://postgres:placeholder@remote.example:54322/postgres' },
    { DB_URL: 'postgresql://postgres:placeholder@127.0.0.1:5432/postgres' },
    { DB_URL: 'postgresql://postgres:placeholder@127.0.0.1:54322/production' },
  ]) assert.throws(() => assertLocalTarget({ ...status, ...changes }, container, 'project_id = "reproboard"'));
  const wrong = structuredClone(container);
  wrong.Config.Labels['com.supabase.cli.project'] = 'another-project';
  assert.throws(() => assertLocalTarget(status, wrong, 'project_id = "reproboard"'));
  assert.throws(() => assertLocalTarget(status, container, 'project_id = "other"'));
  assert.throws(() => assertLocalTarget(status, container, 'project_id = "reproboard"', '/different/repo'));
});

test('reset without an exact local confirmation and target overrides stop before any DB command', () => {
  for (const args of [['reset'], ['reset', '--linked'], ['reset', '--confirm-local-reproboard', '--db-url', 'remote'], ['migrate', '--linked']]) {
    const result = spawnSync(process.execPath, [resolve(root, 'scripts/local-db.mjs'), ...args], {
      cwd: root, encoding: 'utf8', windowsHide: true,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /requires --confirm-local-reproboard/);
    assert.doesNotMatch(result.stdout, /PASS/);
  }
});

test('isolated integration runner refuses unknown modes before touching the local stack', () => {
  const result = spawnSync(process.execPath, [resolve(root, 'scripts/test-integration.mjs'), 'reset', '--linked'], { cwd: root, encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage:/);
  assert.doesNotMatch(result.stdout, /PASS/);
});

test('cleanroom remains loopback and bound to its own Docker identity and source directory', () => {
  const id = 'reproboard-cleanroom-abcdef123456', config = `project_id = "${id}"`;
  const copy = structuredClone(container);
  copy.Name = `/supabase_db_${id}`;
  copy.Config.Labels['com.supabase.cli.project'] = id;
  assert.doesNotThrow(() => assertLocalTarget(status, copy, config));
  assert.throws(() => assertLocalTarget(status, container, config));
  assert.throws(() => assertLocalTarget({ ...status, API_URL: 'https://project.supabase.co' }, copy, config));
  copy.Config.Labels['com.supabase.cli.workdir'] = '/another/source';
  assert.throws(() => assertLocalTarget(status, copy, config));
});

test('cleanroom preparation refuses to alter an existing checkout', () => {
  const result = spawnSync(process.execPath, [resolve(root, 'scripts/prepare-cleanroom.mjs')], { cwd: root, encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Refusing existing checkout\/runtime/);
});
