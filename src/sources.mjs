import {
  ATS_DIRECTORIES,
  DEFAULT_ATS_BOARDS_PER_SOURCE,
  DEFAULT_MAX_SCAN_MINUTES,
  ENABLED_ATS_SOURCES,
  ENABLED_DIRECT_SOURCES,
  WTTJ_QUERIES,
} from './config.mjs';
import {
  fetchJson,
  fetchText,
  parallelMapLimit,
  stripHtml,
} from './util.mjs';

function epoch(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }
  const parsed = Date.parse(String(value || ''));
  return Number.isNaN(parsed) ? null : parsed;
}

function job(fields) {
  const title = String(fields.title || '').trim();
  const url = String(fields.url || '').trim();
  if (!title || !/^https?:\/\//i.test(url)) return null;
  return {
    title,
    url,
    company: String(fields.company || 'Unknown company').trim(),
    location: String(fields.location || '').trim(),
    description: stripHtml(fields.description || ''),
    postedAt: fields.postedAt == null ? null : new Date(fields.postedAt).toISOString(),
    postingPrecision: fields.postingPrecision || (fields.postedAt ? 'exact' : 'unknown'),
    postedAtEvidence: String(fields.postedAtEvidence || '').trim(),
    source: String(fields.source || 'unknown'),
    boardKey: fields.boardKey || null,
  };
}

async function arbeitnow() {
  const jobs = [];
  for (let page = 1; page <= 3; page++) {
    const json = await fetchJson(`https://www.arbeitnow.com/api/job-board-api?page=${page}`);
    if (!Array.isArray(json?.data)) break;
    for (const item of json.data) {
      const normalized = job({
        title: item.title,
        url: item.url,
        company: item.company_name,
        location: [item.location, item.remote ? 'Remote' : ''].filter(Boolean).join(', '),
        description: item.description,
        postedAt: epoch(item.created_at),
        // Arbeitnow aggregates from ATS systems; created_at is its ingestion
        // time, not a confirmed employer publication time. Treat as likely.
        postingPrecision: 'relative',
        postedAtEvidence: 'Arbeitnow aggregator created_at; original employer publication time not confirmed.',
        source: 'arbeitnow',
      });
      if (normalized) jobs.push(normalized);
    }
    if (json.data.length < 100) break;
  }
  return jobs;
}

async function jobicy() {
  const json = await fetchJson('https://jobicy.com/api/v2/remote-jobs?count=50');
  return (Array.isArray(json?.jobs) ? json.jobs : [])
    .map((item) => job({
      title: item.jobTitle,
      url: item.url,
      company: item.companyName,
      location: item.jobGeo || 'Remote',
      description: item.jobDescription,
      postedAt: epoch(item.pubDate),
      postedAtEvidence: 'Jobicy pubDate timestamp',
      source: 'jobicy',
    }))
    .filter(Boolean);
}

async function himalayas() {
  const json = await fetchJson('https://himalayas.app/jobs/api?limit=50');
  return (Array.isArray(json?.jobs) ? json.jobs : [])
    .map((item) => job({
      title: item.title,
      url: item.applicationLink || item.guid,
      company: item.companyName,
      location: Array.isArray(item.locationRestrictions)
        ? item.locationRestrictions.join(', ')
        : 'Remote',
      description: item.description || item.excerpt,
      postedAt: epoch(item.pubDate),
      postedAtEvidence: 'Himalayas pubDate timestamp',
      source: 'himalayas',
    }))
    .filter(Boolean);
}

async function remotive() {
  const json = await fetchJson('https://remotive.com/api/remote-jobs');
  return (Array.isArray(json?.jobs) ? json.jobs : [])
    .map((item) => job({
      title: item.title,
      url: item.url,
      company: item.company_name,
      location: item.candidate_required_location || 'Remote',
      description: item.description,
      postedAt: epoch(item.publication_date),
      postedAtEvidence: 'Remotive publication_date timestamp',
      source: 'remotive',
    }))
    .filter(Boolean);
}

async function remoteOk() {
  const json = await fetchJson('https://remoteok.com/api');
  return (Array.isArray(json) ? json.slice(1) : [])
    .map((item) => job({
      title: item.position,
      url: item.url || item.apply_url,
      company: item.company,
      location: item.location || 'Remote',
      description: item.description,
      postedAt: epoch(item.epoch || item.date),
      postedAtEvidence: 'Remote OK published timestamp',
      source: 'remoteok',
    }))
    .filter(Boolean);
}

async function theHub() {
  const jobs = [];
  for (let page = 1; page <= 8; page++) {
    const json = await fetchJson(`https://thehub.io/api/jobs?page=${page}`);
    if (!Array.isArray(json?.docs)) break;
    for (const item of json.docs) {
      const location = item.location?.address
        || [item.location?.locality, item.location?.country].filter(Boolean).join(', ');
      const normalized = job({
        title: item.title,
        url: item.absoluteJobUrl,
        company: item.company?.name,
        location: [location, item.isRemote ? 'Remote' : ''].filter(Boolean).join(', '),
        description: item.description || item.content,
        postedAt: epoch(item.publishedAt || item.createdAt),
        postedAtEvidence: 'The Hub publishedAt timestamp',
        source: 'thehub',
      });
      if (normalized) jobs.push(normalized);
    }
    if (json.docs.length < 15 || page >= Number(json.pages || 0)) break;
  }
  return jobs;
}

function parseWttjEnv(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('WTTJ environment payload was invalid');
  const env = JSON.parse(text.slice(start, end + 1));
  const appId = String(env.PUBLIC_ALGOLIA_APPLICATION_ID || '').trim();
  const apiKey = String(env.PUBLIC_ALGOLIA_API_KEY_CLIENT || '').trim();
  if (!/^[A-Z0-9]{6,16}$/i.test(appId) || apiKey.length < 16) {
    throw new Error('WTTJ public search credentials were unavailable');
  }
  return { appId, apiKey };
}

async function wttj() {
  const envResponse = await fetchText('https://www.welcometothejungle.com/api/env');
  const { appId, apiKey } = parseWttjEnv(envResponse.text);
  const endpoint = `https://${appId}-dsn.algolia.net/1/indexes/wttj_jobs_production_en/query`;
  const byUrl = new Map();
  for (const query of WTTJ_QUERIES) {
    const params = new URLSearchParams({
      query,
      hitsPerPage: '80',
      attributesToRetrieve: [
        'name',
        'slug',
        'organization',
        'offices',
        'remote',
        'published_at_timestamp',
        'description',
      ].join(','),
    });
    const json = await fetchJson(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        referer: 'https://www.welcometothejungle.com/',
        'x-algolia-application-id': appId,
        'x-algolia-api-key': apiKey,
      },
      body: JSON.stringify({ params: params.toString() }),
    });
    for (const item of Array.isArray(json?.hits) ? json.hits : []) {
      const orgSlug = item.organization?.slug;
      if (!item.slug || !orgSlug) continue;
      const office = Array.isArray(item.offices) ? item.offices[0] : null;
      const normalized = job({
        title: item.name,
        url: `https://www.welcometothejungle.com/en/companies/${orgSlug}/jobs/${item.slug}`,
        company: item.organization?.name,
        location: [
          office?.city,
          office?.country,
          item.remote === 'fulltime' ? 'Remote' : '',
        ].filter(Boolean).join(', '),
        description: item.description,
        postedAt: epoch(item.published_at_timestamp),
        postedAtEvidence: 'Welcome to the Jungle published_at timestamp',
        source: 'wttj',
      });
      if (normalized) byUrl.set(normalized.url, normalized);
    }
  }
  return [...byUrl.values()];
}

