#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DIGEST_MODE,
  FAILURE_WARNING_AFTER,
} from './config.mjs';
import {
  jobIdentityKeys,
  mergeEvaluations,
  readEvaluationPayload,
} from './career-ops.mjs';
import {
  coverageLine,
  validateCoverageResult,
} from './coverage.mjs';
import {
  buildDigest,
  digestPayload,
  payloadHash,
  sendDigest,
} from './email.mjs';
import {
  atomicWriteJson,
  canonicalUrl,
  loadLocalEnv,
  readJson,
  writeText,
} from './util.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE_PATH = path.join(ROOT, 'state', 'state.json');
const CONTEXT_PATH = path.join(ROOT, 'state', 'run-context.json');
const CANDIDATES_PATH = path.join(ROOT, 'state', 'candidates.json');
const COVERAGE_PLAN_PATH = path.join(ROOT, 'state', 'coverage-plan.json');
const COVERAGE_RESULT_PATH = path.join(ROOT, 'state', 'coverage-result.json');
const EVALUATIONS_PATH = path.join(ROOT, 'state', 'evaluations.json');
const PENDING_SCANNER_STATE_PATH = path.join(ROOT, 'state', 'pending-scanner-state.json');
const REPORT_PATH = path.join(ROOT, 'reports', 'latest.json');
const PREVIEW_TEXT = path.join(ROOT, 'preview', 'latest.txt');
const PREVIEW_HTML = path.join(ROOT, 'preview', 'latest.html');
const EFFECTIVE_MODE = process.env.CAREER_INTELLIGENCE_EFFECTIVE_MODE === 'discovery'
  ? 'discovery'
  : process.env.CAREER_INTELLIGENCE_EFFECTIVE_MODE === 'smart'
    ? 'smart'
    : DIGEST_MODE;

export function deliveryKeyFor(
  slotId,
  namespace = process.env.GITHUB_REPOSITORY || 'career-intelligence-workflow',
) {
  const safeNamespace = String(namespace).toLowerCase()
    .replace(/[^a-z0-9._/-]+/g, '-').slice(0, 100) || 'career-intelligence-workflow';
  const safeSlot = String(slotId || '').toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-').slice(0, 80);
  if (!safeSlot) throw new Error('A stable slot id is required for delivery.');
  return `career-digest/${safeNamespace}/${safeSlot}`;
}

export function defaultState() {
  return {
    version: 3,
    seenUrls: {},
    seenPostingKeys: {},
    sentUrls: [],
    sourceCursors: {},
    priorityBoards: {},
    sentKeys: [],
    outbox: {},
    sourceHealth: {},
    runs: [],
    paused: null,
  };
}

function normalizeState(value) {
  const state = value && typeof value === 'object' ? value : {};
  const legacySent = Array.isArray(state.sentUrls)
    ? state.sentUrls.map((url) => canonicalUrl(url)).filter(Boolean).map((url) => `url:${url}`)
    : [];
  return {
    ...defaultState(),
    ...state,
    version: 3,
    sentKeys: [...new Set([...(state.sentKeys || []), ...legacySent])],
    outbox: state.outbox && typeof state.outbox === 'object' ? state.outbox : {},
    sourceHealth: state.sourceHealth && typeof state.sourceHealth === 'object'
      ? state.sourceHealth : {},
    runs: Array.isArray(state.runs) ? state.runs : [],
  };
}

function fallbackCoverage(plan, mode, error) {
  if (mode === 'discovery') return validateCoverageResult(null, plan, { mode });
  return {
    schemaVersion: 1,
    runId: plan.runId,
    mode,
    completeness: 'partial',
    completed: 0,
    total: plan.sources.length,
    sources: plan.sources.map((source) => ({
      ...source,
      status: 'failed',
      reason: 'No valid coverage receipt was produced.',
    })),
    failures: plan.sources.map((source) => ({
      ...source,
      status: 'failed',
      reason: 'No valid coverage receipt was produced.',
    })),
    explanation: `Smart discovery did not produce a valid coverage receipt: ${error.message}`,
  };
}

