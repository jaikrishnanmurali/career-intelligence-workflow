import {
  existsSync,
  readFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXAMPLE_PROFILE_PATH = path.join(ROOT, 'config', 'profile.example.yml');
const requestedProfilePath = process.env.CAREER_PROFILE_PATH
  ? path.resolve(process.cwd(), process.env.CAREER_PROFILE_PATH)
  : path.join(ROOT, 'config', 'profile.yml');

export const PROFILE_PATH = existsSync(requestedProfilePath)
  ? requestedProfilePath
  : EXAMPLE_PROFILE_PATH;
export const PROFILE_IS_EXAMPLE = PROFILE_PATH === EXAMPLE_PROFILE_PATH;

function readProfile() {
  let profile;
  try {
    profile = parse(readFileSync(PROFILE_PATH, 'utf8'));
  } catch (error) {
    throw new Error(`Could not read career profile at ${PROFILE_PATH}: ${error.message}`);
  }
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    throw new Error(`Career profile must be a YAML object: ${PROFILE_PATH}`);
  }
  if (Number(profile.version) !== 1) {
    throw new Error(`Career profile version must be 1: ${PROFILE_PATH}`);
  }
  return profile;
}

function asNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function asString(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function asList(value, label, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    throw new Error(`${label} must be ${allowEmpty ? 'a' : 'a non-empty'} YAML list in ${PROFILE_PATH}`);
  }
  return value.map((item) => asString(item)).filter(Boolean);
}

const profile = readProfile();
export const PROFILE_IS_CONFIGURED = profile.configured === true;
const search = profile.search || {};
const runtime = profile.runtime || {};
const location = search.location || {};
const languages = search.languages || {};
const experience = search.experience || {};
const manager = search.manager || {};
const discovery = profile.discovery || {};

export const LOOKBACK_HOURS = asNumber(search.lookback_hours, 12);
export const REQUEST_TIMEOUT_MS = asNumber(runtime.request_timeout_ms, 12_000);
export const DEFAULT_ATS_BOARDS_PER_SOURCE = asNumber(runtime.ats_boards_per_source, 400);
export const DEFAULT_MAX_SCAN_MINUTES = asNumber(runtime.max_scan_minutes, 18);
export const DEFAULT_MAX_PAGE_VERIFICATIONS = asNumber(runtime.max_page_verifications, 60);
export const TIME_ZONE = asString(runtime.timezone, 'UTC');

export const ROLE_FAMILIES = (search.role_families || []).map((family, index) => {
  const prefix = `search.role_families[${index}]`;
  return {
    id: asString(family?.id),
    label: asString(family?.label),
    priority: asNumber(family?.priority, 3),
    terms: asList(family?.terms, `${prefix}.terms`),
    responsibilityTerms: asList(
      family?.responsibility_terms,
      `${prefix}.responsibility_terms`,
      { allowEmpty: true },
    ),
  };
});
if (!ROLE_FAMILIES.length || ROLE_FAMILIES.some((family) => !family.id || !family.label)) {
  throw new Error(`Every role family needs an id and label in ${PROFILE_PATH}`);
}

export const TITLE_EXCLUDES = asList(
  search.title_excludes,
  'search.title_excludes',
  { allowEmpty: true },
);
export const IC_TITLE_SIGNALS = asList(
  search.individual_contributor_title_signals,
  'search.individual_contributor_title_signals',
  { allowEmpty: true },
);

export const MANAGER_PREFERENCE = {
  preferIndividualContributor: manager.prefer_individual_contributor !== false,
  titlePenalty: asNumber(manager.title_penalty, 14),
  peopleManagementPenalty: asNumber(manager.people_management_penalty, 24),
  lowFitManagerFloor: asNumber(manager.low_fit_manager_floor, 64),
};

const coreYears = Math.max(0, asNumber(experience.core_years, 0));
const totalYears = Math.max(
  coreYears,
  asNumber(experience.total_years_including_adjacent, coreYears),
);
export const EXPERIENCE_PROFILE = {
  coreYears,
  totalYears,
  behavior: ['ignore', 'caution'].includes(experience.behavior)
    ? experience.behavior
    : 'caution',
};

export const HOME_LOCATION_GROUP_ID = asString(location.home_group_id);
export const LOCATION_GROUPS = (location.groups || []).map((group, index) => {
  const prefix = `search.location.groups[${index}]`;
  return {
    id: asString(group?.id),
    label: asString(group?.label),
    score: asNumber(group?.score, 0),
    terms: asList(group?.terms, `${prefix}.terms`),
  };
});
if (!LOCATION_GROUPS.length || LOCATION_GROUPS.some((group) => !group.id || !group.label)) {
  throw new Error(`Every location group needs an id and label in ${PROFILE_PATH}`);
}

export const OBVIOUS_NON_EU_ONLY = asList(
  location.obvious_out_of_scope_phrases,
  'search.location.obvious_out_of_scope_phrases',
  { allowEmpty: true },
);
export const NON_TARGET_COUNTRY_TERMS = asList(
  location.non_target_country_terms,
  'search.location.non_target_country_terms',
  { allowEmpty: true },
);
export const GLOBAL_SCOPE_SIGNALS = asList(
  location.global_scope_signals,
  'search.location.global_scope_signals',
  { allowEmpty: true },
);

export const UNSUPPORTED_LOCAL_LANGUAGES = asList(
  languages.exclude_when_hard_required,
  'search.languages.exclude_when_hard_required',
  { allowEmpty: true },
).map((language) => language.toLowerCase());

export const WTTJ_QUERIES = asList(
  discovery.welcome_to_the_jungle_queries,
  'discovery.welcome_to_the_jungle_queries',
);

export const ATS_DIRECTORIES = {
  greenhouse: 'https://raw.githubusercontent.com/Feashliaa/job-board-aggregator/main/data/greenhouse_companies.json',
  lever: 'https://raw.githubusercontent.com/Feashliaa/job-board-aggregator/main/data/lever_companies.json',
  ashby: 'https://raw.githubusercontent.com/Feashliaa/job-board-aggregator/main/data/ashby_companies.json',
  workday: 'https://raw.githubusercontent.com/Feashliaa/job-board-aggregator/main/data/workday_companies.json',
};