#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';

import {
  INBOUND_ALERTS_ENABLED,
  INBOUND_MAX_BODY_BYTES,
  INBOUND_MAX_EMAILS,
  INBOUND_RETENTION_DAYS,
} from '../src/config.mjs';
import { hashInboundIdentity, parseAlertEmail, resolvePublicLead } from '../src/intake.mjs';
import { atomicWriteJson, loadLocalEnv, readJson } from '../src/util.mjs';
import { readFile } from 'node:fs/promises';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE_ROOT = path.join(ROOT, 'state');

async function resend(pathname, apiKey) {
  const response = await fetch(`https://api.resend.com${pathname}`, {
    headers: {
      authorization: `Bearer ${apiKey}`,
      accept: 'application/json',
      'user-agent': 'CareerIntelligenceWorkflow/1.3',
    },
  });
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; }
  if (!response.ok) throw new Error(`Resend Receiving request failed (${response.status}): ${body.message || 'unknown error'}`);
  return body;
}

function withinRetention(value, now) {
  const time = Date.parse(value);
  return Number.isFinite(time) && time >= now.getTime() - INBOUND_RETENTION_DAYS * 86_400_000;
}

await loadLocalEnv(path.join(ROOT, '.env'));
if (!INBOUND_ALERTS_ENABLED && !process.argv.includes('--force')) {
  process.stdout.write('Inbound platform alerts are disabled; no receiving request was made.\n');
  process.exit(0);
}
const apiKey = process.env.RESEND_RECEIVING_API_KEY;
if (!apiKey) throw new Error('RESEND_RECEIVING_API_KEY is required when inbound platform alerts are enabled.');
const selectedAddress = String(process.env.RESEND_RECEIVING_ADDRESS || '').trim().toLowerCase();
if (!selectedAddress) throw new Error('RESEND_RECEIVING_ADDRESS is required so intake never reads an unintended receiving address.');
const now = new Date();
const statePath = path.join(STATE_ROOT, 'inbound-state.json');
const candidatesPath = path.join(STATE_ROOT, 'intake-candidates.json');
const state = await readJson(statePath, {
  schemaVersion: 1,
  processed: {},
  failures: {},
  platformHealth: {},
});
state.failures = state.failures && typeof state.failures === 'object' ? state.failures : {};
const existing = await readJson(candidatesPath, { schemaVersion: 1, candidates: [] });
const byKey = new Map((existing.candidates || []).map((candidate) => [candidate.candidateKey, candidate]));
const list = await resend(`/emails/receiving?limit=${INBOUND_MAX_EMAILS}`, apiKey);
const messages = Array.isArray(list?.data) ? list.data : [];
const newMessages = messages.filter((message) => {
  const recipients = Array.isArray(message.to) ? message.to : [message.to];
  if (!recipients.filter(Boolean).map(String).map((value) => value.toLowerCase()).includes(selectedAddress)) return false;
  return !state.processed[hashInboundIdentity(message.id)];
});
const counts = {};
let parseFailures = 0;
let leadsFound = 0;
for (const message of newMessages) {
  const idHash = hashInboundIdentity(message.id);
  try {
    const detail = await resend(`/emails/receiving/${encodeURIComponent(message.id)}`, apiKey);
    const html = String(detail.html || '').slice(0, INBOUND_MAX_BODY_BYTES);
    const text = String(detail.text || '').slice(0, INBOUND_MAX_BODY_BYTES);
    const messageHash = hashInboundIdentity(`${detail.message_id || ''}\n${html}\n${text}`);
    const parsed = parseAlertEmail({ html, text, subject: detail.subject, from: detail.from });
    for (const lead of parsed) {
      const resolved = await resolvePublicLead(lead);
      const prior = byKey.get(resolved.candidateKey);
      const candidate = {
        ...prior,
        ...resolved,
        sourceEmailIdHash: idHash,
        sourceMessageHash: messageHash,
        discoveredAt: prior?.discoveredAt || detail.created_at || now.toISOString(),
        lastSeenAt: now.toISOString(),
        provenance: [...new Set([...(prior?.provenance || []), `email_alert:${resolved.platform}`])],
      };
      byKey.set(candidate.candidateKey, candidate);
      counts[lead.platform] = (counts[lead.platform] || 0) + 1;
      leadsFound += 1;
    }
    state.processed[idHash] = { at: now.toISOString(), messageHash, leads: parsed.length };
    delete state.failures[idHash];
  } catch (error) {
    parseFailures += 1;
    state.failures[idHash] = {
      at: now.toISOString(),
      attempts: Number(state.failures[idHash]?.attempts || 0) + 1,
      error: String(error.message || error).slice(0, 300),
    };
  }
}
state.processed = Object.fromEntries(
  Object.entries(state.processed).filter(([, value]) => withinRetention(value.at, now)),
);
state.failures = Object.fromEntries(
  Object.entries(state.failures).filter(([, value]) => withinRetention(value.at, now)),
);
const sourcesPath = path.join(ROOT, 'config', 'sources.yml');
let sourcePlan = { platforms: [] };
try { sourcePlan = parse(await readFile(sourcesPath, 'utf8')); } catch { /* doctor reports missing source plan */ }
const platformReceipts = (sourcePlan.platforms || []).map((platform) => {
  if (!platform.selected) return { platform: platform.id, status: 'disabled_by_user', reason: 'Not selected by the configured source packs.' };
  if (!platform.alert?.enabled || !platform.alert?.tested) {
    return { platform: platform.id, status: 'not_configured', reason: 'Native alert forwarding has not been enabled and tested.' };
  }
  return {
    platform: platform.id,
    status: parseFailures ? 'partial' : 'completed',
    reason: `${counts[platform.id] || 0} new lead${counts[platform.id] === 1 ? '' : 's'} parsed in this poll; ${parseFailures} message failure${parseFailures === 1 ? '' : 's'} across the inbox.`,
  };
});
await atomicWriteJson(statePath, { ...state, schemaVersion: 1, lastSuccessfulPollAt: now.toISOString() });
await atomicWriteJson(candidatesPath, {
  schemaVersion: 1,
  generatedAt: now.toISOString(),
  candidates: [...byKey.values()].slice(-2000),
});
await atomicWriteJson(path.join(STATE_ROOT, 'intake-coverage.json'), {
  schemaVersion: 1,
  generatedAt: now.toISOString(),
  platforms: platformReceipts,
});
await atomicWriteJson(path.join(ROOT, 'reports', 'intake-latest.json'), {
  schemaVersion: 1,
  generatedAt: now.toISOString(),
  messagesListed: messages.length,
  messagesProcessed: newMessages.length,
  leadsFound,
  parseFailures,
  platforms: platformReceipts,
});
process.stdout.write(`Alert intake completed: ${newMessages.length} new emails, ${leadsFound} leads, ${parseFailures} failures. Raw email bodies were not saved.\n`);
