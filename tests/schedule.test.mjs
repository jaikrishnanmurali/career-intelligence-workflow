import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { manualSlotId, scheduleDecision, slotIdFor } from '../src/schedule.mjs';

test('creates stable local morning and evening slot IDs', () => {
  const date = new Date('2026-07-30T12:00:00.000Z');
  assert.equal(slotIdFor(date, '23 7 * * *', 'Europe/Stockholm'), '2026-07-30-morning');
  assert.equal(slotIdFor(date, '43 19 * * *', 'Europe/Stockholm'), '2026-07-30-evening');
  assert.equal(manualSlotId('123456'), 'manual-123456');
});

test('a delivered outbox cannot be resent, even with force', () => {
  const state = { outbox: { slot: { status: 'delivered' } }, runs: [] };
  assert.equal(scheduleDecision({ state, slotId: 'slot' }).shouldRun, false);
  assert.equal(scheduleDecision({ state, slotId: 'slot', force: true }).shouldRun, false);
});

test('a durable prepared email resumes delivery without rescanning', () => {
  const decision = scheduleDecision({
    state: { outbox: { slot: { status: 'prepared' } }, runs: [] },
    slotId: 'slot',
  });
  assert.equal(decision.shouldRun, true);
  assert.equal(decision.resumeDelivery, true);
  assert.match(decision.reason, /awaiting delivery/);
});

test('legacy accepted runs suppress near-term retry attempts', () => {
  const decision = scheduleDecision({
    state: { runs: [{ at: '2026-07-30T17:23:00.000Z', resendId: 'email_legacy' }] },
    slotId: '2026-07-30-evening',
    now: new Date('2026-07-30T17:43:00.000Z'),
  });
  assert.equal(decision.shouldRun, false);
  assert.match(decision.reason, /hours ago/);
});

test('an active pause blocks scans and prepared deliveries', () => {
  const decision = scheduleDecision({
    state: {
      paused: { reason: 'Hired.', until: null },
      outbox: { slot: { status: 'prepared' } },
    },
    slotId: 'slot',
  });
  assert.equal(decision.shouldRun, false);
  assert.equal(decision.resumeDelivery, false);
  assert.match(decision.reason, /paused.*Hired/i);
});

test('an undelivered slot runs and a fresh manual slot can be forced', () => {
  assert.equal(scheduleDecision({ state: { runs: [] }, slotId: 'slot' }).shouldRun, true);
  assert.equal(scheduleDecision({ state: { runs: [] }, slotId: 'manual-new', force: true }).shouldRun, true);
});

test('a completed zero-result slot suppresses fallback attempts', () => {
  const state = {
    outbox: { morning: { status: 'no-recommendations' } },
    runs: [{ at: '2026-07-30T08:00:00.000Z', slotId: 'morning', deliveryStatus: 'no-recommendations' }],
  };
  const decision = scheduleDecision({ state, slotId: 'morning', now: new Date('2026-07-30T08:20:00.000Z') });
  assert.equal(decision.shouldRun, false);
  assert.match(decision.reason, /no recommendations/i);
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
        CAREER_INTELLIGENCE_CONFIG: path.resolve(import.meta.dirname, '..', 'config', 'profile.example.yml'),
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
    assert.match(outputs, /^resume_delivery=false$/m);
    assert.match(outputs, /^mode=discovery$/m);
    assert.match(outputs, /^provider=codex$/m);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test('the model flag never disables a structured run', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'career-intelligence-agent-gate-'));
  try {
    const source = await readFile(path.resolve(import.meta.dirname, '..', 'config', 'profile.example.yml'), 'utf8');
    const configPath = path.join(temp, 'profile.yml');
    await writeFile(configPath, source.replace('mode: discovery', 'mode: smart'), 'utf8');
    for (const [enabled, expected] of [['false', 'false'], ['true', 'true']]) {
      const outputPath = path.join(temp, `output-${enabled}.txt`);
      const result = spawnSync(process.execPath, ['src/schedule-guard.mjs'], {
        cwd: path.resolve(import.meta.dirname, '..'),
        encoding: 'utf8',
        env: {
          ...process.env,
          CAREER_INTELLIGENCE_CONFIG: configPath,
          EVENT_NAME: 'workflow_dispatch',
          RUN_MODE: 'run',
          GITHUB_RUN_ID: `agent-${enabled}`,
          GITHUB_OUTPUT: outputPath,
          AGENT_ENABLED: enabled,
        },
      });
      assert.equal(result.status, 0, result.stderr);
      const outputs = await readFile(outputPath, 'utf8');
      assert.match(outputs, /^should_run=true$/m);
      assert.match(outputs, new RegExp(`^agent_should_run=${expected}$`, 'm'));
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
