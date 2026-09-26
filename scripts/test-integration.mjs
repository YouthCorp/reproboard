/* global process, console */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readdirSync, readFileSync, mkdirSync, writeFileSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { localStack, root } from './local-stack.mjs';
import { createTestIdentities, cleanupTestIdentities } from './test-identities.mjs';

const require = createRequire(import.meta.url);
// Execute every discovered case, each with new users/teams and its own process.
// No retries, .skip, .only, or fixture sharing between cases.
function discover(directory) {
  return readdirSync(resolve(root, directory)).filter((f) => /\.(test|spec)\.mjs$/.test(f)).sort().flatMap((name) => {
    const file = `${directory}/${name}`, source = ts.createSourceFile(file, readFileSync(resolve(root,file),'utf8'), ts.ScriptTarget.Latest, true);
    const cases = [];
    for (const statement of source.statements) {
      if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) continue;
      const call = statement.expression;
      if (['test.skip','test.only','test.fixme','test.describe'].includes(call.expression.getText(source))) throw new Error('Use top-level, enabled integration cases for complete discovery');
      if (call.expression.getText(source) !== 'test') continue;
      if (!ts.isStringLiteral(call.arguments[0])) throw new Error('Integration cases must have static names for complete discovery');
      cases.push({ file, name: call.arguments[0].text });
    }
    if (!cases.length) throw new Error(`No cases discovered in ${file}`);
    if (new Set(cases.map((item) => item.name)).size !== cases.length) throw new Error(`Duplicate test names in ${file}`);
    return cases;
  });
}
function execute(args, env) {
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, args, { cwd: root, env, windowsHide: true, stdio: ['ignore','pipe','pipe'] });
    let output = '';
    child.stdout.on('data', (data) => { output += data; }); child.stderr.on('data', (data) => { output += data; });
    child.on('error', reject); child.on('close', (code) => done({ code, output }));
  });
}
let lock;
const lockPath = resolve(root,'.local/integration.lock');
try {
  const [mode, selector, ...extra] = process.argv.slice(2);
  if (!['db','ui'].includes(mode) || extra.length) throw new Error('Usage: test-integration.mjs db|ui [exact test-name substring]');
  localStack();
  mkdirSync(resolve(root,'.local'), { recursive:true });
  lock = openSync(lockPath, 'wx');
  const cases = discover(mode === 'db' ? 'tests/db' : 'tests/db-ui').filter((item) => !selector || item.name.includes(selector));
  if (!cases.length) throw new Error('No matching integration tests');
  const results = [], directory = resolve(root, `.local/integration/${Date.now()}-${mode}`); mkdirSync(directory, { recursive: true });
  for (const item of cases) {
    const fixture = await createTestIdentities();
    const env = { ...process.env, REPROBOARD_TEST_RUN: fixture.run, NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3200', NEXT_TELEMETRY_DISABLED: '1' };
    const pattern = item.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const output = resolve(directory, String(results.length + 1));
    try {
      const args = mode === 'db' ? ['--test', '--test-reporter=tap', `--test-name-pattern=^${pattern}$`, item.file] : [require.resolve('@playwright/test/cli'), 'test', '--config', 'playwright.db.config.mjs', item.file, '--grep', `${pattern}$`, '--reporter=list', `--output=${output}`];
      const result = await execute(args, env);
      writeFileSync(`${output}.log`, result.output); // Private: never upload raw HTTP/Auth diagnostics.
      const passed = result.code === 0 && (mode === 'db' ? /^# tests 1\r?$/m.test(result.output) && /^# fail 0\r?$/m.test(result.output) : /\b1 passed\b/.test(result.output));
      results.push({ ...item, result: passed ? 'PASS' : 'FAIL' });
      console.log(`${passed ? 'PASS' : 'FAIL'} ${results.length}/${cases.length} ${item.name}`);
      if (!passed) process.exitCode = 1;
    } finally { await cleanupTestIdentities(fixture); }
    writeFileSync(resolve(directory,'results.json'), JSON.stringify(results,null,2));
    if (process.exitCode) break; // Fix the failing required case before continuing.
  }
  console.log(`Executed ${results.length}/${cases.length} isolated ${mode} cases. Private logs: ${directory}`);
  mkdirSync(resolve(root,'test-results/integration'), { recursive:true });
  writeFileSync(resolve(root,`test-results/integration/${mode}.json`), JSON.stringify({ planned:cases.length, executed:results.length, results },null,2));
} catch (error) { console.error(error.code === 'EEXIST' ? 'Integration lock exists. Finish the other run; after an interrupted run inspect its users/processes before removing this local lock.' : error.message); process.exitCode = 1; }
finally { if (lock !== undefined) { closeSync(lock); unlinkSync(lockPath); } }
