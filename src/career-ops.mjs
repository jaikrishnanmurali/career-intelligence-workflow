import {
  access,
  readFile,
} from 'node:fs/promises';
import path from 'node:path';

import { SUPPORTED_CAREER_OPS } from './config.mjs';
import { canonicalUrl } from './util.mjs';

export const SCAN_HISTORY_HEADER = SUPPORTED_CAREER_OPS.scanHistoryColumns.join('\t');

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function semverParts(value) {
  const match = String(value || '').trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  return match ? match.slice(1).map(Number) : null;
}

function compareVersions(left, right) {
  const a = semverParts(left);
  const b = semverParts(right);
  if (!a || !b) return null;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;
  }
  return 0;
}

export function supportedCareerOpsVersion(version) {
  const minimum = compareVersions(version, SUPPORTED_CAREER_OPS.minimum);
  const maximum = compareVersions(version, SUPPORTED_CAREER_OPS.maximumExclusive);
  return minimum !== null && maximum !== null && minimum >= 0 && maximum < 0;
}

export async function validateCareerOpsRoot(root, { requirePrivateInputs = true } = {}) {
  const careerOpsRoot = path.resolve(root);
  const required = [
    'AGENTS.md',
    'package.json',
    'scan.mjs',
    'fingerprint-core.mjs',
    'modes/scan.md',
    'portals.yml',
  ];
  if (requirePrivateInputs) {
    required.push('config/profile.yml', 'cv.md');
  }
  const missing = [];
  for (const relative of required) {
    if (!await exists(path.join(careerOpsRoot, ...relative.split('/')))) missing.push(relative);
  }
  if (missing.length) {
    throw new Error(`Career Ops is incomplete at ${careerOpsRoot}. Missing: ${missing.join(', ')}`);
  }
  const packageJson = JSON.parse(
    (await readFile(path.join(careerOpsRoot, 'package.json'), 'utf8')).replace(/^\uFEFF/, ''),
  );
  if (packageJson.name !== 'career-ops') {
    throw new Error(`Expected package name career-ops at ${careerOpsRoot}; found ${packageJson.name || 'missing'}.`);
  }
  if (!supportedCareerOpsVersion(packageJson.version)) {
    throw new Error(
      `Career Ops ${packageJson.version || 'unknown'} is not supported. `
      + `This release requires >=${SUPPORTED_CAREER_OPS.minimum} and <${SUPPORTED_CAREER_OPS.maximumExclusive}.`,
    );
  }
  return { root: careerOpsRoot, version: packageJson.version };
}

export function parseScanHistory(text, { allowMissingHeader = false } = {}) {
  const normalized = String(text || '').replace(/^\uFEFF/, '').replace(/(?:\r?\n)+$/, '');
  if (!normalized.trim()) {
    if (allowMissingHeader) return [];
    throw new Error('Career Ops scan history is empty or missing its schema header.');
  }
  const lines = normalized.split(/\r?\n/).filter((line) => line.trim());
  if (lines[0] !== SCAN_HISTORY_HEADER) {
    throw new Error(
      `Unsupported Career Ops scan-history.tsv schema. Expected: ${SCAN_HISTORY_HEADER}`,
    );
  }
  return lines.slice(1).map((line, index) => {
    const columns = line.split('\t');
    if (columns.length !== SUPPORTED_CAREER_OPS.scanHistoryColumns.length) {
      throw new Error(
        `Invalid scan-history.tsv row ${index + 2}: expected `
        + `${SUPPORTED_CAREER_OPS.scanHistoryColumns.length} columns, found ${columns.length}.`,
      );
    }
    const [
      url,
      firstSeen,
      portal,
      title,
      company,
      status,
      location,
      jdFingerprint,
      postedAt,
    ] = columns;
    const normalizedUrl = canonicalUrl(url);
    if (!normalizedUrl) {
      throw new Error(`Invalid job URL in scan-history.tsv row ${index + 2}: ${url}`);
    }
    return {
      raw: line,
      url: normalizedUrl,
      firstSeen,
      portal,
      title,
      company,
      status,
      location,
      jdFingerprint: String(jdFingerprint || '').toLowerCase(),
      postedAt,
    };
  });
}

