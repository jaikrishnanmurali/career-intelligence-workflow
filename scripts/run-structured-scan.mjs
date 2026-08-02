#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DIGEST_MODE,
  ENABLED_ATS_SOURCES,
  ENABLED_DIRECT_SOURCES,
  LOOKBACK_HOURS,
  MAX_FULL_EVALUATIONS,
} from '../src/config.mjs';
import { createCoveragePlan } from '../src/coverage.mjs';
import { postingIdentity, recommendationRecord, shortlistCandidates, verifyCandidates } from '../src/ranking.mjs';
import { scanAllSources } from '../src/sources.mjs';
import {
  atomicWriteJson,
  canonicalUrl,
  loadLocalEnv,
  normalizeText,
  readJson,
} from '../src/util.mjs';

const EXTENSION_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CAREER_OPS_ROOT = path.resolve(process.env.CAREER_OPS_ROOT || path.join(EXTENSION_ROOT, '..', '..'));
const STATE_ROOT = path.join(EXTENSION_ROOT, 'state');
const STATE_PATH = path.join(STATE_ROOT, 'state.json');
const EFFECTIVE_MODE = process.env.CAREER_INTELLIGENCE_EFFECTIVE_MODE === 'smart'
  ? 'smart'
  : process.env.CAREER_INTELLIGENCE_EFFECTIVE_MODE === 'discovery'
    ? 'discovery'
    : DIGEST_MODE;

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

async function optionalText(filePath, fallback = '') {
  try { return await readFile(filePath, 'utf8'); } catch (error) {
    if (error?.code === 'ENOENT') return fallback;
    throw error;
  }
}

function fingerprint(job) {
  const material = [job.company, job.title, job.location, normalizeText(job.description)].join('\n');
  return createHash('sha256').update(material).digest('hex').slice(0, 16);
}

function defaultScannerState() {
  return {
    version: 3,
    seenUrls: {},
    seenPostingKeys: {},
    sentUrls: [],
    sourceCursors: {},
    priorityBoards: Object.fromEntries(ENABLED_ATS_SOURCES.map((name) => [name, []])),
    sentKeys: [],
    outbox: {},
    sourceHealth: {},
    runs: [],
    paused: null,
  };
}

function evaluationFor(role) {
  const verdict = role.fit === 'Priority' ? 'recommended' : 'possible';
  const score = role.fit === 'Priority' ? 5 : role.fit === 'Worth a look' ? 4 : 3;
  return {
    url: role.url,
    verdict,
    score,
    why: role.why,
    cautions: role.cautions || '',
    hardBlocker: '',
    evaluator: 'structured',
    structuredScore: role.score,
    fitBand: role.fit,
  };
}

function candidateFor(role) {
  return {
    url: canonicalUrl(role.url),
    company: role.company,
    title: role.title,
    location: role.location,
    postedAt: role.postedAt || '',
    firstSeen: role.firstSeenAt || '',
    portal: role.source,
    jdFingerprint: fingerprint(role),
    freshness: role.freshness,
    postedAtEvidence: role.postedAtEvidence,
    evaluation: evaluationFor(role),
  };
}

function coverageReceipt(plan, stats, coreResult, intakeCoverage) {
  const bySource = new Map(stats.map((item) => [item.source, item]));
  const intakeByPlatform = new Map(
    (intakeCoverage?.platforms || []).map((item) => [String(item.platform || ''), item]),
  );
  const sources = plan.sources.map((source) => {
    if (source.type === 'career_ops_core') {
      return coreResult?.status === 'completed_structured'
        ? { ...source, status: 'completed_structured', reason: `Official Career Ops ${coreResult.careerOpsVersion || ''} scan.mjs completed.`.trim() }
        : { ...source, status: 'failed', reason: 'The official Career Ops structured scan did not produce a completion receipt.' };
    }
    if (source.type === 'platform_alert') {
      if (!source.selected) {
        return { ...source, status: 'disabled_by_user', reason: 'The source pack did not select this platform for the configured locations.' };
      }
      if (!source.alertEnabled || !source.alertTested) {
        return { ...source, status: 'not_configured', reason: 'The native alert and its forwarded test email have not both been confirmed.' };
      }
      const receipt = intakeByPlatform.get(source.platform);
      if (!receipt) return { ...source, status: 'failed', reason: 'No intake receipt exists for this configured platform.' };
      return {
        ...source,
        status: receipt.status === 'completed' ? 'completed_intake' : receipt.status,
        reason: String(receipt.reason || ''),
      };
    }
    if (!['structured_feed', 'structured_ats'].includes(source.type)) {
      return {
        ...source,
        status: 'not_run_discovery_mode',
        reason: 'This source needs Career Ops browser or broad web-search discovery.',
      };
    }
    const stat = bySource.get(source.id);
    if (!stat) return { ...source, status: 'failed', reason: 'The structured scanner produced no source receipt.' };
    const failures = Number(stat.failures || 0);
    const completed = Number(stat.boardsCompleted ?? (stat.error ? 0 : 1));
    const requested = Number(stat.boardsRequested ?? 1);
    const successful = Math.max(0, completed - failures);
    const status = stat.error || stat.skipped || successful === 0
      ? 'failed'
      : failures > 0 || stat.skipped || completed < requested
        ? 'partial'
        : 'completed_structured';
    const detail = stat.skipped
      ? `Source was not attempted: ${stat.skipped}.`
      : source.type === 'structured_ats'
      ? `${completed}/${requested} requested boards completed; ${failures} board failures.`
      : `${Number(stat.jobsFound || 0)} jobs returned${stat.error ? `; ${stat.error}` : '.'}`;
    return { ...source, status, reason: detail };
  });
  return { schemaVersion: 1, runId: plan.runId, sources };
}

