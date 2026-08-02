import {
  existsSync,
  readFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXAMPLE_CONFIG_PATH = path.join(ROOT, 'config', 'profile.example.yml');
const requestedConfigPath = process.env.CAREER_INTELLIGENCE_CONFIG
  ? path.resolve(process.cwd(), process.env.CAREER_INTELLIGENCE_CONFIG)
  : path.join(ROOT, 'config', 'profile.yml');

export const CONFIG_PATH = existsSync(requestedConfigPath)
  ? requestedConfigPath
  : EXAMPLE_CONFIG_PATH;
export const CONFIG_IS_EXAMPLE = CONFIG_PATH === EXAMPLE_CONFIG_PATH;

function readConfig() {
  let config;
  try {
    config = parse(readFileSync(CONFIG_PATH, 'utf8'));
  } catch (error) {
    throw new Error(`Could not read Career Intelligence config at ${CONFIG_PATH}: ${error.message}`);
  }
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error(`Career Intelligence config must be a YAML object: ${CONFIG_PATH}`);
  }
  if (Number(config.version) !== 2) {
    throw new Error(`Career Intelligence config version must be 2: ${CONFIG_PATH}`);
  }
  return config;
}

function numberInRange(value, fallback, minimum, maximum, label) {
  const number = Number(value ?? fallback);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum} in ${CONFIG_PATH}`);
  }
  return number;
}

function oneOf(value, fallback, allowed, label) {
  const normalized = String(value ?? fallback).trim().toLowerCase();
  if (!allowed.includes(normalized)) {
    throw new Error(`${label} must be one of ${allowed.join(', ')} in ${CONFIG_PATH}`);
  }
  return normalized;
}

const config = readConfig();
const digest = config.digest || {};
const schedule = config.schedule || {};
const budget = config.budget || {};
const health = config.health || {};
const scanner = config.scanner || {};
const intake = config.intake || {};
const searchProfile = config.search_profile || {};

function stringList(value, fallback, label, { allowEmpty = false } = {}) {
  const list = value === undefined ? fallback : value;
  if (!Array.isArray(list) || (!allowEmpty && list.length === 0)) {
    throw new Error(`${label} must be ${allowEmpty ? 'an' : 'a non-empty'} array in ${CONFIG_PATH}`);
  }
  const normalized = list.map((item) => String(item || '').trim()).filter(Boolean);
  if (!allowEmpty && normalized.length === 0) {
    throw new Error(`${label} must contain at least one value in ${CONFIG_PATH}`);
  }
  return normalized;
}

function objectList(value, label) {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
    throw new Error(`${label} must be a non-empty array of objects in ${CONFIG_PATH}`);
  }
  return value;
}

export const CONFIG_IS_CONFIGURED = config.configured === true;
const configuredDigestMode = oneOf(
  digest.mode,
  'discovery',
  ['discovery', 'smart'],
  'digest.mode',
);
export const DIGEST_MODE = oneOf(
  process.env.CAREER_INTELLIGENCE_EFFECTIVE_MODE,
  configuredDigestMode,
  ['discovery', 'smart'],
  'CAREER_INTELLIGENCE_EFFECTIVE_MODE',
);
export const AGENT_PROVIDER = oneOf(
  digest.provider,
  'codex',
  ['codex', 'claude'],
  'digest.provider',
);
export const INCLUDE_UNSCORED = true;
export const LOOKBACK_HOURS = numberInRange(
  digest.lookback_hours,
  12,
  1,
  168,
  'digest.lookback_hours',
);
export const TIME_ZONE = String(schedule.timezone || 'UTC').trim() || 'UTC';
export const WEEKDAYS_ONLY = schedule.weekdays_only === true;
export const DELIVERY_TIMES = stringList(
  schedule.delivery_times,
  ['07:23', '07:43', '08:03', '19:23', '19:43', '20:03'],
  'schedule.delivery_times',
).map((value) => {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new Error(`schedule.delivery_times contains an invalid local time: ${value}`);
  }
  return value;
});
export const MINIMUM_GAP_HOURS = numberInRange(
  schedule.minimum_gap_hours,
  6,
  0,
  72,
  'schedule.minimum_gap_hours',
);
export const MAX_AGENT_TURNS = numberInRange(
  budget.max_agent_turns,
  12,
  1,
  100,
  'budget.max_agent_turns',
);
export const MAX_AGENT_MINUTES = numberInRange(
  budget.max_agent_minutes,
  20,
  1,
  120,
  'budget.max_agent_minutes',
);
export const MAX_FULL_EVALUATIONS = numberInRange(
  budget.max_full_evaluations,
  30,
  1,
  500,
  'budget.max_full_evaluations',
);
export const FAILURE_WARNING_AFTER = numberInRange(
  health.failure_warning_after,
  2,
  1,
  20,
  'health.failure_warning_after',
);

export const INBOUND_ALERTS_ENABLED = intake.enabled === true;
export const INBOUND_MAX_EMAILS = numberInRange(
  intake.max_emails_per_run,
  100,
  1,
  100,
  'intake.max_emails_per_run',
);
export const INBOUND_MAX_BODY_BYTES = numberInRange(
  intake.max_body_bytes,
  1_500_000,
  10_000,
  5_000_000,
  'intake.max_body_bytes',
);
export const INBOUND_RETENTION_DAYS = numberInRange(
  intake.retention_days,
  30,
  1,
  365,
  'intake.retention_days',
);

export const REQUEST_TIMEOUT_MS = numberInRange(
  scanner.request_timeout_ms,
  12_000,
  1_000,
  60_000,
  'scanner.request_timeout_ms',
);
export const DEFAULT_ATS_BOARDS_PER_SOURCE = numberInRange(
  scanner.ats_boards_per_source,
  120,
  25,
  2_000,
  'scanner.ats_boards_per_source',
);
export const DEFAULT_MAX_SCAN_MINUTES = numberInRange(
  scanner.max_scan_minutes,
  4,
  2,
  60,
  'scanner.max_scan_minutes',
);
export const DEFAULT_MAX_PAGE_VERIFICATIONS = numberInRange(
  scanner.max_page_verifications,
  20,
  1,
  500,
  'scanner.max_page_verifications',
);
export const ENABLED_DIRECT_SOURCES = stringList(
  scanner.direct_sources,
  ['platsbanken-jobstream', 'arbeitnow', 'thehub', 'wttj', 'jobicy', 'himalayas', 'remotive', 'remoteok'],
  'scanner.direct_sources',
  { allowEmpty: true },
);
export const ENABLED_ATS_SOURCES = stringList(
  scanner.ats_sources,
  ['greenhouse', 'lever', 'ashby', 'workday'],
  'scanner.ats_sources',
  { allowEmpty: true },
);
if (ENABLED_DIRECT_SOURCES.length + ENABLED_ATS_SOURCES.length === 0) {
  throw new Error(`At least one scanner source must be enabled in ${CONFIG_PATH}`);
}

export const ROLE_FAMILIES = objectList(searchProfile.role_families, 'search_profile.role_families').map((family, index) => ({
  id: String(family.id || `family-${index + 1}`).trim(),
  label: String(family.label || family.id || `Role family ${index + 1}`).trim(),
  priority: numberInRange(family.priority, 3, 0.5, 10, `search_profile.role_families[${index}].priority`),
  terms: stringList(family.title_terms || family.terms, [], `search_profile.role_families[${index}].title_terms`),
  responsibilityTerms: stringList(family.responsibility_terms, [], `search_profile.role_families[${index}].responsibility_terms`),
}));
export const TITLE_EXCLUDES = stringList(searchProfile.title_excludes, [], 'search_profile.title_excludes', { allowEmpty: true });
export const IC_TITLE_SIGNALS = stringList(searchProfile.ic_title_signals, ['specialist', 'coordinator', 'analyst'], 'search_profile.ic_title_signals');
export const TITLE_CONTEXT_TERMS = stringList(searchProfile.title_context_terms, [], 'search_profile.title_context_terms', { allowEmpty: true });
export const LOCATION_GROUPS = objectList(searchProfile.location_groups, 'search_profile.location_groups').map((group, index) => ({
  id: String(group.id || `location-${index + 1}`).trim(),
  label: String(group.label || group.id || `Location ${index + 1}`).trim(),
  score: numberInRange(group.score, 10, 0, 100, `search_profile.location_groups[${index}].score`),
  terms: stringList(group.terms, [], `search_profile.location_groups[${index}].terms`),
}));
export const OBVIOUS_NON_EU_ONLY = stringList(searchProfile.location_excludes, [], 'search_profile.location_excludes', { allowEmpty: true });
export const UNSUPPORTED_LOCAL_LANGUAGES = stringList(searchProfile.unsupported_languages, [], 'search_profile.unsupported_languages', { allowEmpty: true });
export const HOME_LOCATION_IDS = stringList(searchProfile.home_location_ids, [LOCATION_GROUPS[0].id], 'search_profile.home_location_ids');
export const MANAGER_TITLE_PENALTY = numberInRange(searchProfile.manager_title_penalty, 14, 0, 100, 'search_profile.manager_title_penalty');
export const PEOPLE_MANAGEMENT_PENALTY = numberInRange(searchProfile.people_management_penalty, 24, 0, 100, 'search_profile.people_management_penalty');
export const IC_TITLE_BONUS = numberInRange(searchProfile.ic_title_bonus, 10, 0, 100, 'search_profile.ic_title_bonus');
export const PRIORITY_SCORE = numberInRange(searchProfile.priority_score, 88, 1, 200, 'search_profile.priority_score');
export const WORTH_LOOK_SCORE = numberInRange(searchProfile.worth_look_score, 64, 1, 200, 'search_profile.worth_look_score');
if (WORTH_LOOK_SCORE > PRIORITY_SCORE) {
  throw new Error(`search_profile.worth_look_score cannot exceed priority_score in ${CONFIG_PATH}`);
}
export const WTTJ_QUERIES = stringList(
  scanner.search_queries,
  ROLE_FAMILIES.flatMap((family) => family.terms.slice(0, 3)).slice(0, 20),
  'scanner.search_queries',
);

export const ATS_DIRECTORIES = {
  greenhouse: 'https://raw.githubusercontent.com/Feashliaa/job-board-aggregator/main/data/greenhouse_companies.json',
  lever: 'https://raw.githubusercontent.com/Feashliaa/job-board-aggregator/main/data/lever_companies.json',
  ashby: 'https://raw.githubusercontent.com/Feashliaa/job-board-aggregator/main/data/ashby_companies.json',
  workday: 'https://raw.githubusercontent.com/Feashliaa/job-board-aggregator/main/data/workday_companies.json',
};

export const SUPPORTED_CAREER_OPS = {
  minimum: '1.22.0',
  maximumExclusive: '1.25.0',
  scanHistoryColumns: [
    'url',
    'first_seen',
    'portal',
    'title',
    'company',
    'status',
    'location',
    'jd_fingerprint',
    'postedAt',
  ],
};