async function coverageFor(plan, mode) {
  try {
    const payload = await readJson(COVERAGE_RESULT_PATH, null);
    return validateCoverageResult(payload, plan, { mode });
  } catch (error) {
    return fallbackCoverage(plan, mode, error);
  }
}

async function evaluationsFor(candidatePayload, mode) {
  if (mode === 'discovery') return { payload: { schemaVersion: 1, evaluations: [] }, warning: '' };
  try {
    const payload = await readJson(EVALUATIONS_PATH, null);
    return {
      payload: readEvaluationPayload(payload, candidatePayload.evaluateNow || []),
      warning: '',
    };
  } catch (error) {
    return {
      payload: { schemaVersion: 1, evaluations: [] },
      warning: `Fit evaluation was unavailable, so every discovered role was emailed as unscored: ${error.message}`,
    };
  }
}

function emailRole(item) {
  return {
    url: item.url,
    company: item.company || 'Company not stated',
    title: item.title || 'Title not stated',
    location: item.location || 'Location not stated',
    postedAt: item.postedAt || '',
    firstSeen: item.firstSeen || '',
    portal: item.portal || '',
    jdFingerprint: item.jdFingerprint || '',
    score: item.evaluation?.score || item.score || null,
    why: item.evaluation?.why || item.why || 'Not evaluated in this run; included so evaluation limits cannot hide a job.',
    cautions: item.evaluation?.cautions || item.cautions || '',
  };
}

function updateSourceHealth(previous, coverage, at) {
  const next = { ...(previous || {}) };
  for (const source of coverage.sources || []) {
    const failed = ['failed', 'partial'].includes(source.status);
    const notRun = source.status === 'not_run_discovery_mode';
    const prior = next[source.id] || {};
    next[source.id] = {
      label: source.label,
      type: source.type,
      lastStatus: source.status,
      lastReason: source.reason || '',
      lastAttemptAt: at,
      lastCompletedAt: failed || notRun ? (prior.lastCompletedAt || null) : at,
      consecutiveFailures: failed ? Number(prior.consecutiveFailures || 0) + 1 : (notRun ? Number(prior.consecutiveFailures || 0) : 0),
      needsCatchUp: failed || Boolean(prior.needsCatchUp && notRun),
    };
  }
  return next;
}

function coverageWarnings(coverage, sourceHealth, evaluationWarning) {
  const warnings = (coverage.failures || []).map((source) => {
    const failures = sourceHealth[source.id]?.consecutiveFailures || 1;
    const repeated = failures >= FAILURE_WARNING_AFTER ? ` (${failures} consecutive runs)` : '';
    return `${source.label}: ${source.reason || source.status}${repeated}`;
  });
  if (evaluationWarning) warnings.push(evaluationWarning);
  return warnings;
}

function trimOutbox(outbox) {
  return Object.fromEntries(Object.entries(outbox)
    .sort(([, left], [, right]) => String(left.preparedAt || '').localeCompare(String(right.preparedAt || '')))
    .slice(-40));
}

