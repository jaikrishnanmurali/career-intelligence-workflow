import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdtemp,
  readFile,
  rm,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  manualSlotId,
  scheduleDecision,
  slotIdFor,
} from '../src/schedule.mjs';

test('creates stable local morning and evening slot IDs', () => {
  const date = new Date('2026-07-30T12:00:00.000Z');
  assert.equal(
    slotIdFor(date, '23 7 * * *', 'Europe/Stockholm'),
    '2026-07-30-morning',
  );
  assert.equal(
    slotIdFor(date, '43 19 * * *', 'Europe/Stockholm'),
    '2026-07-30-evening',
  );
  assert.equal(manualSlotId('123456'), 'manual-123456');
});

test('skips a slot that was already delivered', () => {
  const decision = scheduleDecision({
    state: {
      runs: [{
        at: '2026-07-30T17:23:00.000Z',
        slotId: '2026-07-30-evening',
        deliveryStatus: 'deduplicated',
      }],
    },
    slotId: '2026-07-30-evening',
    now: new Date('2026-07-30T17:43:00.000Z'),
  });
  assert.equal(decision.shouldRun, false);
  assert.match(decision.reason, /already delivered/);
});

test('legacy successful runs suppress near-term retry attempts', () => {
  const decision = scheduleDecision({
    state: {
      runs: [{
        at: '2026-07-30T17:23:00.000Z',
        resendId: 'email_legacy',
      }],
    },
    slotId: '2026-07-30-evening',
    now: new Date('2026-07-30T17:43:00.000Z'),
  });
  assert.equal(decision.shouldRun, false);
  assert.match(decision.reason, /hours ago/);
});

test('runs an undelivered slot and permits an explicit manual run', () => {
  assert.equal(scheduleDecision({
    state: { runs: [] },
    slotId: '2026-07-30-evening',
  }).shouldRun, true);

  assert.equal(scheduleDecision({
    state: {
      runs: [{
        at: '2026-07-30T17:23:00.000Z',
        slotId: '2026-07-30-evening',
        resendId: 'email_123',
      }],
    },
    slotId: '2026-07-30-evening',
    force: true,
  }).shouldRun, true);
});


test('guard-only mode writes a skip decision without scanning or emailing', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'career-intelligence-guard-'));
  const outputPath = path.join(temp, 'github-output.txt');
  try {
    const result = spawnSync(process.execPath, ['src/schedule-guard.mjs'], {
      cwd: path.resolve(import.meta.dirname, '..'),
      encoding: 'utf8',
      env: {
        ...process.env,
        CAREER_PROFILE_PATH: path.resolve(
          import.meta.dirname,
          '..',
          'config',
          'profile.example.yml',
        ),
        EVENT_NAME: 'workflow_dispatch',
        RUN_MODE: 'guard-only',
        GITHUB_RUN_ID: '123456',
        GITHUB_OUTPUT: outputPath,
      },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^SKIP manual-123456:/);
    const outputs = await readFile(outputPath, 'utf8');
    assert.match(outputs, /^should_run=false$/m);
    assert.match(outputs, /^slot_id=manual-123456$/m);
    assert.match(outputs, /^reason=Guard-only check:/m);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
