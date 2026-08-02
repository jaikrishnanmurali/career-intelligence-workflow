#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MAX_FULL_EVALUATIONS } from '../src/config.mjs';
import {
  addedCandidates,
  parseScanHistory,
  SCAN_HISTORY_HEADER,
} from '../src/career-ops.mjs';
import { atomicWriteJson, readJson } from '../src/util.mjs';

const EXTENSION_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const careerOpsRoot = path.resolve(
  process.env.CAREER_OPS_ROOT || path.join(EXTENSION_ROOT, '..', '..'),
);
const stateRoot = path.join(EXTENSION_ROOT, 'state');
async function readHistory(filePath) {
  try {
    const text = await readFile(filePath, 'utf8');
    return text || `${SCAN_HISTORY_HEADER}\n`;
  } catch (error) {
    if (error?.code === 'ENOENT') return `${SCAN_HISTORY_HEADER}\n`;
    throw error;
  }
}
const beforeRows = parseScanHistory(
  await readHistory(path.join(stateRoot, 'before-scan.tsv')),
);
const afterRows = parseScanHistory(
  await readHistory(path.join(careerOpsRoot, 'data', 'scan-history.tsv')),
);
const state = await readJson(path.join(stateRoot, 'state.json'), {
  version: 2,
  sentKeys: [],
});
const context = await readJson(path.join(stateRoot, 'run-context.json'), null);
if (!context?.runId) throw new Error('Run context is missing. Run the Career Ops core scan first.');
const existing = await readJson(path.join(stateRoot, 'candidates.json'), null);
const discovered = addedCandidates(beforeRows, afterRows, state.sentKeys || []);
const byUrl = new Map();
for (const candidate of [...(existing?.candidates || []), ...discovered]) {
  byUrl.set(candidate.url, candidate);
}
const candidates = [...byUrl.values()];
const payload = {
  schemaVersion: 1,
  runId: context.runId,
  generatedAt: new Date().toISOString(),
  candidates,
  evaluateNow: candidates.slice(0, MAX_FULL_EVALUATIONS),
  awaitingEvaluation: candidates.slice(MAX_FULL_EVALUATIONS),
};
await atomicWriteJson(path.join(stateRoot, 'candidates.json'), payload);
process.stdout.write(
  `${candidates.length} unsent Career Ops discoveries prepared; `
  + `${payload.evaluateNow.length} fit inside this run's evaluation budget and `
  + `${payload.awaitingEvaluation.length} will still appear as unscored.\n`,
);