async function jobtech(now) {
  const since = new Date(now.getTime() - 13 * 3_600_000)
    .toISOString()
    .slice(0, 19);
  const json = await fetchJson(
    `https://jobstream.api.jobtechdev.se/stream?date=${encodeURIComponent(since)}`,
    { timeoutMs: 30_000 },
  );
  const items = Array.isArray(json) ? json : Array.isArray(json?.hits) ? json.hits : [];
  return items
    .filter((item) => !item.removed)
    .map((item) => {
      const address = item.workplace_address || {};
      return job({
        title: item.headline,
        url: item.webpage_url || `https://arbetsformedlingen.se/platsbanken/annonser/${item.id}`,
        company: item.employer?.name,
        location: [
          address.municipality,
          address.region,
          address.country,
        ].filter(Boolean).join(', '),
        description: item.description?.text_formatted || item.description?.text,
        postedAt: epoch(item.publication_date),
        postedAtEvidence: 'ArbetsfÃ¶rmedlingen JobStream publication_date timestamp',
        source: 'platsbanken-jobstream',
      });
    })
    .filter(Boolean);
}

const DIRECT_SOURCES = {
  'platsbanken-jobstream': jobtech,
  arbeitnow,
  thehub: theHub,
  wttj,
  jobicy,
  himalayas,
  remotive,
  remoteok: remoteOk,
};

