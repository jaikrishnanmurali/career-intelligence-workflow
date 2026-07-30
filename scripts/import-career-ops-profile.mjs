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
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function slug(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'target-role';
}

function cleanList(values) {
  return [...new Set(
    (Array.isArray(values) ? values : [values])
      .map((value) => String(value || '').trim())
      .filter(Boolean),
  )];
}

function buildRoleFamilies(profile) {
  const primary = cleanList(profile.target_roles?.primary);
  const archetypes = Array.isArray(profile.target_roles?.archetypes)
    ? profile.target_roles.archetypes
    : [];
  const roles = new Map();

  for (const title of primary) {
    roles.set(title.toLowerCase(), {
      id: slug(title),
      label: title,
      priority: 4,
      terms: [title.toLowerCase()],
      responsibility_terms: [],
    });
  }

  const fitPriority = { primary: 4, secondary: 3.4, adjacent: 2.8 };
  for (const archetype of archetypes) {
    const name = String(archetype?.name || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const existing = roles.get(key);
    const priority = fitPriority[String(archetype?.fit || '').toLowerCase()] || 3;
    if (existing) {
      existing.priority = Math.max(existing.priority, priority);
    } else {
      roles.set(key, {
        id: slug(name),
        label: name,
        priority,
        terms: [name.toLowerCase()],
        responsibility_terms: [],
      });
    }
  }

  if (!roles.size) {
    roles.set('target role', {
      id: 'target-role',
      label: 'Target role',
      priority: 3,
      terms: ['target role'],
      responsibility_terms: [],
    });
  }
  return [...roles.values()];
}

function buildLocationGroup(profile) {
  const values = cleanList([
    profile.location?.city,
    profile.location?.country,
    ...(Array.isArray(profile.location?.authorized_in)
      ? profile.location.authorized_in
      : []),
  ]);
  const label = cleanList([
    profile.location?.city,
    profile.location?.country,
  ]).join(', ') || 'Configured Career Ops location';
  return {
    id: 'career-ops-home',
    label,
    score: 35,
    terms: values.length ? values.map((value) => value.toLowerCase()) : ['remote'],
  };
}

export function buildDiscoveryDraft(careerOpsProfile) {
  const roleFamilies = buildRoleFamilies(careerOpsProfile);
  return {
    version: 1,
    configured: false,
    career_ops: {
      source: '../../config/profile.yml',
      note: 'Imported as a draft. Confirm search-specific rules through the Career Intelligence onboarding conversation.',
    },
    search: {
      lookback_hours: 12,
      experience: {
        core_years: 0,
        total_years_including_adjacent: 0,
        behavior: 'caution',
      },
      manager: {
        prefer_individual_contributor: false,
        title_penalty: 14,
        people_management_penalty: 24,
        low_fit_manager_floor: 64,
      },
      role_families: roleFamilies,
      title_excludes: [],
      individual_contributor_title_signals: [],
      location: {
        home_group_id: 'career-ops-home',
        groups: [buildLocationGroup(careerOpsProfile)],
        obvious_out_of_scope_phrases: [],
        non_target_country_terms: [],
        global_scope_signals: ['worldwide', 'global', 'europe', 'emea', 'remote'],
      },
      languages: {
        exclude_when_hard_required: [],
      },
    },
    discovery: {
      welcome_to_the_jungle_queries: roleFamilies.map((role) => role.label.toLowerCase()),
    },
    runtime: {
      request_timeout_ms: 12000,
      timezone: String(careerOpsProfile.location?.timezone || '').includes('/') ? careerOpsProfile.location.timezone : 'UTC',
      ats_boards_per_source: 400,
      max_scan_minutes: 18,
      max_page_verifications: 60,
    },
  };
}

export async function importCareerOpsProfile(careerOpsRoot, outputPath, { force = false } = {}) {
  const root = path.resolve(careerOpsRoot);
  const inputPath = path.join(root, 'config', 'profile.yml');
  const destination = path.resolve(outputPath);

  if (!await exists(inputPath)) {
    throw new Error(`Career Ops profile not found at ${inputPath}. Complete Career Ops onboarding first.`);
  }
  if (await exists(destination) && !force) {
    throw new Error(`Refusing to overwrite ${destination}. Use --force only after reviewing the existing discovery profile.`);
  }

  const profile = parse(await readFile(inputPath, 'utf8'));
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    throw new Error(`Career Ops profile must be a YAML object: ${inputPath}`);
  }

  const draft = buildDiscoveryDraft(profile);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(
    destination,
    `# Generated from Career Ops. Review and confirm through agent onboarding before deployment.\n${stringify(draft, { lineWidth: 0 })}`,
    'utf8',
  );
  return { inputPath, destination, draft };
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const careerOpsRoot = path.resolve(argumentValue('--root') || path.join(ROOT, '..', '..'));
  const output = path.resolve(argumentValue('--output') || path.join(ROOT, 'config', 'profile.yml'));
  importCareerOpsProfile(careerOpsRoot, output, { force: process.argv.includes('--force') })
    .then((result) => {
      process.stdout.write(`Imported Career Ops profile into ${result.destination} as an unconfirmed draft.\n`);
      process.stdout.write('Open the Career Ops root in Codex or Claude and ask to set up the 12-hour job digest.\n');
    })
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
