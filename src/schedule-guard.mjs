#!/usr/bin/env node

import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { AGENT_PROVIDER, DIGEST_MODE, TIME_ZONE } from './config.mjs';
import {
  manualSlotId,
  scheduleDecision,
  slotIdFor,
} from './schedule.mjs';
import { readJson } from './util.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE_PATH = path.join(ROOT, 'state', 'state.json');

const now = new Date();
const isManual = process.env.EVENT_NAME === 'workflow_dispatch';
const runMode = process.env.RUN_MODE || 'run';
const slotId = isManual
  ? manualSlotId(process.env.GITHUB_RUN_ID, now)
  : slotIdFor(now, process.env.EVENT_SCHEDULE, TIME_ZONE);
const guardOnly = runMode !== 'run';
const force = isManual && runMode === 'run';
const agentEnabled = String(process.env.AGENT_ENABLED || '').toLowerCase() === 'true';
const effectiveMode = DIGEST_MODE === 'smart' && agentEnabled ? 'smart' : 'discovery';
const agentShouldRun = shouldRun => shouldRun && effectiveMode === 'smart';
const state = await readJson(STATE_PATH, { runs: [] });
const decision = scheduleDecision({
  state,
  slotId,
  now,
  minimumGapHours: Number(process.env.MINIMUM_GAP_HOURS || 6),
  force,
});
const shouldRun = guardOnly ? false : decision.shouldRun;
const reason = guardOnly
  ? `Guard-only check: ${decision.reason}`
  : decision.reason;

if (process.env.GITHUB_OUTPUT) {
  await appendFile(
    process.env.GITHUB_OUTPUT,
    `should_run=${shouldRun}\nagent_should_run=${agentShouldRun(shouldRun)}\nresume_delivery=${Boolean(decision.resumeDelivery)}\nslot_id=${slotId}\nmode=${effectiveMode}\nprovider=${AGENT_PROVIDER}\nreason=${reason}\n`,
    'utf8',
  );
}

process.stdout.write(`${shouldRun ? 'RUN' : 'SKIP'} ${slotId}: ${reason}\n`);
