/* global process, console */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { resolve, sep } from 'node:path';
import { root } from './local-stack.mjs';

try {
  if (process.argv.length !== 2 || resolve(process.cwd()) !== resolve(root)) throw new Error('Run from the source root without arguments');
  const report = JSON.parse(readFileSync(resolve(root,'.local/demo/report.json'),'utf8'));
  const specs = (suites) => suites.flatMap((s) => [...(s.specs ?? []), ...specs(s.suites ?? [])]);
  const cases = specs(report.suites);
  const prefixes = ['D5 UI completes','D7 two browser users race','D6 delayed A','D8 A offline'];
  if (cases.length !== 4 || prefixes.some((p) => cases.filter((s) => s.title.startsWith(p)).length !== 1)
    || cases.some((s) => s.tests.length !== 1 || s.tests[0].results.length !== 1 || s.tests[0].results[0].status !== 'passed')
    || report.errors?.length) throw new Error('Export requires all four demo cases to pass once');
  const names = {
    'isolated-failure': 'd13-isolated-failure', 'd6-request-isolation': 'd13-request-isolation',
    'd7-conflict': 'd13-conflict', 'd7-owner': 'd13-owner', 'd7-member': 'd13-member',
    'd13-offline-draft': 'd13-offline-draft', 'd13-recovered-draft': 'd13-recovered-draft',
    'd8-offline-recovery': 'd13-offline-recovery', 'd13-board': 'd13-board', 'd13-ready-missing': 'd13-ready-missing',
    'd5-verification-dialog': 'd13-verification-dialog', 'd5-done-history': 'd13-done-history', 'video': 'd13-normal-flow',
  };
  const output = resolve(root,'.local/demo/export'); mkdirSync(output,{recursive:true});
  const evidence = [];
  for (const spec of cases) for (const a of spec.tests[0].results[0].attachments ?? []) {
    if (!names[a.name] || !['image/png','video/webm'].includes(a.contentType)) continue;
    if (a.path && !resolve(a.path).startsWith(resolve(root,'test-results/demo') + sep)) throw new Error('Attachment is outside the demo output');
    const data = a.path ? readFileSync(a.path) : Buffer.from(a.body,'base64');
    const file = names[a.name] + (a.contentType === 'image/png' ? '.png' : '.webm');
    if (evidence.some((e) => e.file === file)) throw new Error('Duplicate attachment');
    writeFileSync(resolve(output,file),data);
    evidence.push({file,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});
  }
  if (evidence.length !== 13) throw new Error('Expected eight captures and five recordings');
  writeFileSync(resolve(output,'d13-demo-results.json'), JSON.stringify({
    synthetic: true, startTime: report.stats.startTime, durationMs: report.stats.duration,
    passed: 4, failed: 0, retries: 0, browser: 'Chromium',
    cases: cases.map((s) => ({name:s.title,result:'PASS',durationMs:s.tests[0].results[0].duration})), evidence,
  },null,2)+'\n');
  console.log('PASS exported 8 PNG, 5 WebM and sanitized result manifest to .local/demo/export; inspect before publishing');
} catch (error) { console.error(error.message); process.exitCode = 1; }