function reportFrom({ context, candidatePayload, coverage, evaluations, sourceHealth, generatedAt, slotId }) {
  const merged = mergeEvaluations(candidatePayload.candidates || [], evaluations.payload);
  const recommended = merged.filter((item) => item.verdict === 'recommended').map(emailRole);
  const possible = merged.filter((item) => item.verdict === 'possible').map(emailRole);
  const other = merged.filter((item) => !['recommended', 'possible', 'hard_blocked'].includes(item.verdict)).map(emailRole);
  const hardBlocked = merged.filter((item) => item.verdict === 'hard_blocked');
  const manualReview = (candidatePayload.manualReview || []).map(emailRole);
  const evaluatedCount = merged.filter((item) => item.evaluation).length;
  const warnings = coverageWarnings(coverage, sourceHealth, evaluations.warning);
  return {
    schemaVersion: 2,
    generatedAt,
    slotId,
    mode: EFFECTIVE_MODE,
    runId: context.runId,
    careerOpsVersion: context.careerOpsVersion,
    scanSummary: [
      context.structuredScan
        ? `The zero-token scanner checked ${context.structuredScan.jobsScanned || 0} normalized jobs and retained ${candidatePayload.candidates?.length || 0} recommendations.`
        : `Career Ops added ${candidatePayload.candidates?.length || 0} unsent job${candidatePayload.candidates?.length === 1 ? '' : 's'} in this scan.`,
      coverageLine(coverage),
      EFFECTIVE_MODE === 'smart'
        ? `${evaluatedCount} received full-description fit evaluation; every remaining discovery was retained as unscored.`
        : 'No model evaluation ran; discoveries are grouped as unscored.',
    ].join(' '),
    coverage: {
      completeness: coverage.completeness,
      completed: coverage.completed,
      total: coverage.total,
      summary: coverage.explanation,
      warnings,
      sources: coverage.sources,
    },
    recommended,
    possible,
    other,
    manualReview,
    recommendations: recommended,
    hardBlockedCount: hardBlocked.length,
    hardBlocked: hardBlocked.map(emailRole),
    awaitingEvaluationCount: merged.length - evaluatedCount,
    discoveredCount: merged.length,
    emailedCount: recommended.length + possible.length + other.length + manualReview.length,
    evaluationWarning: evaluations.warning,
  };
}

export async function prepare({ slotId, generatedAt = new Date().toISOString() } = {}) {
  await loadLocalEnv(path.join(ROOT, '.env'));
  const storedState = normalizeState(await readJson(STATE_PATH, defaultState()));
  const pendingScanner = await readJson(PENDING_SCANNER_STATE_PATH, null);
  const state = pendingScanner?.state
    ? normalizeState({ ...storedState, ...pendingScanner.state })
    : storedState;
  if (state.paused) throw new Error(`Digests are paused: ${state.paused.reason || 'no reason recorded'}`);
  const existing = state.outbox[slotId];
  if (existing?.status === 'delivered') return { state, outbox: existing, reused: true };
  if (existing?.status === 'prepared') return { state, outbox: existing, reused: true };
  if (existing?.status === 'no-recommendations') return { state, outbox: existing, reused: true };

  const context = await readJson(CONTEXT_PATH, null);
  const candidatePayload = await readJson(CANDIDATES_PATH, null);
  const plan = await readJson(COVERAGE_PLAN_PATH, null);
  if (!context?.runId || !candidatePayload || !plan) {
    throw new Error('Run context, candidate list, or coverage plan is missing.');
  }
  if (candidatePayload.runId !== context.runId || plan.runId !== context.runId) {
    throw new Error('Prepared scan files do not belong to the same run.');
  }
  if (pendingScanner?.runId && pendingScanner.runId !== context.runId) {
    throw new Error('Pending scanner state does not belong to the current run.');
  }
  const coverage = await coverageFor(plan, EFFECTIVE_MODE);
  const evaluations = await evaluationsFor(candidatePayload, EFFECTIVE_MODE);
  const sourceHealth = updateSourceHealth(state.sourceHealth, coverage, generatedAt);
  const report = reportFrom({
    context, candidatePayload, coverage, evaluations, sourceHealth, generatedAt, slotId,
  });
  const digest = buildDigest(report);
  const payload = digestPayload(digest);
  const outbox = {
    status: report.emailedCount > 0 ? 'prepared' : 'no-recommendations',
    slotId,
    runId: context.runId,
    preparedAt: generatedAt,
    idempotencyKey: deliveryKeyFor(slotId),
    payloadHash: payloadHash(payload),
    report,
    digest,
    payload,
  };
  const nextState = {
    ...state,
    sourceHealth,
    outbox: trimOutbox({ ...state.outbox, [slotId]: outbox }),
    runs: report.emailedCount > 0 ? state.runs : [...state.runs, {
      at: generatedAt,
      slotId,
      runId: context.runId,
      deliveryStatus: 'no-recommendations',
      resendId: null,
      mode: report.mode,
      emailed: 0,
      recommended: 0,
      coverage: report.coverage.completeness,
    }].slice(-120),
  };
  await atomicWriteJson(STATE_PATH, nextState);
  await atomicWriteJson(REPORT_PATH, report);
  await writeText(PREVIEW_TEXT, `${digest.text}\n`);
  await writeText(PREVIEW_HTML, digest.html);
  return { state: nextState, outbox, reused: false };
}

