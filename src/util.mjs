import { createHash } from 'node:crypto';
import {
  mkdir,
  readFile,
  rename,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';

import { TIME_ZONE } from './config.mjs';
const REQUEST_TIMEOUT_MS = 20_000;

export function normalizeText(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}+#./-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function decodeHtml(value) {
  return String(value || '')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

export function stripHtml(value) {
  return normalizeText(
    decodeHtml(
      String(value || '')
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' '),
    ),
  );
}

export function canonicalUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    const tracking = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'gh_src',
      'lever-source',
      'source',
      'ref',
      'referrer',
      'trk',
      'trackingId',
    ];
    for (const key of tracking) url.searchParams.delete(key);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    [...url.searchParams.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([key]) => {
        const values = url.searchParams.getAll(key);
        url.searchParams.delete(key);
        for (const item of values) url.searchParams.append(key, item);
      });
    return url.href;
  } catch {
    return '';
  }
}

export function hashKey(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

export function isWithinHours(value, endValue, hours) {
  const time = new Date(value).getTime();
  const end = new Date(endValue).getTime();
  if (!Number.isFinite(time) || !Number.isFinite(end)) return false;
  return time >= end - Number(hours) * 3_600_000 && time <= end + 5 * 60_000;
}

export function formatLocalTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return date.toLocaleString('en-SE', {
    timeZone: TIME_ZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

// Backward-compatible names for reports created before configurable timezones.
export const formatStockholm = formatLocalTime;

export function sameStockholmDate(a, b) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date(a)) === formatter.format(new Date(b));
}

export async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Number(options.timeoutMs) || REQUEST_TIMEOUT_MS,
  );
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
        'user-agent': 'CareerIntelligenceWorkflow/1.1 (+Career Ops email companion)',
        ...(options.headers || {}),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchJson(url, options = {}) {
  const response = await fetchWithTimeout(url, options);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json();
}

export async function fetchText(url, options = {}) {
  const response = await fetchWithTimeout(url, options);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  const text = await response.text();
  return {
    text: text.slice(0, Number(options.maxChars) || 1_500_000),
    status: response.status,
    finalUrl: response.url || url,
    contentType: response.headers.get('content-type') || '',
  };
}

export async function parallelMapLimit(values, limit, mapper) {
  const list = Array.from(values);
  const results = new Array(list.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= list.length) return;
      results[index] = await mapper(list[index], index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(Number(limit) || 1, list.length) }, worker),
  );
  return results;
}

export async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback;
    throw error;
  }
}

export async function atomicWriteJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.${Date.now()}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temp, filePath);
}

export async function writeText(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, value, 'utf8');
}

export async function loadLocalEnv(filePath) {
  try {
    const text = await readFile(filePath, 'utf8');
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const split = line.indexOf('=');
      if (split < 1) continue;
      const key = line.slice(0, split).trim();
      let value = line.slice(split + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (/^[A-Z_][A-Z0-9_]*$/.test(key) && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}
