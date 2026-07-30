#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EXPERIENCE_PROFILE,
  LOCATION_GROUPS,
  LOOKBACK_HOURS,
  PROFILE_IS_EXAMPLE,
  PROFILE_PATH,
  ROLE_FAMILIES,
  UNSUPPORTED_LOCAL_LANGUAGES,
} from '../src/config.mjs';
import { loadLocalEnv } from '../src/util.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const requireDeploymentProfile = args.has('--deploy');
const requireEmail = args.has('--email');
const failures = [];
const warnings = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

const nodeMajor = Number(process.versions.node.split('.')[0]);
check(nodeMajor >= 22, `Node.js 22 or newer is required; found ${process.versions.node}.`);
check(LOOKBACK_HOURS > 0 && LOOKBACK_HOURS <= 168, 'lookback_hours must be between 1 and 168.');
check(ROLE_FAMILIES.length > 0, 'At least one role family is required.');
check(LOCATION_GROUPS.length > 0, 'At least one location group is required.');
check(EXPERIENCE_PROFILE.totalYears >= EXPERIENCE_PROFILE.coreYears, 'Total experience cannot be lower than core experience.');

if (PROFILE_IS_EXAMPLE) {
  const message = 'The scanner is using config/profile.example.yml. Run npm run init and edit config/profile.yml.';
  if (requireDeploymentProfile) failures.push(message);
  else warnings.push(message);
}

await loadLocalEnv(path.join(ROOT, '.env'));
if (requireEmail) {
  check(Boolean(process.env.RESEND_API_KEY), 'RESEND_API_KEY is missing.');
  check(Boolean(process.env.CAREER_DIGEST_FROM), 'CAREER_DIGEST_FROM is missing.');
  check(Boolean(process.env.CAREER_DIGEST_TO), 'CAREER_DIGEST_TO is missing.');
  check(
    !String(process.env.CAREER_DIGEST_FROM || '').includes('.example'),
    'CAREER_DIGEST_FROM still uses the example domain.',
  );
}

process.stdout.write([
  'Career Intelligence doctor',
  `Node: ${process.versions.node}`,
  `Profile: ${path.relative(ROOT, PROFILE_PATH)}`,
  `Role families: ${ROLE_FAMILIES.length}`,
  `Location groups: ${LOCATION_GROUPS.length}`,
  `Hard-language gates: ${UNSUPPORTED_LOCAL_LANGUAGES.length}`,
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