async function fetchGreenhouse(slug) {
  const json = await fetchJson(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`,
    { timeoutMs: 10_000 },
  );
  return (Array.isArray(json?.jobs) ? json.jobs : [])
    .map((item) => job({
      title: item.title,
      url: item.absolute_url,
      company: slug,
      location: item.location?.name,
      description: item.content,
      postedAt: epoch(item.first_published),
      postedAtEvidence: 'Greenhouse first_published timestamp',
      source: 'greenhouse',
      boardKey: slug,
    }))
    .filter(Boolean);
}

async function fetchLever(slug) {
  const json = await fetchJson(
    `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`,
    { timeoutMs: 10_000 },
  );
  return (Array.isArray(json) ? json : [])
    .map((item) => job({
      title: item.text,
      url: item.hostedUrl,
      company: slug,
      location: item.categories?.location,
      description: item.descriptionPlain,
      postedAt: epoch(item.createdAt),
      postedAtEvidence: 'Lever createdAt timestamp',
      source: 'lever',
      boardKey: slug,
    }))
    .filter(Boolean);
}

async function fetchAshby(slug) {
  const json = await fetchJson(
    `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}?includeCompensation=true`,
    { timeoutMs: 10_000 },
  );
  return (Array.isArray(json?.jobs) ? json.jobs : [])
    .map((item) => job({
      title: item.title,
      url: item.jobUrl,
      company: slug,
      location: [
        item.location,
        ...(Array.isArray(item.secondaryLocations)
          ? item.secondaryLocations.map((loc) => loc.location)
          : []),
      ].filter(Boolean).join(', '),
      description: item.descriptionHtml || item.description,
      postedAt: epoch(item.publishedAt),
      postedAtEvidence: 'Ashby publishedAt timestamp',
      source: 'ashby',
      boardKey: slug,
    }))
    .filter(Boolean);
}

function workdayDate(label, now) {
  if (/posted\s+today/i.test(label || '')) {
    return { postedAt: now.getTime(), evidence: 'Workday says â€œPosted Todayâ€' };
  }
  if (/posted\s+yesterday/i.test(label || '')) {
    return {
      postedAt: now.getTime() - 86_400_000,
      evidence: 'Workday says â€œPosted Yesterdayâ€',
    };
  }
  const match = String(label || '').match(/posted\s+(\d+)(\+?)\s*day/i);
  if (!match || match[2]) return { postedAt: null, evidence: String(label || '') };
  return {
    postedAt: now.getTime() - Number(match[1]) * 86_400_000,
    evidence: String(label || ''),
  };
}

async function fetchWorkday(key, now) {
  const [tenant, instance, site] = String(key).split('|');
  if (![tenant, instance, site].every((part) => /^[A-Za-z0-9._-]+$/.test(part || ''))) {
    return [];
  }
  const origin = `https://${tenant}.${instance}.myworkdayjobs.com`;
  // Workday rejects page sizes larger than 20. Page through them so a board is
  // still covered to roughly the original single-request intent.
  const pageSize = 20;
  const maxPages = 5;
  const jobs = [];
  for (let page = 0; page < maxPages; page += 1) {
    let json;
    try {
      json = await fetchJson(`${origin}/wday/cxs/${tenant}/${site}/jobs`, {
        method: 'POST',
        timeoutMs: 12_000,
        headers: {
          'content-type': 'application/json',
          origin,
          referer: `${origin}/${site}`,
        },
        body: JSON.stringify({
          appliedFacets: {},
          limit: pageSize,
          offset: page * pageSize,
          searchText: '',
        }),
      });
    } catch (error) {
      // A first-page failure means the board is genuinely broken; surface it so
      // the coverage receipt records a failure instead of hiding it as empty.
      if (page === 0) throw error;
      break;
    }
    const postings = Array.isArray(json?.jobPostings) ? json.jobPostings : [];
    for (const item of postings) {
      const freshness = workdayDate(item.postedOn, now);
      const normalized = job({
        title: item.title,
        url: item.externalPath ? `${origin}/${site}${item.externalPath}` : '',
        company: tenant,
        location: item.locationsText,
        postedAt: freshness.postedAt,
        postingPrecision: freshness.postedAt ? 'relative' : 'unknown',
        postedAtEvidence: freshness.evidence,
        source: 'workday',
        boardKey: key,
      });
      if (normalized) jobs.push(normalized);
    }
    if (postings.length < pageSize) break;
  }
  return jobs;
}

