#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AGENT_PROVIDER,
  DELIVERY_TIMES,
  DIGEST_MODE,
  INBOUND_ALERTS_ENABLED,
  TIME_ZONE,
} from '../src/config.mjs';
import { formatLocalTime, readJson } from '../src/util.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const state = await readJson(path.join(ROOT, 'state', 'state.json'), {
  runs: [], sourceHealth: {}, outbox: {}, paused: null,
});
const context = await readJson(path.join(ROOT, 'state', 'run-context.json'), null);
const report = await readJson(path.join(ROOT, 'reports', 'latest.json'), null);
const intakeState = await readJson(path.join(ROOT, 'state', 'inbound-state.json'), null);
const intakeCoverage = await readJson(path.join(ROOT, 'state', 'intake-coverage.json'), null);
const intakeCandidates = await readJson(path.join(ROOT, 'state', 'intake-candidates.json'), { candidates: [] });
const lastRun = [...(state.runs || [])].reverse()[0];
const lastEmail = [...(state.runs || [])].reverse().find((run) => run.deliveryStatus === 'accepted');
const failing = Object.values(state.sourceHealth || {}).filter((source) => source.needsCatchUp);
const prepared = Object.values(state.outbox || {}).filter((item) => item.status === 'prepared');
const unresolvedAlerts = (intakeCandidates.candidates || [])
  .filter((candidate) => ['unresolved', 'manual_review'].includes(candidate.specStatus));
const intakeNeedsAttention = (intakeCoverage?.platforms || [])
  .filter((source) => ['partial', 'failed', 'not_configured'].includes(source.status));

process.stdout.write([
  'Career Intelligence status',
  `Mode: ${DIGEST_MODE}`,
  `Provider: ${DIGEST_MODE === 'smart' ? AGENT_PROVIDER : 'none'}`,
  `Timezone: ${TIME_ZONE}`,
  `Local delivery attempts: ${DELIVERY_TIMES.join(', ')}`,
  `Lifecycle: ${state.paused ? `paused — ${state.paused.reason}` : 'active'}`,
  `Last structured scan: ${context?.startedAt ? formatLocalTime(context.startedAt) : 'not recorded'}`,
  `Last completed run: ${lastRun?.at ? `${formatLocalTime(lastRun.at)} (${lastRun.deliveryStatus})` : 'not recorded'}`,
  `Last email: ${lastEmail?.at ? formatLocalTime(lastEmail.at) : 'not recorded'}`,
  `Latest coverage: ${report?.coverage ? `${report.coverage.completeness} (${report.coverage.completed}/${report.coverage.total})` : 'not recorded'}`,
  `Sources needing catch-up: ${failing.length}`,
  ...failing.slice(0, 10).map((source) => `- ${source.label}: ${source.lastReason || source.lastStatus}`),
  `Prepared emails awaiting delivery: ${prepared.length}`,
  `Platform-alert intake: ${INBOUND_ALERTS_ENABLED ? 'enabled' : 'disabled'}`,
  `Last successful alert poll: ${intakeState?.lastSuccessfulPollAt ? formatLocalTime(intakeState.lastSuccessfulPollAt) : 'not recorded'}`,
  `Platform-alert lanes needing attention: ${intakeNeedsAttention.length}`,
  ...intakeNeedsAttention.slice(0, 8).map((source) => `- ${source.platform}: ${source.reason || source.status}`),
  `Unresolved alert leads awaiting or previously sent for manual review: ${unresolvedAlerts.length}`,
].join('\n') + '\n');