export async function deliver({ slotId, fetchImpl } = {}) {
  await loadLocalEnv(path.join(ROOT, '.env'));
  const state = normalizeState(await readJson(STATE_PATH, defaultState()));
  const outbox = state.outbox[slotId];
  if (!outbox) throw new Error(`No prepared digest exists for slot ${slotId}.`);
  if (outbox.status === 'delivered') return { state, outbox, reused: true };
  if (outbox.status === 'no-recommendations') {
    return { state, outbox, reused: true, skipped: true };
  }
  if (outbox.status !== 'prepared') throw new Error(`Digest ${slotId} is not in a deliverable state.`);
  if (payloadHash(outbox.payload) !== outbox.payloadHash) {
    throw new Error(`Prepared digest ${slotId} changed after it was saved; refusing delivery.`);
  }
  const delivery = await sendDigest(outbox.report, {
    digest: outbox.digest,
    payload: outbox.payload,
    idempotencyKey: outbox.idempotencyKey,
    fetchImpl,
  });
  const deliveredAt = new Date().toISOString();
  const emailed = [
    ...(outbox.report.recommended || []),
    ...(outbox.report.possible || []),
    ...(outbox.report.other || []),
    ...(outbox.report.manualReview || []),
  ];
  const deliveredOutbox = {
    ...outbox,
    status: 'delivered',
    deliveredAt,
    resendId: delivery.result?.id || null,
  };
  const run = {
    at: deliveredAt,
    slotId,
    runId: outbox.runId,
    deliveryStatus: 'accepted',
    resendId: delivery.result?.id || null,
    mode: outbox.report.mode,
    emailed: outbox.report.emailedCount,
    recommended: outbox.report.recommended.length,
    coverage: outbox.report.coverage.completeness,
  };
  const nextState = {
    ...state,
    sentKeys: [...new Set([
      ...state.sentKeys,
      ...emailed.flatMap(jobIdentityKeys),
    ])],
    sentUrls: [...new Set([
      ...(state.sentUrls || []),
      ...emailed.map((job) => canonicalUrl(job.url)).filter(Boolean),
    ])],
    outbox: { ...state.outbox, [slotId]: deliveredOutbox },
    runs: [...state.runs, run].slice(-120),
  };
  await atomicWriteJson(STATE_PATH, nextState);
  return { state: nextState, outbox: deliveredOutbox, delivery, reused: false };
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

async function main() {
  const slotId = argumentValue('--slot');
  if (!slotId) throw new Error('Use --slot with the stable schedule slot id.');
  if (process.argv.includes('--prepare')) {
    const result = await prepare({ slotId });
    process.stdout.write(`${result.reused ? 'Reused' : 'Prepared'} ${slotId}: ${result.outbox.report.emailedCount} jobs, ${result.outbox.report.coverage.completeness} coverage.\n`);
    return;
  }
  if (process.argv.includes('--deliver')) {
    const result = await deliver({ slotId });
    process.stdout.write(`${result.skipped ? 'No recommendations; email skipped for' : result.reused ? 'Already delivered' : 'Delivered'} ${slotId}.\n`);
    return;
  }
  throw new Error('Choose --prepare or --deliver.');
}

const directRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (directRun) main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
