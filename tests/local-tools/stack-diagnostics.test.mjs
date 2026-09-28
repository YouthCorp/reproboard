import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stackFailure } from '../../scripts/stack-diagnostics.mjs';
import { assertStackOwnership, root } from '../../scripts/local-stack.mjs';

test('stack diagnostics expose only fixed categories, not CLI secrets or container logs', () => {
  const result = stackFailure({ status: 1, stderr: 'supabase_auth_reproboard is not healthy; password=private; https://secret.invalid?token=private', stdout: 'service_role=private' });
  assert.deepEqual(result, { exitCode: 1, code: 'unknown', reasons: ['health-check'], mentionedServices: ['auth'] });
  assert.deepEqual(stackFailure({ code: 'ENOBUFS', stderr: 'private arbitrary text' }), { exitCode: null, code: 'ENOBUFS', reasons: ['unclassified'], mentionedServices: [] });
  for (const [message, category] of [['failed to pull image', 'image-download'], ['no space left on device', 'disk-full'], ['address already in use', 'port-conflict'], ['Cannot connect to the Docker daemon', 'docker-unavailable'], ['context deadline exceeded', 'timeout']]) {
    assert.deepEqual(stackFailure({ stderr: message }).reasons, [category]);
  }
});

test('cleanup permits stopped or absent containers but rejects a foreign checkout or missing identity', () => {
  const owned = { State: { Running: false }, Config: { Labels: { 'com.supabase.cli.project': 'reproboard', 'com.supabase.cli.workdir': root } } };
  assert.doesNotThrow(() => assertStackOwnership([], 'reproboard'));
  assert.doesNotThrow(() => assertStackOwnership([owned], 'reproboard'));
  assert.throws(() => assertStackOwnership([owned], 'other-project'));
  assert.throws(() => assertStackOwnership([owned], 'reproboard', '/different-checkout'));
  assert.throws(() => assertStackOwnership([{}], 'reproboard'));
  for (const workdir of [undefined, '']) {
    assert.throws(() => assertStackOwnership([{ Config: { Labels: { 'com.supabase.cli.project': 'reproboard', 'com.supabase.cli.workdir': workdir } } }], 'reproboard'));
  }
});
