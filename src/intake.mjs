import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

import { canonicalUrl, decodeHtml } from './util.mjs';

const PLATFORM_HOSTS = [
  ['linkedin', /(^|\.)linkedin\.com$/i],
  ['indeed', /(^|\.)indeed\.[a-z.]+$/i],
  ['glassdoor', /(^|\.)glassdoor\.[a-z.]+$/i],
  ['jobbsafari', /(^|\.)jobbsafari\.se$/i],
  ['iamexpat', /(^|\.)iamexpat\.nl$/i],
  ['karriere-at', /(^|\.)karriere\.at$/i],
  ['climatebase', /(^|\.)(?:jobs\.)?climatebase\.org$/i],
  ['wellfound', /(^|\.)wellfound\.com$/i],
];

const PUBLIC_DETAIL_PLATFORMS = new Set([
  'jobbsafari', 'iamexpat', 'karriere-at', 'climatebase', 'wellfound',
]);

function cleanText(value, maximum = 500) {
  return decodeHtml(String(value || ''))
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximum);
}

function isPrivateIpv4(host) {
  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  return parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || parts[0] === 0;
}

export function safePublicUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (!host || host === 'localhost' || host.endsWith('.local')) return '';
    if (isIP(host) === 4 && isPrivateIpv4(host)) return '';
    if (isIP(host) === 6 && (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:'))) return '';
    return url.href;
  } catch {
    return '';
  }
}

function unwrapRedirect(value) {
  let current = safePublicUrl(decodeHtml(value));
  for (let depth = 0; depth < 3 && current; depth += 1) {
    const url = new URL(current);
    const nested = ['url', 'target', 'dest', 'destination', 'redirect', 'redirect_url']
      .map((key) => url.searchParams.get(key)).find(Boolean);
    if (!nested) break;
    const decoded = safePublicUrl(decodeURIComponent(nested));
    if (!decoded || decoded === current) break;
    current = decoded;
  }
  return current;
}

export function platformForUrl(value) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return PLATFORM_HOSTS.find(([, pattern]) => pattern.test(host))?.[0] || '';
  } catch {
    return '';
  }
}

function platformIdentifier(platform, urlValue) {
  const url = new URL(urlValue);
  if (platform === 'linkedin') {
    return url.pathname.match(/\/(?:comm\/)?jobs\/view\/(?:[^/]*-)?(\d+)/i)?.[1]
      || url.searchParams.get('currentJobId')
      || '';
  }
  if (platform === 'indeed') return url.searchParams.get('jk') || '';
  if (platform === 'glassdoor') {
    return url.searchParams.get('jobListingId')
      || url.searchParams.get('jl')
      || url.searchParams.get('jobId')
      || url.pathname.match(/(?:-|\/)(\d{6,})(?:\.htm)?$/i)?.[1]
      || '';
  }
  if (platform === 'karriere-at') return url.pathname.match(/\/jobs\/(\d+)/i)?.[1] || '';
  if (platform === 'wellfound') return url.pathname.match(/\/jobs\/(\d+)/i)?.[1] || '';
  if (platform === 'climatebase') return url.pathname.match(/\/job\/(\d+)/i)?.[1] || url.pathname.replace(/\/$/, '');
  return url.pathname.replace(/\/$/, '') || canonicalUrl(url.href);
}

export function canonicalPlatformLead(value) {
  const unwrapped = unwrapRedirect(value);
  const platform = platformForUrl(unwrapped);
  if (!platform) return null;
  const url = new URL(unwrapped);
  const id = platformIdentifier(platform, unwrapped);
  if (!id) return null;
  let boardUrl = canonicalUrl(unwrapped);
  if (platform === 'linkedin') boardUrl = `https://www.linkedin.com/jobs/view/${id}`;
  if (platform === 'indeed') boardUrl = `${url.origin}/viewjob?jk=${encodeURIComponent(id)}`;
  if (platform === 'wellfound') boardUrl = `https://wellfound.com/jobs/${id}`;
  return { platform, boardJobId: id, candidateKey: `${platform}:${id}`, boardUrl };
}

