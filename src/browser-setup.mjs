import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { parse, stringify } from 'yaml';

import { buildDeploymentDraft } from '../scripts/import-career-ops-profile.mjs';

export const BROWSER_SETUP_SCHEMA_VERSION = 1;
export const SUPPORTED_CAREER_OPS_TAG = 'career-ops-v1.23.0';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const RESEND_KEY_PATTERN = /\bre_[A-Za-z0-9_-]{20,}\b/;
const SUPPORTED_PLATFORM_IDS = new Set([
  'linkedin', 'indeed', 'glassdoor', 'jobbsafari',
  'iamexpat', 'karriere-at', 'climatebase', 'wellfound',
]);
const GENERIC_SECRET_PATTERNS = [
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
  /\bsk-ant-[A-Za-z0-9_-]{20,}\b/,
  RESEND_KEY_PATTERN,
];

function text(value, maximum = 300) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maximum);
}

function textLines(value, { maximumItems = 20, maximumLength = 120 } = {}) {
  const input = Array.isArray(value) ? value : String(value ?? '').split(/[\n,]/);
  return [...new Set(input
    .map((item) => text(item, maximumLength))
    .filter(Boolean))].slice(0, maximumItems);
}

function slug(value, fallback = 'item') {
  return text(value, 100)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || fallback;
}

function requireText(value, label, { minimum = 1, maximum = 300 } = {}) {
  const normalized = text(value, maximum);
  if (normalized.length < minimum) throw new Error(`${label} is required.`);
  return normalized;
}

function requireEmail(value, label) {
  const normalized = text(value, 254).toLowerCase();
  if (!EMAIL_PATTERN.test(normalized)) throw new Error(`${label} must be a valid email address.`);
  return normalized;
}

