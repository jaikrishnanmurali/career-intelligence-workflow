import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  completeSetupStage,
  readSetupProgress,
  SETUP_STAGES,
  setupStatus,
} from '../scripts/setup-progress.mjs';

test('setup progress resumes at the first incomplete guided stage', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'career-intelligence-onboarding-'));
  const progressPath = path.join(temp, 'setup-progress.json');
  try {
    let progress = await readSetupProgress(progressPath);
    assert.equal(setupStatus(progress).next.id, 'environment');
    await completeSetupStage('environment', progressPath, new Date('2026-08-02T10:00:00.000Z'));
    progress = await readSetupProgress(progressPath);
    assert.equal(setupStatus(progress).next.id, 'career_ops');
    const saved = JSON.parse(await readFile(progressPath, 'utf8'));
    assert.deepEqual(Object.keys(saved).sort(), ['completed', 'schemaVersion']);
    assert.equal(saved.completed.environment, '2026-08-02T10:00:00.000Z');
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test('guided onboarding covers all stages and critical recovery paths', async () => {
  const text = await readFile(new URL('../docs/ONBOARDING.md', import.meta.url), 'utf8');
  assert.equal(SETUP_STAGES.length, 8);
  for (const { id, label } of SETUP_STAGES) {
    assert.match(text, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    assert.ok(text.includes(`\`${id}\``), `Missing setup stage id: ${id}`);
  }
  for (const expected of [
    'ChatGPT or Claude website',
    'Wrong folder',
    'public',
    'zero matching jobs',
    'prepared',
    'Smart worker fails',
    'Interrupted conversation',
    'Hired outcome',
  ]) {
    assert.match(text, new RegExp(expected, 'i'));
  }
});

test('the public first prompt routes local and website users into the same safe flow', async () => {
  const text = await readFile(new URL('../docs/FIRST_PROMPT.md', import.meta.url), 'utf8');
  assert.match(text, /Codex or Claude Code/);
  assert.match(text, /website chat/);
  assert.match(text, /Start with Stage 1 only/);
  assert.match(text, /Do not ask me to paste credentials/);
  assert.match(text, /Do not enable a schedule.*send the first email/s);
});
