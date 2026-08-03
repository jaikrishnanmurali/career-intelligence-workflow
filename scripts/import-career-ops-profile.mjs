#!/usr/bin/env node

import {
  access,
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse, stringify } from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function exists(filePath) {
  try { await access(filePath); return true; } catch { return false; }
}

export function buildDeploymentDraft(careerOpsProfile) {
  const configuredTimezone = String(careerOpsProfile?.location?.timezone || '').trim();
  const timezone = configuredTimezone.includes('/') ? configuredTimezone : 'UTC';
  const primaryRoles = Array.isArray(careerOpsProfile?.target_roles?.primary)
    ? careerOpsProfile.target_roles.primary.map(String).map((value) => value.trim()).filter(Boolean)
    : [];
  const preferredTitles = Array.isArray(careerOpsProfile?.target_roles?.title_preferences?.preferred)
    ? careerOpsProfile.target_roles.title_preferences.preferred.map(String).map((value) => value.trim()).filter(Boolean)
    : [];
  const archetypes = Array.isArray(careerOpsProfile?.target_roles?.archetypes)
    ? careerOpsProfile.target_roles.archetypes : [];
  const familyNames = [...new Set([
    ...archetypes.map((item) => String(item?.name || '').trim()),
    ...primaryRoles,
  ].filter(Boolean))];
  const roleFamilies = familyNames.map((name, index) => ({
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `role-family-${index + 1}`,
    label: name,
    priority: Math.max(1, 4 - index * 0.25),
    title_terms: [...new Set([
      name,
      ...preferredTitles.filter((title) => title.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(title.toLowerCase())),
    ])],
    responsibility_terms: [name],
  }));
  if (!roleFamilies.length) {
    roleFamilies.push({
      id: 'confirm-target-role',
      label: 'Confirm target role',
      priority: 4,
      title_terms: ['replace this with a target title'],
      responsibility_terms: ['replace this with a responsibility'],
    });
  }
  const preferredLocations = Array.isArray(careerOpsProfile?.location?.preferred_locations)
    ? careerOpsProfile.location.preferred_locations
      .map((item) => String(item?.location || item || '').trim()).filter(Boolean)
    : [];
  const homeLocation = [careerOpsProfile?.candidate?.location, careerOpsProfile?.location?.city, careerOpsProfile?.location?.country]
    .map((value) => String(value || '').trim()).filter(Boolean);
  const locations = [...new Set([...preferredLocations, ...homeLocation])];
  const locationGroups = locations.length
    ? locations.map((location, index) => ({
      id: index === 0 ? 'home' : `preference-${index + 1}`,
      label: location,
      score: Math.max(5, 35 - index * 7),
      terms: [location],
    }))
    : [{ id: 'home', label: 'Confirm home market', score: 35, terms: ['replace with a location'] }];
  const verifiedLanguages = new Set(
    (Array.isArray(careerOpsProfile?.language_preferences?.verified)
      ? careerOpsProfile.language_preferences.verified : [])
      .map((item) => String(item?.language || item || '').trim().toLowerCase())
      .filter(Boolean),
  );
  const languageUniverse = ['swedish', 'dutch', 'german', 'french', 'danish', 'norwegian', 'finnish', 'italian', 'spanish', 'portuguese', 'polish', 'czech'];
  return {
    version: 2,
    configured: false,
    digest: {
      mode: 'discovery',
      provider: 'codex',
      lookback_hours: 12,
      include_unscored: true,
    },
    schedule: {
      timezone,
      weekdays_only: false,
      minimum_gap_hours: 6,
      delivery_times: ['07:23', '07:43', '08:03', '19:23', '19:43', '20:03'],
    },
    intake: {
      enabled: false,
      max_emails_per_run: 100,
      max_body_bytes: 1_500_000,
      retention_days: 30,
    },
    scanner: {
      direct_sources: ['platsbanken-jobstream', 'arbeitnow', 'thehub', 'wttj', 'jobicy', 'himalayas', 'remotive', 'remoteok'],
      ats_sources: ['greenhouse', 'lever', 'ashby', 'workday'],
      ats_boards_per_source: 250,
      max_scan_minutes: 7,
      max_page_verifications: 30,
      request_timeout_ms: 12000,
      search_queries: roleFamilies.flatMap((family) => family.title_terms).slice(0, 20),
    },
    search_profile: {
      role_families: roleFamilies,
      title_context_terms: [...new Set(roleFamilies.flatMap((family) => family.title_terms)
        .flatMap((term) => term.toLowerCase().split(/[^a-z0-9]+/)).filter((term) => term.length > 3))],
      // Neutral by default: no role function is excluded automatically. Onboarding
      // asks the user what they are not targeting and adds terms here.
      title_excludes: [],
      ic_title_signals: ['specialist', 'coordinator', 'associate', 'analyst', 'consultant', 'advisor'],
      location_groups: locationGroups,
      location_excludes: ['united states only', 'canada only', 'india only', 'apac only'],
      home_location_ids: ['home'],
      unsupported_languages: languageUniverse.filter((language) => !verifiedLanguages.has(language)),
      manager_title_penalty: 14,
      people_management_penalty: 24,
      ic_title_bonus: 10,
      priority_score: 88,
      worth_look_score: 64,
    },
    budget: {
      max_agent_turns: 12,
      max_agent_minutes: 20,
      max_full_evaluations: 30,
    },
    health: { failure_warning_after: 2 },
  };
}

// Compatibility export for integrations built before the delivery-only design.
export const buildDiscoveryDraft = buildDeploymentDraft;

export async function importCareerOpsProfile(careerOpsRoot, outputPath, { force = false } = {}) {
  const root = path.resolve(careerOpsRoot);
  const inputPath = path.join(root, 'config', 'profile.yml');
  const destination = path.resolve(outputPath);
  if (!await exists(inputPath)) {
    throw new Error(`Career Ops profile not found at ${inputPath}. Complete Career Ops onboarding first.`);
  }
  if (await exists(destination) && !force) {
    throw new Error(`Refusing to overwrite ${destination}. Use --force only after reviewing it.`);
  }
  const profile = parse(await readFile(inputPath, 'utf8'));
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    throw new Error(`Career Ops profile must be a YAML object: ${inputPath}`);
  }
  const draft = buildDeploymentDraft(profile);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(
    destination,
    `# Drafted from Career Ops. Review role terms, locations and languages, then set configured: true.\n${stringify(draft, { lineWidth: 0 })}`,
    'utf8',
  );
  return { inputPath, destination, draft };
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const careerOpsRoot = path.resolve(argumentValue('--root') || path.join(ROOT, '..', '..'));
  const output = path.resolve(argumentValue('--output') || path.join(ROOT, 'config', 'profile.yml'));
  importCareerOpsProfile(careerOpsRoot, output, { force: process.argv.includes('--force') })
    .then((result) => {
      process.stdout.write(`Created structured-scan settings at ${result.destination}. Review them before enabling GitHub Actions.\n`);
    })
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
