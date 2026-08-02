#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { AGENT_PROVIDER, DIGEST_MODE, TIME_ZONE } from '../src/config.mjs';
import { formatLocalTime, readJson } from '../src/util.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const state = await readJson(path.join(ROOT, 'state', 'state.json'), {
  runs: [], sourceHealth: {}, outbox: {}, paused: null,
});
const context = await readJson(path.join(ROOT, 'state', 'run-context.json'), null);
const report = await readJson(path.join(ROOT, 'reports', 'latest.json'), null);
const lastRun = [...(state.runs || [])].reverse()[0];
const lastEmail = [...(state.runs || [])].reverse().find((run) => run.deliveryStatus === 'accepted');
const failing = Object.values(state.sourceHealth || {}).filter((source) => source.needsCatchUp);
const prepared = Object.values(state.outbox || {}).filter((item) => item.status === 'prepared');

process.stdout.write([
  'Career Intelligence status',
  `Mode: ${DIGEST_MODE}`,
  `Provider: ${DIGEST_MODE === 'smart' ? AGENT_PROVIDER : 'none'}`,
  `Timezone: ${TIME_ZONE}`,
  `Lifecycle: ${state.paused ? `paused — ${state.paused.reason}` : 'active'}`,
  `Last structured scan: ${context?.startedAt ? formatLocalTime(context.startedAt) : 'not recorded'}`,
  `Last completed run: ${lastRun?.at ? `${formatLocalTime(lastRun.at)} (${lastRun.deliveryStatus})` : 'not recorded'}`,
  `Last email: ${lastEmail?.at ? formatLocalTime(lastEmail.at) : 'not recorded'}`,
  `Latest coverage: ${report?.coverage ? `${report.coverage.completeness} (${report.coverage.completed}/${report.coverage.total})` : 'not recorded'}`,
  `Sources needing catch-up: ${failing.length}`,
  ...failing.slice(0, 10).map((source) => `- ${source.label}: ${source.lastReason || source.lastStatus}`),
  `Prepared emails awaiting delivery: ${prepared.length}`,
].join('\n') + '\n');
