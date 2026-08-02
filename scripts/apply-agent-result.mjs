#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

import { readEvaluationPayload } from '../src/career-ops.mjs';
import { validateCoverageResult } from '../src/coverage.mjs';
import { atomicWriteJson, canonicalUrl, readJson } from '../src/util.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CAREER_OPS_ROOT = path.resolve(process.env.CAREER_OPS_ROOT || path.join(ROOT, '..', '..'));
const STATE_ROOT = path.join(ROOT, 'state');

function clean(value, maximum) {
  return String(value || '').replace(/[\t\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maximum);
}

function readAgentJson() {
  const raw = String(process.env.CAREER_AGENT_RESULT || '').trim();
  if (!raw) return null;
  try { return JSON.parse(raw); }
  catch (error) { throw new Error(`Agent output was not valid JSON: ${error.message}`); }
}

async function applyDiscovery(payload) {
  const plan = await readJson(path.join(STATE_ROOT, 'coverage-plan.json'), null);
  const context = await readJson(path.join(STATE_ROOT, 'run-context.json'), null);
  if (!plan?.runId || !context?.runId || plan.runId !== context.runId) {
    throw new Error('Coverage plan and run context are missing or mismatched.');
  }
  const structuredReceipt = await readJson(path.join(STATE_ROOT, 'coverage-result.json'), { sources: [] });
  const priorById = new Map((structuredReceipt.sources || []).map((source) => [source.id, source]));
  const agentById = new Map((payload?.sources || []).map((source) => [source.id, source]));
  const fallbackSources = plan.sources.map((source) => {
    const prior = priorById.get(source.id);
    const agent = agentById.get(source.id);
    if (['career_ops_core', 'structured_feed', 'structured_ats', 'platform_alert'].includes(source.type) && prior) {
      return { id: source.id, status: prior.status, reason: prior.reason };
    }
    if (agent) return agent;
    return {
      id: source.id,
      status: 'failed',
      reason: 'The Smart discovery worker produced no valid result for this source.',
    };
  });
  const candidatePayload = payload || {
    schemaVersion: 1,
    runId: plan.runId,
    sources: fallbackSources,
    discoveries: [],
  };
  candidatePayload.sources = fallbackSources;
  if (Number(candidatePayload.schemaVersion) !== 1 || candidatePayload.runId !== plan.runId) {
    throw new Error('Discovery result schemaVersion or runId is invalid.');
  }
  const coverage = validateCoverageResult(candidatePayload, plan, { mode: 'smart' });
  await atomicWriteJson(path.join(STATE_ROOT, 'coverage-result.json'), {
    schemaVersion: 1,
    runId: plan.runId,
    sources: coverage.sources.map(({ id, status, reason }) => ({ id, status, reason })),
  });

  const allowedSources = new Set(plan.sources.map((source) => source.id));
  const rawDiscoveries = Array.isArray(candidatePayload.discoveries)
    ? candidatePayload.discoveries.slice(0, 200) : [];
  const discoveries = rawDiscoveries.filter((item) => item?.active === true).map((item, index) => {
    const sourceId = clean(item.sourceId, 100);
    const url = canonicalUrl(item.url);
    if (!allowedSources.has(sourceId)) throw new Error(`Discovery ${index + 1} has an unknown sourceId.`);
    if (!url) throw new Error(`Discovery ${index + 1} has an invalid URL.`);
    const title = clean(item.title, 300);
    const company = clean(item.company, 300);
    if (!title || !company) throw new Error(`Discovery ${index + 1} needs title and company.`);
    const posted = item.postedAt ? Date.parse(item.postedAt) : NaN;
    return {
      url,
      title,
      company,
      location: clean(item.location, 300),
      source: `smart:${sourceId}`,
      postedAt: Number.isFinite(posted) ? posted : null,
      description: String(item.description || '').slice(0, 4000),
    };
  });

  process.chdir(CAREER_OPS_ROOT);
  const scan = await import(pathToFileURL(path.join(CAREER_OPS_ROOT, 'scan.mjs')).href);
  const fingerprint = await import(pathToFileURL(path.join(CAREER_OPS_ROOT, 'fingerprint-core.mjs')).href);
  const seenUrls = scan.loadSeenUrls().seen;
  const unique = [];
  const seenBatch = new Set();
  for (const offer of discoveries) {
    const normalized = scan.normalizeUrlForDedup(offer.url);
    if (seenUrls.has(normalized) || seenBatch.has(normalized)) continue;
    seenBatch.add(normalized);
    offer.fingerprint = fingerprint.fingerprintText(offer.description);
    unique.push(offer);
  }
  const crossListings = fingerprint.findCrossListings(unique, scan.loadFingerprintHistory());
  const duplicateOffers = new Set(crossListings.map((match) => match.offer));
  const accepted = unique.filter((offer) => !duplicateOffers.has(offer));
  if (accepted.length) {
    await scan.appendToPipeline(accepted);
    scan.appendToScanHistory(accepted, new Date().toISOString(), 'added');
  }
  process.stdout.write(`Applied ${accepted.length} clean Smart discoveries; rejected ${unique.length - accepted.length} Career Ops cross-listings.\n`);
}

async function applyEvaluation(payload) {
  const candidates = await readJson(path.join(STATE_ROOT, 'candidates.json'), null);
  if (!candidates?.runId) throw new Error('Prepared candidates are missing.');
  const candidatePayload = payload || {
    schemaVersion: 1,
    runId: candidates.runId,
    evaluations: [],
  };
  if (candidatePayload.runId !== candidates.runId) throw new Error('Evaluation runId is invalid.');
  const validated = readEvaluationPayload(candidatePayload, candidates.evaluateNow || []);
  await atomicWriteJson(path.join(STATE_ROOT, 'evaluations.json'), {
    ...validated,
    runId: candidates.runId,
  });
  process.stdout.write(`Applied ${validated.evaluations.length} bounded evaluations.\n`);
}

const command = process.argv[2];
const payload = readAgentJson();
if (command === 'discovery') await applyDiscovery(payload);
else if (command === 'evaluation') await applyEvaluation(payload);
else throw new Error('Usage: node scripts/apply-agent-result.mjs discovery|evaluation');
