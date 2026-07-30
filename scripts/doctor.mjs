#!/usr/bin/env node

import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EXPERIENCE_PROFILE,
  LOCATION_GROUPS,
  LOOKBACK_HOURS,
  PROFILE_IS_CONFIGURED,
  PROFILE_IS_EXAMPLE,
  PROFILE_PATH,
  ROLE_FAMILIES,
  UNSUPPORTED_LOCAL_LANGUAGES,
  TIME_ZONE,
} from '../src/config.mjs';
import { loadLocalEnv } from '../src/util.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const requireDeploymentProfile = args.has('--deploy');
const requireEmail = args.has('--email');
const failures = [];
const warnings = [];

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function check(condition, message) {
  if (!condition) failures.push(message);
}

const nodeMajor = Number(process.versions.node.split('.')[0]);
check(nodeMajor >= 22, `Node.js 22 or newer is required; found ${process.versions.node}.`);
try {
  new Intl.DateTimeFormat('en', { timeZone: TIME_ZONE }).format(new Date());
} catch {
  failures.push(`runtime.timezone must be a valid IANA timezone; found ${TIME_ZONE}.`);
}
check(LOOKBACK_HOURS > 0 && LOOKBACK_HOURS <= 168, 'lookback_hours must be between 1 and 168.');
check(ROLE_FAMILIES.length > 0, 'At least one role family is required.');
check(LOCATION_GROUPS.length > 0, 'At least one location group is required.');
check(EXPERIENCE_PROFILE.totalYears >= EXPERIENCE_PROFILE.coreYears, 'Total experience cannot be lower than core experience.');

if (PROFILE_IS_EXAMPLE || !PROFILE_IS_CONFIGURED) {
  const message = 'The discovery profile has not been confirmed. Open Codex or Claude from the Career Ops root and ask to set up the 12-hour job digest.';
  if (requireDeploymentProfile) failures.push(message);
  else warnings.push(message);
}

const careerOpsRoot = path.resolve(
  argumentValue('--career-ops-root')
    || process.env.CAREER_OPS_ROOT
    || path.join(ROOT, '..', '..'),
);
let careerOpsVersion = 'not detected';
if (
  await exists(path.join(careerOpsRoot, 'AGENTS.md'))
  && await exists(path.join(careerOpsRoot, 'config', 'profile.yml'))
  && await exists(path.join(careerOpsRoot, 'cv.md'))
) {
  try {
    const careerOpsPackage = JSON.parse(
      await readFile(path.join(careerOpsRoot, 'package.json'), 'utf8'),
    );
    if (careerOpsPackage.name === 'career-ops') {
      careerOpsVersion = careerOpsPackage.version || 'unknown';
    } else {
      warnings.push(`The detected parent package is ${careerOpsPackage.name || 'unnamed'}, not career-ops.`);
    }
  } catch (error) {
    warnings.push(`Could not read the Career Ops package metadata: ${error.message}`);
  }
} else {
  const message = `Career Ops was not detected at ${careerOpsRoot}. The extension requires an onboarded Career Ops workspace.`;
  if (requireDeploymentProfile) failures.push(message);
  else warnings.push(message);
}

await loadLocalEnv(path.join(ROOT, '.env'));
if (requireEmail) {
  check(Boolean(process.env.RESEND_API_KEY), 'RESEND_API_KEY is missing.');
  check(Boolean(process.env.CAREER_DIGEST_FROM), 'CAREER_DIGEST_FROM is missing.');
  check(Boolean(process.env.CAREER_DIGEST_TO), 'CAREER_DIGEST_TO is missing.');
  check(
    !String(process.env.CAREER_DIGEST_TO || '').endsWith('@example.com'),
    'CAREER_DIGEST_TO still uses the example address.',
  );
  check(
    !String(process.env.CAREER_DIGEST_FROM || '').includes('.example'),
    'CAREER_DIGEST_FROM still uses the example domain.',
  );
  if (String(process.env.CAREER_DIGEST_FROM || '').includes('@resend.dev')) {
    warnings.push(
      'The resend.dev test sender can deliver only to the email associated with this Resend account.',
    );
  }
}

process.stdout.write([
  'Career Intelligence doctor',
  `Node: ${process.versions.node}`,
  `Career Ops root: ${careerOpsRoot}`,
  `Career Ops version: ${careerOpsVersion}`,
  `Profile: ${path.relative(ROOT, PROFILE_PATH)}`,
  `Profile confirmed: ${PROFILE_IS_CONFIGURED ? 'yes' : 'no'}`,
  `Role families: ${ROLE_FAMILIES.length}`,
  `Location groups: ${LOCATION_GROUPS.length}`,
  `Hard-language gates: ${UNSUPPORTED_LOCAL_LANGUAGES.length}`,
  `Display timezone: ${TIME_ZONE}`,
  `Freshness window: ${LOOKBACK_HOURS} hours`,
  `Experience framing: ${EXPERIENCE_PROFILE.coreYears} core / ${EXPERIENCE_PROFILE.totalYears} total years`,
  'Scheduled decision path: deterministic, 0 model tokens',
].join('\n') + '\n');

for (const warning of warnings) process.stdout.write(`WARNING: ${warning}\n`);
for (const failure of failures) process.stderr.write(`ERROR: ${failure}\n`);

if (failures.length) {
  process.exitCode = 1;
} else {
  process.stdout.write('OK: configuration passed the requested checks.\n');
}