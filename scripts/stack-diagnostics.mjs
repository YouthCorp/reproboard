// Export fixed classifications only; CLI output may contain connection strings and keys.
export function stackFailure(error) {
  const output = String(error.stderr ?? '') + '\n' + String(error.stdout ?? '');
  const reasons = [];
  if (/unhealthy|not healthy|health check|healthcheck/i.test(output)) reasons.push('health-check');
  if (/no space left on device/i.test(output)) reasons.push('disk-full');
  if (/port is already allocated|address already in use/i.test(output)) reasons.push('port-conflict');
  if (/cannot connect to the docker daemon|is the docker daemon running/i.test(output)) reasons.push('docker-unavailable');
  if (/failed to pull|pull access denied|toomanyrequests|manifest unknown|error pulling/i.test(output)) reasons.push('image-download');
  if (/timeout|timed out|deadline exceeded/i.test(output)) reasons.push('timeout');
  const code = ['ETIMEDOUT', 'ENOBUFS', 'ENOENT', 'EACCES'].includes(error.code) ? error.code : 'unknown';
  const services = ['db', 'auth', 'rest', 'realtime', 'kong', 'studio', 'pg_meta', 'storage', 'edge_runtime', 'analytics', 'vector', 'inbucket']
    .filter((service) => output.includes(`supabase_${service}_`));
  return { exitCode: Number.isInteger(error.status) ? error.status : null, code, reasons: reasons.length ? reasons : ['unclassified'], mentionedServices: services };
}
