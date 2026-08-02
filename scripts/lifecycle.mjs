#!/usr/bin/env node

import { appendFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { atomicWriteJson, readJson } from '../src/util.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CAREER_OPS_ROOT = path.resolve(process.env.CAREER_OPS_ROOT || path.join(ROOT, '..', '..'));
const STATE_PATH = path.join(ROOT, 'state', 'state.json');

async function optionalText(filePath) {
  try { return await readFile(filePath, 'utf8'); }
  catch (error) { if (error?.code === 'ENOENT') return ''; throw error; }
}

function trackerHasHired(text) {
  const rows = String(text || '').split(/\r?\n/)
    .filter((line) => line.includes('|'))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
  const header = rows.find((cells) => cells.some((cell) => /^status$/i.test(cell)));
  if (!header) return false;
  const statusIndex = header.findIndex((cell) => /^status$/i.test(cell));
  return rows.some((cells) => /^hired$/i.test(cells[statusIndex] || ''));
}

const command = process.argv[2] || 'check';
const state = await readJson(STATE_PATH, {
  version: 3, sentKeys: [], outbox: {}, sourceHealth: {}, runs: [], paused: null,
});
const now = new Date();
let changed = false;
let message = '';

if (command === 'pause') {
  const reason = process.argv.slice(3).join(' ').trim() || 'Paused by user.';
  state.paused = { at: now.toISOString(), reason, until: null };
  changed = true;
  message = reason;
} else if (command === 'snooze') {
  const until = new Date(process.argv[3]);
  if (Number.isNaN(until.getTime()) || until <= now) throw new Error('Snooze requires a future ISO date.');
  state.paused = { at: now.toISOString(), reason: 'Snoozed by user.', until: until.toISOString() };
  changed = true;
  message = `Snoozed until ${until.toISOString()}.`;
} else if (command === 'resume') {
  changed = Boolean(state.paused);
  state.paused = null;
  message = 'Digest resumed.';
} else if (command === 'check') {
  if (state.paused?.until && new Date(state.paused.until) <= now) {
    state.paused = null;
    changed = true;
    message = 'Snooze expired; digest resumed.';
  }
  const applications = await optionalText(path.join(CAREER_OPS_ROOT, 'data', 'applications.md'));
  if (!state.paused && trackerHasHired(applications)) {
    state.paused = {
      at: now.toISOString(),
      reason: 'Career Ops tracker contains a Hired outcome.',
      until: null,
    };
    changed = true;
    message = state.paused.reason;
  }
} else {
  throw new Error('Usage: node scripts/lifecycle.mjs check|pause [reason]|resume|snooze <ISO-date>');
}

if (changed) await atomicWriteJson(STATE_PATH, state);
if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `changed=${changed}\npaused=${Boolean(state.paused)}\n`, 'utf8');
}
process.stdout.write(`${message || (state.paused ? `Paused: ${state.paused.reason}` : 'Lifecycle unchanged.')}\n`);