function updateScannerState(state, scan, considered, recommendations, now) {
  const seenUrls = { ...(state.seenUrls || {}) };
  const seenPostingKeys = { ...(state.seenPostingKeys || {}) };
  for (const item of considered) {
    const url = canonicalUrl(item.url);
    if (!url) continue;
    const prior = seenUrls[url] || {};
    seenUrls[url] = {
      firstSeenAt: prior.firstSeenAt || now,
      lastSeenAt: now,
      company: item.company || prior.company || '',
      title: item.title || prior.title || '',
      source: item.source || prior.source || '',
      status: recommendations.some((role) => canonicalUrl(role.url) === url) ? 'recommended' : 'filtered',
    };
    const postingKey = postingIdentity(item);
    if (postingKey) seenPostingKeys[postingKey] = { firstSeenAt: seenPostingKeys[postingKey]?.firstSeenAt || now, lastSeenAt: now };
  }
  const priorityBoards = { ...(state.priorityBoards || {}) };
  for (const source of ENABLED_ATS_SOURCES) priorityBoards[source] = [...(priorityBoards[source] || [])];
  for (const role of recommendations) {
    if (!role.boardKey || !priorityBoards[role.source]) continue;
    priorityBoards[role.source] = [
      role.boardKey,
      ...priorityBoards[role.source].filter((value) => value !== role.boardKey),
    ].slice(0, 250);
  }
  return {
    ...defaultScannerState(),
    ...state,
    version: 3,
    seenUrls,
    seenPostingKeys,
    sourceCursors: scan.sourceCursors,
    priorityBoards,
  };
}

await loadLocalEnv(path.join(EXTENSION_ROOT, '.env'));
await mkdir(STATE_ROOT, { recursive: true });
const runId = argumentValue('--run-id') || process.env.GITHUB_RUN_ID || `local-${Date.now()}`;
const startedAt = process.env.CAREER_SCAN_STARTED_AT || new Date().toISOString();
const state = { ...defaultScannerState(), ...await readJson(STATE_PATH, {}) };
const coreResult = await readJson(path.join(STATE_ROOT, 'career-ops-scan-result.json'), null);
if (process.env.CAREER_INTELLIGENCE_REQUIRE_CAREER_OPS_SCAN === 'true' && coreResult?.status !== 'completed_structured') {
  throw new Error('The official Career Ops structured scan must complete before supplemental discovery.');
}

const portalsText = await optionalText(path.join(CAREER_OPS_ROOT, 'portals.yml'), '{}');
const sourcesText = await optionalText(path.join(EXTENSION_ROOT, 'config', 'sources.yml'), '');
const careerOpsPlan = createCoveragePlan(portalsText, { runId, mode: EFFECTIVE_MODE, sourcesText });
const structuredSources = [
  ...ENABLED_DIRECT_SOURCES.map((name) => ({ id: name, type: 'structured_feed', label: name, configuredMethod: 'public feed or API' })),
  ...ENABLED_ATS_SOURCES.map((name) => ({ id: name, type: 'structured_ats', label: name, configuredMethod: 'rolling ATS boards' })),
];
const coveragePlan = {
  ...careerOpsPlan,
  sources: [
    ...careerOpsPlan.sources.filter((source) => source.id === 'core-structured'),
    ...structuredSources,
    ...careerOpsPlan.sources.filter((source) => source.id !== 'core-structured'),
  ],
};
await atomicWriteJson(path.join(STATE_ROOT, 'coverage-plan.json'), coveragePlan);

