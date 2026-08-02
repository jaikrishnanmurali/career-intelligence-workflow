import { createHash } from 'node:crypto';

import { parse } from 'yaml';

function sourceId(type, label, index) {
  const digest = createHash('sha256')
    .update(`${type}\n${label}\n${index}`)
    .digest('hex')
    .slice(0, 12);
  return `${type}-${digest}`;
}

function enabled(value) {
  return value?.enabled !== false;
}

export function createCoveragePlan(portalsText, { runId, mode }) {
  let portals;
  try {
    portals = parse(String(portalsText || ''));
  } catch (error) {
    throw new Error(`Could not parse Career Ops portals.yml: ${error.message}`);
  }
  if (!portals || typeof portals !== 'object' || Array.isArray(portals)) {
    throw new Error('Career Ops portals.yml must be a YAML object.');
  }
  const companies = Array.isArray(portals.tracked_companies)
    ? portals.tracked_companies.filter(enabled)
    : [];
  const queries = Array.isArray(portals.search_queries)
    ? portals.search_queries.filter(enabled)
    : [];
  const sources = [
    {
      id: 'core-structured',
      type: 'career_ops_core',
      label: 'Career Ops structured parsers and ATS APIs',
      configuredMethod: 'scan.mjs',
    },
    ...companies.map((company, index) => {
      const label = String(company?.name || company?.company || `Company ${index + 1}`).trim();
      return {
        id: sourceId('company', label, index),
        type: 'tracked_company',
        label,
        careersUrl: String(company?.careers_url || '').trim(),
        configuredMethod: String(company?.scan_method || company?.provider || '').trim(),
      };
    }),
    ...queries.map((query, index) => {
      const label = String(query?.name || query?.query || `Search query ${index + 1}`).trim();
      return {
        id: sourceId('query', label, index),
        type: 'web_query',
        label,
        query: String(query?.query || query?.search || '').trim(),
      };
    }),
  ];
  return {
    schemaVersion: 1,
    runId: String(runId || '').trim(),
    mode,
    generatedAt: new Date().toISOString(),
    sources,
  };
}

const ALLOWED_SOURCE_STATUSES = new Set([
  'completed_structured',
  'completed_browser',
  'completed_search',
  'not_required',
  'not_run_discovery_mode',
  'partial',
  'failed',
]);

export function validateCoverageResult(payload, plan, { mode }) {
  if (mode === 'discovery' && !payload) {
    const sources = plan.sources.map((source) => ({
      ...source,
      status: ['structured_feed', 'structured_ats'].includes(source.type)
        ? 'failed'
        : 'not_run_discovery_mode',
      reason: ['structured_feed', 'structured_ats'].includes(source.type)
        ? 'The structured scanner did not produce a source receipt.'
        : 'Discovery Digest does not run browser or broad web-search discovery.',
    }));
    return {
      schemaVersion: 1,
      runId: plan.runId,
      mode,
      completeness: 'reduced',
      completed: 0,
      total: sources.length,
      failures: sources.filter((source) => source.status === 'failed'),
      sources,
      explanation: 'No valid structured source receipt was available. Browser and broad web-search discovery were not run in Discovery Digest mode.',
    };
  }
  if (!payload || Number(payload.schemaVersion) !== 1 || !Array.isArray(payload.sources)) {
    throw new Error('Smart Digest coverage output must use schemaVersion 1 with a sources list.');
  }
  if (String(payload.runId || '') !== String(plan.runId || '')) {
    throw new Error('Coverage output runId does not match the prepared scan.');
  }
  const expected = new Map(plan.sources.map((source) => [source.id, source]));
  const seen = new Set();
  const sources = payload.sources.map((result, index) => {
    const id = String(result?.id || '');
    if (!expected.has(id)) throw new Error(`Coverage result ${index + 1} has an unknown source id.`);
    if (seen.has(id)) throw new Error(`Coverage result contains duplicate source id: ${id}`);
    seen.add(id);
    const status = String(result?.status || '').trim().toLowerCase();
    if (!ALLOWED_SOURCE_STATUSES.has(status)) {
      throw new Error(`Coverage source ${id} has unsupported status: ${status}`);
    }
    return {
      ...expected.get(id),
      status,
      reason: String(result?.reason || '').trim(),
    };
  });
  const missing = plan.sources.filter((source) => !seen.has(source.id));
  for (const source of missing) {
    sources.push({ ...source, status: 'failed', reason: 'The agent did not report this configured source.' });
  }
  const failures = sources.filter((source) => (
    ['failed', 'partial'].includes(source.status)
    || (mode === 'smart' && source.status === 'not_run_discovery_mode')
  ));
  const intentionallyNotRun = mode === 'discovery'
    ? sources.filter((source) => source.status === 'not_run_discovery_mode')
    : [];
  const completed = sources.length - failures.length - intentionallyNotRun.length;
  return {
    schemaVersion: 1,
    runId: plan.runId,
    mode,
    completeness: mode === 'discovery' ? 'reduced' : (failures.length ? 'partial' : 'complete'),
    completed,
    total: sources.length,
    failures,
    sources,
    explanation: mode === 'discovery'
      ? `${completed}/${sources.length} planned lanes completed through structured feeds or ATS endpoints. ${intentionallyNotRun.length} Career Ops browser or broad web-search lane${intentionallyNotRun.length === 1 ? ' was' : 's were'} not run; ${failures.length} structured lane${failures.length === 1 ? ' needs' : 's need'} attention.`
      : failures.length
        ? `${failures.length} configured source${failures.length === 1 ? '' : 's'} were incomplete and will use their last successful catch-up point.`
        : 'Every configured Career Ops company and web-search query was accounted for.',
  };
}

export function coverageLine(coverage) {
  if (!coverage) return 'Coverage could not be verified.';
  if (coverage.completeness === 'reduced') {
    return 'Reduced coverage: configured public feeds and rolling ATS boards ran; LinkedIn, browser and broad web-search sources did not.';
  }
  return `Coverage: ${coverage.completed}/${coverage.total} configured sources completed${coverage.failures?.length ? `; ${coverage.failures.length} need catch-up` : ''}.`;
}
