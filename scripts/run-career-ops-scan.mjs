#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SCAN_HISTORY_HEADER, validateCareerOpsRoot } from '../src/career-ops.mjs';
import { atomicWriteJson } from '../src/util.mjs';

const EXTENSION_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CAREER_OPS_ROOT = path.resolve(
  process.env.CAREER_OPS_ROOT || path.join(EXTENSION_ROOT, '..', '..'),
);
const STATE_ROOT = path.join(EXTENSION_ROOT, 'state');

async function historyText() {
  try {
    const text = await readFile(path.join(CAREER_OPS_ROOT, 'data', 'scan-history.tsv'), 'utf8');
    return text || `${SCAN_HISTORY_HEADER}\n`;
  } catch (error) {
    if (error?.code === 'ENOENT') return `${SCAN_HISTORY_HEADER}\n`;
    throw error;
  }
}

function runOfficialScanner() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scan.mjs'], {
      cwd: CAREER_OPS_ROOT,
      stdio: 'inherit',
      env: { ...process.env, CAREER_INTELLIGENCE_SCHEDULED: '1' },
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Career Ops scan.mjs exited with code ${code}.`));
    });
  });
}

const workspace = await validateCareerOpsRoot(CAREER_OPS_ROOT, { requirePrivateInputs: false });
await mkdir(STATE_ROOT, { recursive: true });
await writeFile(path.join(STATE_ROOT, 'before-scan.tsv'), await historyText(), 'utf8');
const startedAt = new Date().toISOString();
await runOfficialScanner();
await atomicWriteJson(path.join(STATE_ROOT, 'career-ops-scan-result.json'), {
  schemaVersion: 1,
  status: 'completed_structured',
  startedAt,
  completedAt: new Date().toISOString(),
  careerOpsVersion: workspace.version,
  scanner: 'career-ops/scan.mjs',
});
process.stdout.write(`Career Ops ${workspace.version} structured scan completed.\n`);
