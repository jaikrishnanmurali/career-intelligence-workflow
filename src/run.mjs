#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildDigest, sendDigest } from './email.mjs';
import {
  recommendationRecord,
  shortlistCandidates,
  verifyCandidates,
} from './ranking.mjs';
import { scanAllSources } from './sources.mjs';
import {
  atomicWriteJson,
  canonicalUrl,
  loadLocalEnv,
  readJson,
  writeText,
} from './util.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE_PATH = path.join(ROOT, 'state', 'state.json');
const REPORT_PATH = path.join(ROOT, 'reports', 'latest.json');
const PREVIEW_TEXT = path.join(ROOT, 'preview', 'latest.txt');
const PREVIEW_HTML = path.join(ROOT, 'preview', 'latest.html');

function defaultState() {
  return {
    version: 1,
    seenUrls: {},
    sentUrls: [],
    sourceCursors: {},
    priorityBoards: {
      greenhouse: [],
      lever: [],
      ashby: [],
      workday: [],
    },
    runs: [],
  };
}

function compactRejected(item) {
  return {
    url: item.url || '',
    company: item.company || 'Unknown',
    title: item.title || 'Unknown',
    location: typeof item.location === 'string' ? item.location : '',
    source: item.source || 'unknown',
    reason: item.reason || 'Did not pass the configured filters.',
  };
}

function sourceFailureCount(stats) {
  return stats.filter((item) => (
    item.error
    || item.skipped
    || Number(item.failures || 0) > 0
  )).length;
}

function buildSummary(scan, recommendationCount, rejectedCount, freshnessCounts, unverifiedDueToCap) {
  const directSources = scan.stats.filter((item) => 'jobsFound' in item).length;
  const atsSources = scan.stats.filter((item) => 'boardsRequested' in item);
  const boardsRequested = atsSources.reduce((sum, item) => sum + Number(item.boardsRequested || 0), 0);
  const boardsCompleted = atsSources.reduce((sum, item) => sum + Number(item.boardsCompleted || 0), 0);
  return [
    `Zero-token scan checked ${scan.jobs.length} normalized postings across ${directSources} direct-feed lanes`,
    `and ${boardsCompleted}/${boardsRequested} requested ATS boards`,
    `(Greenhouse, Lever, Ashby, and Workday rolling shards plus priority boards).`,
    `${recommendationCount} recommendation${recommendationCount === 1 ? '' : 's'} passed; ${rejectedCount} relevant results were filtered or rejected.`,
    `Freshness: ${freshnessCounts.verified || 0} verified, ${freshnessCounts.likely || 0} likely, ${freshnessCounts.newly_discovered || 0} newly discovered.`,
    unverifiedDueToCap
      ? `${unverifiedDueToCap} lower-ranked candidates remain for a later bounded verification pass.`
      : 'All shortlisted candidates fit inside the live-page verification budget.',
  ].join(' ');
}

function updateState(state, scan, report, evaluatedItems, resendId) {
  const now = report.generatedAt;
  const seenUrls = { ...(state.seenUrls || {}) };
  for (const item of evaluatedItems) {
    const url = canonicalUrl(item.url);
    if (!url) continue;
    const previous = seenUrls[url] || {};
    seenUrls[url] = {
      firstSeenAt: previous.firstSeenAt || now,
      lastSeenAt: now,
      company: item.company || previous.company || '',
      title: item.title || previous.title || '',
      source: item.source || previous.source || '',
      status: report.recommendations.some((role) => canonicalUrl(role.url) === url)
        ? 'recommended'
        : 'filtered',
    };
  }

  const sentUrls = [...new Set([
    ...(Array.isArray(state.sentUrls) ? state.sentUrls : []),
    ...report.recommendations.map((role) => canonicalUrl(role.url)).filter(Boolean),
  ])];

  const priorityBoards = {
    greenhouse: [...(state.priorityBoards?.greenhouse || [])],
    lever: [...(state.priorityBoards?.lever || [])],
    ashby: [...(state.priorityBoards?.ashby || [])],
    workday: [...(state.priorityBoards?.workday || [])],
  };
  for (const role of report.recommendations) {
    if (!role.boardKey || !priorityBoards[role.source]) continue;
    priorityBoards[role.source] = [
      role.boardKey,
      ...priorityBoards[role.source].filter((value) => value !== role.boardKey),
    ].slice(0, 250);
  }

  const runs = [
    ...(Array.isArray(state.runs) ? state.runs : []),
    {
      at: now,
      jobsScanned: report.jobsScanned,
      recommendations: report.recommendations.length,
      rejected: report.rejectedCount,
      sourceFailures: report.sourceFailureCount,
      resendId: resendId || null,
    },
  ].slice(-60);

  return {
    version: 1,
    seenUrls,
    sentUrls,
    sourceCursors: scan.sourceCursors,
    priorityBoards,
    runs,
  };
}

export async function run({
  dryRun = false,
  send = false,
  scanStartedAt = new Date().toISOString(),
} = {}) {
  await loadLocalEnv(path.join(ROOT, '.env'));
  const state = await readJson(STATE_PATH, defaultState());
  const scan = await scanAllSources(state, scanStartedAt);
  const shortlist = shortlistCandidates(scan.jobs, state, scanStartedAt);
  const verified = await verifyCandidates(shortlist.candidates);
  const recommendations = verified.recommendations.map(recommendationRecord);
  const allRejected = [
    ...shortlist.rejected,
    ...verified.rejected,
  ];
  const freshnessCounts = recommendations.reduce((counts, role) => {
    counts[role.freshness] = (counts[role.freshness] || 0) + 1;
    return counts;
  }, {});
  const report = {
    generatedAt: scanStartedAt,
    scanSummary: buildSummary(
      scan,
      recommendations.length,
      allRejected.length,
      freshnessCounts,
      verified.unverifiedDueToCap,
    ),
    jobsScanned: scan.jobs.length,
    sourceStats: scan.stats,
    sourceFailureCount: sourceFailureCount(scan.stats),
    freshnessCounts,
    recommendations,
    rejectedCount: allRejected.length,
    rejected: allRejected.slice(0, 100).map(compactRejected),
    unverifiedDueToCap: verified.unverifiedDueToCap,
    tokenUsage: 0,
  };

  const digest = buildDigest(report);
  await atomicWriteJson(REPORT_PATH, report);
  await writeText(PREVIEW_TEXT, `${digest.text}\n`);
  await writeText(PREVIEW_HTML, digest.html);

  let delivery = null;
  if (send && !dryRun) {
    delivery = await sendDigest(report);
  }

  if (!dryRun) {
    const selectedCount = shortlist.candidates.length - verified.unverifiedDueToCap;
    const evaluatedItems = [
      ...shortlist.rejected,
      ...shortlist.candidates.slice(0, selectedCount),
    ];
    const nextState = updateState(
      state,
      scan,
      report,
      evaluatedItems,
      delivery?.result?.id,
    );
    await atomicWriteJson(STATE_PATH, nextState);
  }

  return { report, digest, delivery };
}

const directRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (directRun) {
  const dryRun = process.argv.includes('--dry-run');
  const shouldSend = process.argv.includes('--send');
  run({ dryRun, send: shouldSend })
    .then(({ report, delivery }) => {
      const deliveryText = delivery?.result?.id ? ' Email delivered.' : '';
      process.stdout.write(
        `Cloud scan complete: ${report.jobsScanned} jobs checked, ${report.recommendations.length} recommendations, 0 model tokens.${deliveryText}\n`,
      );
    })
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}

