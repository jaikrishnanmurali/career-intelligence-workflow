#!/usr/bin/env node

import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AGENT_PROVIDER,
  CONFIG_IS_CONFIGURED,
  CONFIG_IS_EXAMPLE,
  CONFIG_PATH,
  DIGEST_MODE,
  LOOKBACK_HOURS,
  MAX_AGENT_MINUTES,
  MAX_AGENT_TURNS,
  MAX_FULL_EVALUATIONS,
  TIME_ZONE,
  DELIVERY_TIMES,
  INBOUND_ALERTS_ENABLED,
} from '../src/config.mjs';
import { parseScanHistory, validateCareerOpsRoot } from '../src/career-ops.mjs';
import { loadLocalEnv } from '../src/util.mjs';
import { parse } from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const failures = [];
const warnings = [];

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}
async function exists(filePath) {
  try { await access(filePath); return true; } catch { return false; }
}
function check(condition, message) { if (!condition) failures.push(message); }

check(Number(process.versions.node.split('.')[0]) >= 22, `Node.js 22 or newer is required; found ${process.versions.node}.`);
try { new Intl.DateTimeFormat('en', { timeZone: TIME_ZONE }).format(new Date()); }
catch { failures.push(`schedule.timezone is invalid: ${TIME_ZONE}.`); }
if (CONFIG_IS_EXAMPLE || !CONFIG_IS_CONFIGURED) {
  const message = 'The deployment config is not confirmed. Run setup from the Career Ops root before enabling GitHub Actions.';
  if (args.has('--deploy')) failures.push(message); else warnings.push(message);
}

const careerOpsRoot = path.resolve(
  argumentValue('--career-ops-root') || process.env.CAREER_OPS_ROOT || path.join(ROOT, '..', '..'),
);
let careerOpsVersion = 'not detected';
try {
  const workspace = await validateCareerOpsRoot(careerOpsRoot, {
    requirePrivateInputs: DIGEST_MODE === 'smart',
  });
  careerOpsVersion = workspace.version;
  const historyPath = path.join(careerOpsRoot, 'data', 'scan-history.tsv');
  if (await exists(historyPath)) parseScanHistory(await readFile(historyPath, 'utf8'));
} catch (error) {
  if (args.has('--deploy')) failures.push(error.message); else warnings.push(error.message);
}

await loadLocalEnv(path.join(ROOT, '.env'));
if (args.has('--email')) {
  check(Boolean(process.env.RESEND_API_KEY), 'RESEND_API_KEY is missing.');
  check(Boolean(process.env.CAREER_DIGEST_FROM), 'CAREER_DIGEST_FROM is missing.');
  check(Boolean(process.env.CAREER_DIGEST_TO), 'CAREER_DIGEST_TO is missing.');
  if (String(process.env.CAREER_DIGEST_FROM || '').includes('@resend.dev')) {
    warnings.push('The resend.dev test sender can deliver only to the email address registered with that Resend account.');
  }
  if (INBOUND_ALERTS_ENABLED) {
    check(Boolean(process.env.RESEND_RECEIVING_API_KEY), 'RESEND_RECEIVING_API_KEY is missing for enabled alert intake.');
    check(Boolean(process.env.RESEND_RECEIVING_ADDRESS), 'RESEND_RECEIVING_ADDRESS is missing for enabled alert intake.');
  }
}
const sourcesPath = path.join(ROOT, 'config', 'sources.yml');
try {
  const sources = parse(await readFile(sourcesPath, 'utf8'));
  const selected = (sources?.platforms || []).filter((platform) => platform?.selected === true);
  if (sources?.configured !== true) {
    const message = 'The platform source plan is not confirmed. Review alert and search lanes in config/sources.yml.';
    if (args.has('--deploy')) failures.push(message); else warnings.push(message);
  }
  for (const platform of selected) {
    if (platform?.alert?.enabled !== true && platform?.search?.enabled !== true) {
      failures.push(`${platform.label || platform.id} is selected but has neither alert nor search discovery enabled.`);
    }
    if (platform?.alert?.enabled === true && platform?.alert?.tested !== true) {
      failures.push(`${platform.label || platform.id} alert intake is enabled but its forwarded test email is not confirmed.`);
    }
  }
} catch (error) {
  const message = `Platform source plan is unavailable: ${error.message}`;
  if (args.has('--deploy')) failures.push(message); else warnings.push(message);
}
if (DIGEST_MODE === 'smart') {
  warnings.push(
    `Smart Digest sends CV, profile and job-description context to ${AGENT_PROVIDER === 'codex' ? 'OpenAI' : 'Anthropic'} in GitHub Actions and uses model tokens.`,
  );
} else {
  warnings.push('Discovery Digest searches configured public feeds and rolling ATS boards, but LinkedIn-only, broad-search-only and dynamic-page jobs may be missed.');
}

process.stdout.write([
  'Career Intelligence doctor',
  `Node: ${process.versions.node}`,
  `Career Ops root: ${careerOpsRoot}`,
  `Career Ops version: ${careerOpsVersion}`,
  `Deployment config: ${path.relative(ROOT, CONFIG_PATH)}`,
  `Config confirmed: ${CONFIG_IS_CONFIGURED ? 'yes' : 'no'}`,
  `Digest mode: ${DIGEST_MODE}`,
  `Cloud runner: ${DIGEST_MODE === 'smart' ? AGENT_PROVIDER : 'none'}`,
  `Lookback guidance: ${LOOKBACK_HOURS} hours (unknown timestamps are retained when newly discovered)`,
  `Timezone: ${TIME_ZONE}`,
  `Local delivery attempts: ${DELIVERY_TIMES.join(', ')}`,
  `Eight-platform alert intake: ${INBOUND_ALERTS_ENABLED ? 'enabled' : 'disabled'}`,
  `Smart limits: ${MAX_AGENT_TURNS} turns, ${MAX_AGENT_MINUTES} minutes per agent step, ${MAX_FULL_EVALUATIONS} full-JD evaluations`,
  `Discovery model usage: ${DIGEST_MODE === 'discovery' ? '0 tokens' : '0 tokens for the structured core; model tokens for gaps and evaluation'}`,
].join('\n') + '\n');
for (const warning of warnings) process.stdout.write(`WARNING: ${warning}\n`);
for (const failure of failures) process.stderr.write(`ERROR: ${failure}\n`);
if (failures.length) process.exitCode = 1;
else process.stdout.write('OK: configuration passed the requested checks.\n');