function timeWithOffset(value, minutes) {
  if (!TIME_PATTERN.test(value)) throw new Error(`Invalid local delivery time: ${value}`);
  const [hours, minute] = value.split(':').map(Number);
  const total = (hours * 60 + minute + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function deliveryAttempts(morning, evening) {
  const baseTimes = [morning, evening].map((value) => text(value, 5));
  if (baseTimes.some((value) => !TIME_PATTERN.test(value))) {
    throw new Error('Choose valid morning and evening delivery times.');
  }
  return baseTimes.flatMap((value) => [0, 20, 40].map((offset) => timeWithOffset(value, offset)));
}

export function validateBrowserSetupInput(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Setup details must be an object.');
  }
  const fullName = requireText(raw.fullName, 'Your name', { minimum: 2, maximum: 120 });
  const email = requireEmail(raw.email, 'Your email');
  const cvText = String(raw.cvText ?? '').replace(/\r\n/g, '\n').trim();
  if (cvText.length < 120) throw new Error('Add your CV text before preparing the workspace.');
  if (cvText.length > 600_000) throw new Error('The CV text is too large. Keep it below 600,000 characters.');

  const city = requireText(raw.city, 'Your city', { maximum: 100 });
  const country = requireText(raw.country, 'Your country', { maximum: 100 });
  const timezone = text(raw.timezone, 100);
  if (!timezone.includes('/')) throw new Error('Choose an IANA timezone such as Europe/Stockholm.');

  const roles = (Array.isArray(raw.roles) ? raw.roles : []).slice(0, 8).map((item, index) => {
    const label = requireText(item?.label, `Role family ${index + 1}`, { maximum: 100 });
    const titleTerms = textLines(item?.titleTerms, { maximumItems: 16, maximumLength: 100 });
    const responsibilityTerms = textLines(item?.responsibilityTerms, { maximumItems: 16, maximumLength: 120 });
    if (!titleTerms.length) throw new Error(`${label} needs at least one job title.`);
    if (!responsibilityTerms.length) throw new Error(`${label} needs at least one responsibility or type of work.`);
    return { label, titleTerms, responsibilityTerms };
  });
  if (!roles.length) throw new Error('Add at least one role family.');

  const locations = (Array.isArray(raw.locations) ? raw.locations : []).slice(0, 10).map((item, index) => {
    const label = requireText(item?.label ?? item, `Location ${index + 1}`, { maximum: 100 });
    const terms = textLines(item?.terms?.length ? item.terms : label, { maximumItems: 12, maximumLength: 100 });
    return { label, terms };
  });
  if (!locations.length) throw new Error('Add at least one target location.');

  const workingLanguages = textLines(raw.workingLanguages, { maximumItems: 20, maximumLength: 60 });
  const unsupportedLanguages = textLines(raw.unsupportedLanguages, { maximumItems: 30, maximumLength: 60 })
    .filter((language) => !workingLanguages.some((known) => known.toLowerCase() === language.toLowerCase()));
  const authorizedIn = textLines(raw.authorizedIn, { maximumItems: 20, maximumLength: 100 });
  const managerPreference = ['prefer-ic', 'exclude-required-management', 'open']
    .includes(raw.managerPreference) ? raw.managerPreference : 'prefer-ic';
  const selectedPlatforms = textLines(raw.selectedPlatforms, { maximumItems: 8, maximumLength: 40 });
  if (selectedPlatforms.some((id) => !SUPPORTED_PLATFORM_IDS.has(id))) {
    throw new Error('One of the selected alert platforms is not supported.');
  }
  const morningTime = text(raw.morningTime || '07:23', 5);
  const eveningTime = text(raw.eveningTime || '19:23', 5);
  const deliveryTimes = deliveryAttempts(morningTime, eveningTime);
  const repoName = slug(raw.repoName || 'career-ops-private', 'career-ops-private').slice(0, 80);

  if (raw.discoveryConsent !== true) {
    throw new Error('Confirm that you understand Discovery Digest has reduced coverage.');
  }
  if (raw.privateRepoConsent !== true) {
    throw new Error('Confirm that personal career data must be stored in a private repository.');
  }
  if (raw.profileConfirmed !== true) {
    throw new Error('Review and confirm the generated search map first.');
  }

  return {
    schemaVersion: BROWSER_SETUP_SCHEMA_VERSION,
    fullName,
    email,
    cvText,
    city,
    country,
    timezone,
    roles,
    locations,
    workingLanguages,
    unsupportedLanguages,
    authorizedIn,
    needsSponsorship: raw.needsSponsorship === true,
    managerPreference,
    selectedPlatforms,
    morningTime,
    eveningTime,
    deliveryTimes,
    weekdaysOnly: raw.weekdaysOnly === true,
    repoName,
  };
}

export function buildCareerOpsProfile(input) {
  const primary = input.roles.map((role) => role.label);
  return {
    candidate: {
      full_name: input.fullName,
      email: input.email,
      location: `${input.city}, ${input.country}`,
    },
    target_roles: {
      primary,
      archetypes: input.roles.map((role, index) => ({
        name: role.label,
        level: 'To be refined with a Career Ops agent later',
        fit: index === 0 ? 'primary' : 'secondary',
      })),
      title_preferences: {
        preferred: [...new Set(input.roles.flatMap((role) => role.titleTerms))],
      },
    },
    narrative: {
      headline: '',
      exit_story: '',
      superpowers: [],
      proof_points: [],
    },
    compensation: {
      target_range: '',
      currency: '',
      minimum: '',
      location_flexibility: '',
    },
    location: {
      country: input.country,
      city: input.city,
      timezone: input.timezone,
      visa_status: input.needsSponsorship ? 'Sponsorship may be needed outside authorized locations' : '',
      authorized_in: input.authorizedIn,
      needs_sponsorship: input.needsSponsorship,
      preferred_locations: input.locations.map((location) => ({ location: location.label })),
    },
    language: { output: 'en' },
    language_preferences: {
      verified: input.workingLanguages.map((language) => ({ language })),
    },
    spend_tier: 'economy',
    cv: { output_format: 'html' },
  };
}

function contextTerms(roles) {
  return [...new Set(roles.flatMap((role) => [...role.titleTerms, ...role.responsibilityTerms])
    .flatMap((term) => term.toLowerCase().split(/[^a-z0-9]+/))
    .filter((term) => term.length > 3))].slice(0, 50);
}

export function buildBrowserDeploymentProfile(input) {
  const careerOpsProfile = buildCareerOpsProfile(input);
  const draft = buildDeploymentDraft(careerOpsProfile);
  draft.configured = true;
  draft.digest.mode = 'discovery';
  draft.schedule.timezone = input.timezone;
  draft.schedule.weekdays_only = input.weekdaysOnly;
  draft.schedule.delivery_times = input.deliveryTimes;
  draft.search_profile.role_families = input.roles.map((role, index) => ({
    id: slug(role.label, `role-${index + 1}`),
    label: role.label,
    priority: Math.max(1, 4 - index * 0.25),
    title_terms: role.titleTerms,
    responsibility_terms: role.responsibilityTerms,
  }));
  draft.search_profile.title_context_terms = contextTerms(input.roles);
  draft.search_profile.location_groups = input.locations.map((location, index) => ({
    id: index === 0 ? 'home' : `preference-${index + 1}`,
    label: location.label,
    score: Math.max(7, 35 - index * 7),
    terms: location.terms,
  }));
  draft.search_profile.home_location_ids = ['home'];
  draft.search_profile.unsupported_languages = input.unsupportedLanguages.map((item) => item.toLowerCase());
  draft.search_profile.manager_title_penalty = input.managerPreference === 'open' ? 0 : 18;
  draft.search_profile.people_management_penalty = input.managerPreference === 'open' ? 0 : 28;
  if (input.managerPreference === 'exclude-required-management') {
    draft.search_profile.title_excludes = [...new Set([
      ...draft.search_profile.title_excludes,
      'people manager',
      'managing director',
    ])];
  }
  draft.scanner.search_queries = [...new Set(input.roles.flatMap((role) => role.titleTerms))].slice(0, 20);
  return draft;
}

export function applyCareerOpsPortalProfile(portals, input) {
  const result = portals && typeof portals === 'object' && !Array.isArray(portals) ? structuredClone(portals) : {};
  result.title_filter = {
    ...(result.title_filter && typeof result.title_filter === 'object' ? result.title_filter : {}),
    positive: [...new Set(input.roles.flatMap((role) => role.titleTerms))],
    negative: input.managerPreference === 'exclude-required-management'
      ? ['Managing Director', 'People Manager'] : [],
  };
  result.location_filter = {
    always_allow: input.locations[0].terms,
    allow: [...new Set(input.locations.flatMap((location) => location.terms))],
    block: [],
  };
  result.search_queries = [...new Set([
    ...(Array.isArray(result.search_queries) ? result.search_queries : []),
    ...input.roles.flatMap((role) => role.titleTerms.map((title) => `${title} ${input.locations[0].label}`)),
  ])].slice(0, 100);
  if (!Array.isArray(result.tracked_companies)) result.tracked_companies = [];
  if (!Array.isArray(result.job_boards)) result.job_boards = [];
  return result;
}

export function applyBrowserSourcePlan(plan, input) {
  const result = plan && typeof plan === 'object' && !Array.isArray(plan) ? structuredClone(plan) : {};
  const requested = new Set(input.selectedPlatforms);
  result.configured = true;
  result.platforms = (Array.isArray(result.platforms) ? result.platforms : []).map((platform) => ({
    ...platform,
    alert: {
      ...(platform.alert && typeof platform.alert === 'object' ? platform.alert : {}),
      requested: requested.has(platform.id),
      enabled: false,
      tested: false,
    },
  }));
  return result;
}

export function browserSetupPreview(raw) {
  const input = validateBrowserSetupInput(raw);
  const profile = buildBrowserDeploymentProfile(input);
  return {
    schemaVersion: BROWSER_SETUP_SCHEMA_VERSION,
    mode: 'discovery',
    roleFamilies: profile.search_profile.role_families,
    locations: profile.search_profile.location_groups,
    unsupportedLanguages: profile.search_profile.unsupported_languages,
    managerPreference: input.managerPreference,
    schedule: {
      timezone: input.timezone,
      firstAttempts: [input.morningTime, input.eveningTime],
      guardedAttempts: input.deliveryTimes,
      weekdaysOnly: input.weekdaysOnly,
    },
    selectedPlatforms: input.selectedPlatforms,
    repoName: input.repoName,
    privacy: 'private-repository-required',
    modelTokens: 0,
  };
}

export function containsSecret(value) {
  const candidate = String(value ?? '');
  return GENERIC_SECRET_PATTERNS.some((pattern) => pattern.test(candidate));
}

export function redactSecrets(value) {
  let output = String(value ?? '');
  for (const pattern of GENERIC_SECRET_PATTERNS) {
    output = output.replace(new RegExp(pattern.source, `${pattern.flags.replace('g', '')}g`), '[REDACTED_SECRET]');
  }
  return output;
}

export function payloadFingerprint(input) {
  const safe = { ...input, cvText: `[sha256:${createHash('sha256').update(input.cvText).digest('hex')}]` };
  return createHash('sha256').update(JSON.stringify(safe)).digest('hex');
}

export async function writeBrowserProfileFiles(careerOpsRoot, input) {
  const root = path.resolve(careerOpsRoot);
  const profile = buildCareerOpsProfile(input);
  const deployment = buildBrowserDeploymentProfile(input);
  const portalsPath = path.join(root, 'portals.yml');
  let portals = {};
  try { portals = parse(await readFile(portalsPath, 'utf8')) || {}; } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  await mkdir(path.join(root, 'config'), { recursive: true });
  await writeFile(path.join(root, 'config', 'profile.yml'), stringify(profile, { lineWidth: 0 }), 'utf8');
  await writeFile(path.join(root, 'cv.md'), `${input.cvText.trim()}\n`, 'utf8');
  await writeFile(portalsPath, stringify(applyCareerOpsPortalProfile(portals, input), { lineWidth: 0 }), 'utf8');
  return { profile, deployment };
}

export async function assertPrivateWorkspacePath(candidate, setupRoot) {
  const resolvedRoot = path.resolve(setupRoot);
  const resolvedCandidate = path.resolve(candidate);
  const relative = path.relative(resolvedRoot, resolvedCandidate);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('The generated workspace must stay inside the dedicated setup directory.');
  }
  try {
    await access(path.join(resolvedCandidate, '.git'));
  } catch {
    throw new Error('The generated Career Ops workspace is incomplete.');
  }
  return resolvedCandidate;
}
