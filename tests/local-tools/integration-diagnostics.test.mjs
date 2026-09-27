import { test } from 'node:test';
import assert from 'node:assert/strict';
import { failureSummary } from '../../scripts/integration-diagnostics.mjs';

test('CI summary identifies assertion and missing Realtime delivery without exporting rows or secrets', () => {
  const output = "  failureType: 'testCodeFailure'\n  code: 'ERR_ASSERTION'\n  error: 'Expected authorized event missing: secret-user-row'\nAuthorization: Bearer private-token\n";
  assert.deepEqual(failureSummary(output, 1), { exitCode: 1, failureType: 'testCodeFailure', code: 'ERR_ASSERTION', reason: 'missing-realtime-event' });
});
test('CI summary preserves timeout classification and rejects unrecognized diagnostic text', () => {
  assert.deepEqual(failureSummary("  failureType: 'testTimeoutFailure'\n  code: 'ERR_TEST_FAILURE'\n", 1), { exitCode: 1, failureType: 'testTimeoutFailure', code: 'ERR_TEST_FAILURE', reason: 'test-timeout' });
  assert.deepEqual(failureSummary("  failureType: 'private-token'\n  code: 'password'\nhttps://secret.example/?token=private\n", null), { exitCode: null, failureType: 'unknown', code: 'unknown', reason: 'inspect-private-log' });
});