export function appendedScanRows(beforeRows, afterRows) {
  const remaining = new Map();
  for (const row of beforeRows || []) {
    remaining.set(row.raw, (remaining.get(row.raw) || 0) + 1);
  }
  const appended = [];
  for (const row of afterRows || []) {
    const count = remaining.get(row.raw) || 0;
    if (count > 0) {
      remaining.set(row.raw, count - 1);
    } else {
      appended.push(row);
    }
  }
  return appended;
}

export function jobIdentityKeys(job) {
  const keys = [];
  const url = canonicalUrl(job?.url);
  if (url) keys.push(`url:${url}`);
  const fingerprint = String(job?.jdFingerprint || job?.jd_fingerprint || '')
    .trim()
    .toLowerCase();
  if (/^[a-f0-9]{16}$/.test(fingerprint)) keys.push(`fingerprint:${fingerprint}`);
  return keys;
}

export function isAlreadySent(job, sentKeys) {
  const sent = sentKeys instanceof Set ? sentKeys : new Set(sentKeys || []);
  return jobIdentityKeys(job).some((key) => sent.has(key));
}

export function addedCandidates(beforeRows, afterRows, sentKeys = []) {
  const candidates = appendedScanRows(beforeRows, afterRows)
    .filter((row) => row.status === 'added')
    .filter((row) => !isAlreadySent(row, sentKeys));
  const seen = new Set();
  return candidates.filter((candidate) => {
    const identity = jobIdentityKeys(candidate)[1] || jobIdentityKeys(candidate)[0];
    if (!identity || seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

export function readEvaluationPayload(payload, candidates) {
  if (!payload) return { schemaVersion: 1, evaluations: [] };
  if (Number(payload.schemaVersion) !== 1 || !Array.isArray(payload.evaluations)) {
    throw new Error('Agent evaluation output must use schemaVersion 1 with an evaluations list.');
  }
  const allowedUrls = new Set((candidates || []).map((job) => canonicalUrl(job.url)));
  const allowedVerdicts = new Set(['recommended', 'possible', 'other', 'hard_blocked']);
  const seen = new Set();
  const evaluations = payload.evaluations.map((item, index) => {
    const url = canonicalUrl(item?.url);
    if (!url || !allowedUrls.has(url)) {
      throw new Error(`Evaluation ${index + 1} references a URL outside the prepared candidate list.`);
    }
    if (seen.has(url)) throw new Error(`Evaluation output contains duplicate URL: ${url}`);
    seen.add(url);
    const verdict = String(item?.verdict || '').trim().toLowerCase();
    if (!allowedVerdicts.has(verdict)) {
      throw new Error(`Evaluation ${index + 1} has unsupported verdict: ${verdict}`);
    }
    const score = Number(item?.score);
    if (!Number.isFinite(score) || score < 1 || score > 5) {
      throw new Error(`Evaluation ${index + 1} score must be between 1 and 5.`);
    }
    const why = String(item?.why || '').trim();
    if (!why) throw new Error(`Evaluation ${index + 1} must include a reason.`);
    return {
      url,
      verdict,
      score,
      why,
      cautions: String(item?.cautions || '').trim(),
      hardBlocker: String(item?.hardBlocker || '').trim(),
    };
  });
  return { schemaVersion: 1, evaluations };
}

export function mergeEvaluations(candidates, evaluationPayload) {
  const byUrl = new Map(
    (evaluationPayload?.evaluations || []).map((item) => [canonicalUrl(item.url), item]),
  );
  return (candidates || []).map((candidate) => {
    const evaluation = byUrl.get(canonicalUrl(candidate.url)) || candidate.evaluation || null;
    return {
      ...candidate,
      evaluation,
      verdict: evaluation?.verdict || candidate.verdict || 'other',
    };
  });
}