const scan = await scanAllSources(state, startedAt);
const intakePayload = await readJson(path.join(STATE_ROOT, 'intake-candidates.json'), { candidates: [] });
const intakeJobs = (intakePayload.candidates || [])
  .filter((candidate) => candidate.specStatus === 'verified' && candidate.applicationActive === true)
  .map((candidate) => ({
    title: candidate.title,
    company: candidate.company,
    location: candidate.location,
    description: candidate.description,
    url: candidate.officialUrl || candidate.boardUrl,
    postedAt: candidate.postedAt,
    postingPrecision: candidate.postingPrecision,
    postedAtEvidence: candidate.postedAtEvidence || `Verified ${candidate.sourcePlatform || candidate.platform} alert lead.`,
    source: `alert:${candidate.sourcePlatform || candidate.platform}`,
    boardKey: candidate.candidateKey,
  }));
const manualReview = (intakePayload.candidates || [])
  .filter((candidate) => ['unresolved', 'manual_review'].includes(candidate.specStatus))
  .filter((candidate) => candidate.applicationActive !== false)
  .filter((candidate) => {
    const discovered = Date.parse(candidate.discoveredAt);
    const runStarted = Date.parse(startedAt);
    return Number.isFinite(discovered)
      && Number.isFinite(runStarted)
      && discovered >= runStarted - LOOKBACK_HOURS * 3_600_000
      && discovered <= runStarted + 5 * 60_000;
  })
  .filter((candidate) => {
    const url = canonicalUrl(candidate.boardUrl);
    return url && !(state.sentKeys || []).includes(`url:${url}`);
  })
  .slice(0, 50)
  .map((candidate) => ({
    url: canonicalUrl(candidate.boardUrl),
    company: candidate.company || 'Company not verified',
    title: candidate.title || 'Title not verified',
    location: candidate.location || 'Location not verified',
    postedAt: candidate.postedAt || '',
    firstSeen: candidate.discoveredAt || startedAt,
    portal: `alert:${candidate.platform}`,
    jdFingerprint: '',
    score: null,
    why: 'A configured platform alert found this lead, but the complete live employer or ATS specification could not be verified automatically.',
    cautions: 'Manual check required. This is not a fit recommendation, and its exact age or requirements may be unknown.',
  }));
scan.jobs.push(...intakeJobs);
const shortlist = shortlistCandidates(scan.jobs, state, startedAt);
const verified = await verifyCandidates(shortlist.candidates);
const recommendations = verified.recommendations.map(recommendationRecord);
const candidates = recommendations.map(candidateFor);
const evaluateNow = EFFECTIVE_MODE === 'smart' ? candidates.slice(0, MAX_FULL_EVALUATIONS) : [];
const nextState = updateScannerState(
  state,
  scan,
  [
    ...shortlist.rejected,
    ...shortlist.candidates.slice(0, shortlist.candidates.length - verified.unverifiedDueToCap),
  ],
  recommendations,
  startedAt,
);

await atomicWriteJson(path.join(STATE_ROOT, 'pending-scanner-state.json'), {
  schemaVersion: 1,
  runId,
  state: nextState,
});
const intakeCoverage = await readJson(path.join(STATE_ROOT, 'intake-coverage.json'), null);
await atomicWriteJson(
  path.join(STATE_ROOT, 'coverage-result.json'),
  coverageReceipt(coveragePlan, scan.stats, coreResult, intakeCoverage),
);
await atomicWriteJson(path.join(STATE_ROOT, 'candidates.json'), {
  schemaVersion: 1,
  runId,
  generatedAt: startedAt,
  candidates,
  evaluateNow,
  awaitingEvaluation: EFFECTIVE_MODE === 'smart' ? candidates.slice(MAX_FULL_EVALUATIONS) : candidates,
  manualReview,
});
await atomicWriteJson(path.join(STATE_ROOT, 'run-context.json'), {
  schemaVersion: 1,
  runId,
  startedAt,
  mode: EFFECTIVE_MODE,
  scanner: 'structured-zero-token',
  careerOpsVersion: coreResult?.careerOpsVersion || '',
  structuredScan: {
    jobsScanned: scan.jobs.length,
    verifiedAlertLeads: intakeJobs.length,
    alertLeadsNeedingManualReview: manualReview.length,
    relevantCandidates: shortlist.candidates.length,
    recommendations: recommendations.length,
    rejected: shortlist.rejected.length + verified.rejected.length,
    unverifiedDueToCap: verified.unverifiedDueToCap,
    tokenUsage: 0,
  },
});

process.stdout.write(
  `Structured scan complete: ${scan.jobs.length} jobs checked, ${recommendations.length} recommendations, 0 model tokens.\n`,
);