const ATS_FETCHERS = {
  greenhouse: fetchGreenhouse,
  lever: fetchLever,
  ashby: fetchAshby,
  workday: fetchWorkday,
};

function cyclicSlice(values, start, count) {
  if (!values.length || count <= 0) return [];
  const out = [];
  for (let index = 0; index < Math.min(count, values.length); index++) {
    out.push(values[(start + index) % values.length]);
  }
  return out;
}

async function scanAts(name, state, now, deadline) {
  const available = await fetchJson(ATS_DIRECTORIES[name], { timeoutMs: 30_000 });
  const list = Array.isArray(available) ? available.map(String).filter(Boolean) : [];
  const perSource = Math.max(
    25,
    Number(process.env.ATS_BOARDS_PER_SOURCE) || DEFAULT_ATS_BOARDS_PER_SOURCE,
  );
  const cursor = Number(state.sourceCursors?.[name]) || 0;
  const priority = Array.isArray(state.priorityBoards?.[name])
    ? state.priorityBoards[name].filter((key) => list.includes(key))
    : [];
  const regular = cyclicSlice(list, cursor, perSource);
  const boards = [...new Set([...priority, ...regular])];
  const fetcher = ATS_FETCHERS[name];
  let failures = 0;
  let completed = 0;
  const nested = await parallelMapLimit(boards, 18, async (boardKey) => {
    if (Date.now() >= deadline) return [];
    try {
      const jobs = await fetcher(boardKey, now);
      completed++;
      return jobs;
    } catch {
      failures++;
      completed++;
      return [];
    }
  });
  return {
    jobs: nested.flat(),
    nextCursor: list.length ? (cursor + regular.length) % list.length : 0,
    stats: {
      source: name,
      boardsAvailable: list.length,
      boardsRequested: boards.length,
      boardsCompleted: completed,
      failures,
    },
  };
}

export async function scanAllSources(state, scanStartedAt) {
  const now = new Date(scanStartedAt);
  const maxMinutes = Math.max(
    2,
    Number(process.env.MAX_SCAN_MINUTES) || DEFAULT_MAX_SCAN_MINUTES,
  );
  const deadline = Date.now() + maxMinutes * 60_000;
  const jobs = [];
  const stats = [];
  const sourceCursors = { ...(state.sourceCursors || {}) };

  const directResults = await Promise.all(
    Object.entries(DIRECT_SOURCES)
      .filter(([name]) => ENABLED_DIRECT_SOURCES.includes(name))
      .map(async ([name, fetcher]) => {
      try {
        const items = await fetcher(now);
        return { name, jobs: items, error: null };
      } catch (error) {
        return { name, jobs: [], error: error.message };
      }
    }),
  );
  for (const result of directResults) {
    jobs.push(...result.jobs);
    stats.push({
      source: result.name,
      jobsFound: result.jobs.length,
      failures: result.error ? 1 : 0,
      error: result.error,
    });
  }

  for (const name of ENABLED_ATS_SOURCES) {
    if (!ATS_DIRECTORIES[name] || !ATS_FETCHERS[name]) {
      stats.push({ source: name, failures: 1, error: 'Unsupported ATS source in configuration.' });
      continue;
    }
    if (Date.now() >= deadline) {
      stats.push({ source: name, skipped: 'scan deadline reached' });
      continue;
    }
    try {
      const result = await scanAts(name, state, now, deadline);
      jobs.push(...result.jobs);
      stats.push(result.stats);
      sourceCursors[name] = result.nextCursor;
    } catch (error) {
      stats.push({ source: name, failures: 1, error: error.message });
    }
  }

  return {
    jobs,
    stats,
    sourceCursors,
    elapsedMs: Date.now() - now.getTime(),
  };
}

