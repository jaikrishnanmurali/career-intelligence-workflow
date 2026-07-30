#!/usr/bin/env node

import {
  access,
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE_PATH = path.join(
  ROOT,
  'integrations',
  'career-ops',
  'career-intelligence.SKILL.md',
);

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function portableRelative(from, to) {
  return path.relative(from, to).split(path.sep).join('/');
}

export async function integrateCareerOps(careerOpsRoot, options = {}) {
  const targetRoot = path.resolve(careerOpsRoot);
  const extensionRoot = path.resolve(options.extensionRoot || ROOT);
  const force = Boolean(options.force);
  const relativeExtension = portableRelative(targetRoot, extensionRoot);

  if (!relativeExtension || relativeExtension.startsWith('../') || path.isAbsolute(relativeExtension)) {
    throw new Error(
      'Career Intelligence must be cloned inside the Career Ops repository, for example extensions/career-intelligence-workflow.',
    );
  }
  if (!await exists(path.join(targetRoot, 'AGENTS.md'))) {
    throw new Error(`No Career Ops AGENTS.md found at ${targetRoot}.`);
  }
  if (!await exists(path.join(targetRoot, 'modes'))) {
    throw new Error(`No Career Ops modes directory found at ${targetRoot}.`);
  }
  if (!await exists(path.join(targetRoot, 'config', 'profile.yml'))) {
    throw new Error(`No Career Ops profile found at ${path.join(targetRoot, 'config', 'profile.yml')}.`);
  }
  if (!await exists(path.join(targetRoot, 'cv.md'))) {
    throw new Error(`No Career Ops cv.md found at ${targetRoot}. Complete Career Ops onboarding first.`);
  }

  const template = await readFile(TEMPLATE_PATH, 'utf8');
  const rendered = template.replaceAll('{{EXTENSION_PATH}}', relativeExtension);
  const destinations = [
    path.join(targetRoot, '.agents', 'skills', 'career-intelligence', 'SKILL.md'),
    path.join(targetRoot, '.claude', 'skills', 'career-intelligence', 'SKILL.md'),
  ];
  const plans = [];

  for (const destination of destinations) {
    if (await exists(destination)) {
      const current = await readFile(destination, 'utf8');
      if (current === rendered) {
        plans.push({ destination, status: 'current' });
        continue;
      }
      if (!force) {
        throw new Error(
          `Refusing to overwrite ${destination}. Re-run with --force only after reviewing that file.`,
        );
      }
    }
    plans.push({ destination, status: 'installed' });
  }

  for (const plan of plans) {
    if (plan.status === 'current') continue;
    const { destination } = plan;
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, rendered, 'utf8');
  }

  return { targetRoot, extensionRoot, relativeExtension, results: plans };
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const rootArg = argumentValue('--root');
  if (!rootArg) {
    process.stderr.write('Usage: npm run integrate:career-ops -- --root <career-ops-directory> [--force]\n');
    process.exitCode = 1;
  } else {
    try {
      const result = await integrateCareerOps(rootArg, {
        force: process.argv.includes('--force'),
      });
      for (const item of result.results) {
        process.stdout.write(`${item.status === 'current' ? 'Kept' : 'Installed'} ${path.relative(result.targetRoot, item.destination)}\n`);
      }
      process.stdout.write([
        '',
        'Career Intelligence is now available as the Career Ops email and discovery companion.',
        'Open Codex or Claude from the Career Ops root and ask:',
        '"Set up my 12-hour Career Intelligence job digest."',
        'No email was sent and no schedule was enabled.',
        '',
      ].join('\n'));
    } catch (error) {
      process.stderr.write(`Integration failed: ${error.message}\n`);
      process.exitCode = 1;
    }
  }
}