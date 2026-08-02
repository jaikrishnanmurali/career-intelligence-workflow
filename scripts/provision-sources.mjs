#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse, stringify } from 'yaml';

import { buildSourcePlan, mergeSourceQueries, sourcePlanText } from '../src/source-packs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function provisionSources({
  extensionRoot = ROOT,
  careerOpsRoot = path.join(ROOT, '..', '..'),
  mergePortals = false,
  force = false,
} = {}) {
  const profilePath = path.join(extensionRoot, 'config', 'profile.yml');
  const packsPath = path.join(extensionRoot, 'config', 'source-packs.example.yml');
  const outputPath = path.join(extensionRoot, 'config', 'sources.yml');
  const profile = parse(await readFile(profilePath, 'utf8'));
  const plan = buildSourcePlan(profile, await readFile(packsPath, 'utf8'));
  await writeFile(outputPath, sourcePlanText(plan), { encoding: 'utf8', flag: force ? 'w' : 'wx' });
  if (mergePortals) {
    const portalsPath = path.join(careerOpsRoot, 'portals.yml');
    const portals = parse(await readFile(portalsPath, 'utf8'));
    await writeFile(portalsPath, stringify(mergeSourceQueries(portals, plan), { lineWidth: 0 }), 'utf8');
  }
  return { outputPath, plan, portalsUpdated: mergePortals };
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  provisionSources({
    extensionRoot: path.resolve(argumentValue('--extension-root') || ROOT),
    careerOpsRoot: path.resolve(argumentValue('--career-ops-root') || path.join(ROOT, '..', '..')),
    mergePortals: process.argv.includes('--merge-portals'),
    force: process.argv.includes('--force'),
  }).then(({ outputPath, portalsUpdated, plan }) => {
    process.stdout.write(`Created ${outputPath} with ${plan.platforms.filter((item) => item.selected).length} proposed platforms.\n`);
    process.stdout.write(portalsUpdated
      ? 'Merged the approved platform search queries into Career Ops portals.yml.\n'
      : 'Career Ops portals.yml was not changed. Review the plan before merging queries.\n');
  }).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
