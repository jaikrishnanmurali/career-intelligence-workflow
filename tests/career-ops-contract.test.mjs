import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SCAN_HISTORY_HEADER,
  addedCandidates,
  jobIdentityKeys,
  mergeEvaluations,
  parseScanHistory,
  readEvaluationPayload,
  supportedCareerOpsVersion,
} from '../src/career-ops.mjs';
import { createCoveragePlan, validateCoverageResult } from '../src/coverage.mjs';

const row = (url, fingerprint, status = 'added') => [
  url,
  '2026-07-30T08:00:00.000Z',
  'example',
  'Product Marketing Specialist',
  'Example Company',
  status,
  'Stockholm, Sweden',
  fingerprint,
  '',
].join('\t');

test('pins Career Ops to the validated 1.22 through 1.24 schema range', () => {
  assert.equal(supportedCareerOpsVersion('1.22.0'), true);
  assert.equal(supportedCareerOpsVersion('1.23.9'), true);
  assert.equal(supportedCareerOpsVersion('1.24.0'), true);
  assert.equal(supportedCareerOpsVersion('1.24.9'), true);
  assert.equal(supportedCareerOpsVersion('v1.24.1'), true);
  assert.equal(supportedCareerOpsVersion('1.21.9'), false);
  assert.equal(supportedCareerOpsVersion('1.25.0'), false);
  assert.throws(() => parseScanHistory('url\twrong\n'), /Unsupported.*schema/);
});

test('keeps Smart discoveries compatible with Career Ops history and SimHash identities', () => {
  const before = parseScanHistory(`${SCAN_HISTORY_HEADER}\n${row('https://example.com/old', 'aaaaaaaaaaaaaaaa')}\n`);
  const after = parseScanHistory([
    SCAN_HISTORY_HEADER,
    row('https://example.com/old', 'aaaaaaaaaaaaaaaa'),
    row('https://example.com/new?utm_source=test', 'bbbbbbbbbbbbbbbb'),
    row('https://mirror.example.com/new', 'bbbbbbbbbbbbbbbb'),
  ].join('\n'));
  const candidates = addedCandidates(before, after, []);
  assert.equal(candidates.length, 1);
  assert.deepEqual(jobIdentityKeys(candidates[0]), [
    'url:https://example.com/new',
    'fingerprint:bbbbbbbbbbbbbbbb',
  ]);
  assert.equal(addedCandidates(before, after, ['fingerprint:bbbbbbbbbbbbbbbb']).length, 0);
});

test('evaluation cannot reference jobs outside the prepared list', () => {
  const candidates = parseScanHistory(`${SCAN_HISTORY_HEADER}\n${row('https://example.com/new', 'bbbbbbbbbbbbbbbb')}\n`);
  assert.throws(() => readEvaluationPayload({
    schemaVersion: 1,
    evaluations: [{
      url: 'https://attacker.example/job', verdict: 'recommended', score: 5, why: 'No.',
    }],
  }, candidates), /outside the prepared candidate list/);
  const payload = readEvaluationPayload({
    schemaVersion: 1,
    evaluations: [{
      url: candidates[0].url, verdict: 'possible', score: 3.5, why: 'Some overlap.',
    }],
  }, candidates);
  assert.equal(mergeEvaluations(candidates, payload)[0].verdict, 'possible');
});

test('Discovery coverage names every lane it deliberately does not run', () => {
  const plan = createCoveragePlan(`
tracked_companies:
  - name: Example Careers
    careers_url: https://example.com/careers
search_queries:
  - name: LinkedIn target roles
    query: site:linkedin.com/jobs/view product marketing Sweden
`, { runId: 'run-1', mode: 'discovery' });
  plan.sources = [
    { id: 'greenhouse', type: 'structured_ats', label: 'Greenhouse' },
    ...plan.sources.filter((source) => source.id !== 'core-structured'),
  ];
  const result = validateCoverageResult({
    schemaVersion: 1,
    runId: 'run-1',
    sources: plan.sources.map((source) => ({
      id: source.id,
      status: source.id === 'greenhouse' ? 'completed_structured' : 'not_run_discovery_mode',
      reason: source.id === 'greenhouse' ? 'Structured board completed.' : 'Needs browser or search.',
    })),
  }, plan, { mode: 'discovery' });
  assert.equal(result.completeness, 'reduced');
  assert.equal(result.sources.find((source) => source.id === 'greenhouse').status, 'completed_structured');
  assert.equal(result.sources.filter((source) => source.status === 'not_run_discovery_mode').length, 2);
});

test('Smart coverage fails missing sources visibly instead of claiming completeness', () => {
  const plan = createCoveragePlan(`search_queries:\n  - name: LinkedIn\n    query: site:linkedin.com/jobs/view\n`, {
    runId: 'run-2', mode: 'smart',
  });
  const result = validateCoverageResult({
    schemaVersion: 1,
    runId: 'run-2',
    sources: [{ id: 'core-structured', status: 'completed_structured', reason: '' }],
  }, plan, { mode: 'smart' });
  assert.equal(result.completeness, 'partial');
  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0].reason, /did not report/);
});
