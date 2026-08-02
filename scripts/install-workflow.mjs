#!/usr/bin/env node

import {
  access,
  constants,
  copyFile,
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';

import { renderScheduledWorkflow } from '../src/workflow-schedule.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function installWorkflow(careerOpsRoot) {
  const root = path.resolve(careerOpsRoot);
  if (!await exists(path.join(root, 'AGENTS.md'))) {
    throw new Error(`No Career Ops AGENTS.md found at ${root}.`);
  }
  const extensionRoot = path.join(root, 'extensions', 'career-intelligence-workflow');
  const profilePath = path.join(extensionRoot, 'config', 'profile.yml');
  if (!await exists(profilePath)) throw new Error(`Career Intelligence profile not found at ${profilePath}.`);
  const profile = parse(await readFile(profilePath, 'utf8'));
  const timeZone = String(profile?.schedule?.timezone || 'UTC');
  const localTimes = Array.isArray(profile?.schedule?.delivery_times)
    ? profile.schedule.delivery_times.map(String) : [];
  if (!localTimes.length) throw new Error('schedule.delivery_times must be confirmed before installing workflows.');
  const maxAgentTurns = Number(profile?.budget?.max_agent_turns || 12);
  if (!Number.isInteger(maxAgentTurns) || maxAgentTurns < 1 || maxAgentTurns > 100) {
    throw new Error('budget.max_agent_turns must be an integer between 1 and 100.');
  }
  const weekdaysOnly = profile?.schedule?.weekdays_only === true;
  const workflows = [
    ['career-intelligence.scheduled.yml', 'career-intelligence.yml', true],
    ['career-intelligence.intake.yml', 'career-intelligence-intake.yml', false],
    ['career-intelligence.maintenance.yml', 'career-intelligence-maintenance.yml', false],
  ];
  const destinations = [];
  await mkdir(path.join(root, '.github', 'workflows'), { recursive: true });
  for (const [sourceName, destinationName, scheduled] of workflows) {
    const source = path.join(ROOT, 'examples', sourceName);
    const destination = path.join(root, '.github', 'workflows', destinationName);
    if (await exists(destination)) {
      throw new Error(`Refusing to overwrite ${destination}. Review the existing workflow first.`);
    }
    if (scheduled) {
      const rendered = renderScheduledWorkflow(await readFile(source, 'utf8'), {
        timeZone,
        localTimes,
        maxAgentTurns,
        weekdaysOnly,
      });
      await writeFile(destination, rendered, { encoding: 'utf8', flag: 'wx' });
    } else {
      await copyFile(source, destination, constants.COPYFILE_EXCL);
    }
    destinations.push(destination);
  }
  return destinations;
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const root = path.resolve(argumentValue('--root') || path.join(ROOT, '..', '..'));
  installWorkflow(root)
    .then((destinations) => {
      for (const destination of destinations) process.stdout.write(`Installed ${destination}\n`);
      process.stdout.write('The workflow will become active only after it is committed to a private GitHub repository.\n');
    })
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