function linkCandidates(html, text) {
  const links = [];
  for (const match of String(html || '').matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    links.push({ url: match[1], label: cleanText(match[2], 300) });
  }
  for (const match of String(text || '').matchAll(/https?:\/\/[^\s<>"')]+/gi)) {
    links.push({ url: match[0], label: '' });
  }
  return links;
}

export function parseAlertEmail(email) {
  const byKey = new Map();
  for (const link of linkCandidates(email?.html, email?.text)) {
    const identity = canonicalPlatformLead(link.url);
    if (!identity) continue;
    const prior = byKey.get(identity.candidateKey);
    const label = cleanText(link.label, 300);
    if (!prior || label.length > prior.title.length) {
      byKey.set(identity.candidateKey, {
        ...identity,
        title: label && !/^(apply|view|see job|learn more|details)$/i.test(label) ? label : '',
        company: '',
        location: '',
        sourcePostedText: '',
        postedAt: null,
        postingPrecision: 'unknown',
        description: '',
        officialUrl: null,
        specStatus: 'unresolved',
        applicationActive: null,
        status: 'pending',
      });
    }
  }
  return [...byKey.values()];
}

function jsonLdObjects(html) {
  const values = [];
  for (const match of String(html || '').matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(decodeHtml(match[1]));
      const queue = Array.isArray(parsed) ? [...parsed] : [parsed];
      while (queue.length) {
        const item = queue.shift();
        if (!item || typeof item !== 'object') continue;
        values.push(item);
        if (Array.isArray(item['@graph'])) queue.push(...item['@graph']);
      }
    } catch { /* malformed third-party JSON-LD is ignored */ }
  }
  return values;
}

function locationText(value) {
  const locations = Array.isArray(value) ? value : [value];
  return locations.map((location) => {
    if (typeof location === 'string') return location;
    const address = location?.address || {};
    return [address.addressLocality, address.addressRegion, address.addressCountry]
      .map((part) => typeof part === 'object' ? part.name : part)
      .filter(Boolean).join(', ');
  }).filter(Boolean).join(' | ');
}

export function extractJobPosting(html, pageUrl) {
  const posting = jsonLdObjects(html).find((item) => {
    const type = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
    return type.some((value) => String(value).toLowerCase() === 'jobposting');
  });
  if (!posting) return null;
  const title = cleanText(posting.title || posting.name, 300);
  const company = cleanText(posting.hiringOrganization?.name || posting.organization?.name, 300);
  const description = cleanText(posting.description, 500_000);
  if (!title || !company || description.length < 200) return null;
  const postedAt = Number.isFinite(Date.parse(posting.datePosted))
    ? new Date(posting.datePosted).toISOString() : null;
  const expired = Number.isFinite(Date.parse(posting.validThrough))
    && Date.parse(posting.validThrough) < Date.now();
  const canonical = safePublicUrl(posting.url) || safePublicUrl(pageUrl);
  return {
    title,
    company,
    location: cleanText(locationText(posting.jobLocation) || posting.jobLocationType, 300),
    description,
    postedAt,
    postingPrecision: postedAt ? 'exact' : 'unknown',
    postedAtEvidence: postedAt ? 'JobPosting datePosted on the public detail page.' : '',
    officialUrl: canonical,
    specStatus: expired ? 'expired' : 'verified',
    applicationActive: !expired,
    status: expired ? 'rejected' : 'parsed',
  };
}

async function fetchFollowingSafeRedirects(initialUrl, { fetchImpl, signal, maximum = 5 }) {
  let current = initialUrl;
  for (let count = 0; count <= maximum; count += 1) {
    const response = await fetchImpl(current, {
      redirect: 'manual',
      signal,
      headers: { accept: 'text/html', 'user-agent': 'CareerIntelligenceWorkflow/1.3' },
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    if (count === maximum) throw new Error('Too many redirects while resolving a platform lead.');
    const location = response.headers?.get?.('location');
    if (!location) throw new Error('A redirect response did not include a destination.');
    const next = safePublicUrl(new URL(location, current).href);
    if (!next) throw new Error('A platform lead redirected to a non-public address.');
    current = next;
  }
  throw new Error('Could not resolve the platform lead.');
}

export async function resolvePublicLead(lead, { fetchImpl = fetch, timeoutMs = 12_000 } = {}) {
  if (!PUBLIC_DETAIL_PLATFORMS.has(lead.platform)) return lead;
  const safeUrl = safePublicUrl(lead.boardUrl);
  if (!safeUrl || platformForUrl(safeUrl) !== lead.platform) return { ...lead, specStatus: 'manual_review' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFollowingSafeRedirects(safeUrl, {
      fetchImpl,
      signal: controller.signal,
    });
    if (!response.ok) return { ...lead, specStatus: 'manual_review' };
    const html = (await response.text()).slice(0, 1_500_000);
    const posting = extractJobPosting(html, response.url || safeUrl);
    return posting ? { ...lead, ...posting } : { ...lead, specStatus: 'manual_review' };
  } catch {
    return { ...lead, specStatus: 'manual_review' };
  } finally {
    clearTimeout(timer);
  }
}

export function hashInboundIdentity(value) {
  return createHash('sha256').update(String(value || '')).digest('hex');
}
