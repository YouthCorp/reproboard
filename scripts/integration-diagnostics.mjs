// Raw TAP/HTTP errors can contain tokens and account data. Export only fixed labels.
export function failureSummary(output, exitCode) {
  const failureType = /^\s+failureType: '(testCodeFailure|testTimeoutFailure|hookFailed|cancelledByParent)'\r?$/m.exec(output)?.[1] ?? 'unknown';
  const code = /^\s+code: '(ERR_ASSERTION|ERR_TEST_FAILURE|ETIMEDOUT|ECONNREFUSED)'\r?$/m.exec(output)?.[1] ?? 'unknown';
  const reason = /Expected authorized (Realtime event was not received|event missing:)/.test(output)
    ? 'missing-realtime-event' : failureType === 'testTimeoutFailure' ? 'test-timeout' : 'inspect-private-log';
  return { exitCode: Number.isInteger(exitCode) ? exitCode : null, failureType, code, reason };
}
