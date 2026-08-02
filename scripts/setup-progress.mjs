#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { atomicWriteJson, readJson } from '../src/util.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_PATH = path.join(ROOT, 'state', 'setup-progress.json');

export const SETUP_STAGES = Object.freeze([
  { id: 'environment', label: 'Checking your setup' },
  { id: 'career_ops', label: 'Connecting Career Ops' },
  { id: 'search_profile', label: 'Building your search map' },
  { id: 'local_validation', label: 'Testing the discovery pipeline' },
  { id: 'github', label: 'Creating the private cloud workspace' },
  { id: 'resend', label: 'Connecting email delivery' },
  { id: 'cloud_workflow', label: 'Installing the 12-hour schedule' },
  { id: 'first_run', label: 'Sending the first digest' },
]);

function cleanProgress(value) {
  const completed = value?.completed && typeof value.completed === 'object'
    ? Object.fromEntries(
      SETUP_STAGES
        .filter(({ id }) => typeof value.completed[id] === 'string')
        .map(({ id }) => [id, value.completed[id]]),
    )
    : {};
  return { schemaVersion: 1, completed };
}

export async function readSetupProgress(filePath = DEFAULT_PATH) {
  return cleanProgress(await readJson(filePath, { schemaVersion: 1, completed: {} }));
}

export function setupStatus(progress) {
  const completed = progress?.completed || {};
  const nextIndex = SETUP_STAGES.findIndex(({ id }) => !completed[id]);
  return {
    complete: nextIndex === -1,
    completedCount: SETUP_STAGES.length - (nextIndex === -1 ? 0 : SETUP_STAGES.slice(nextIndex).filter(({ id }) => !completed[id]).length),
    totalCount: SETUP_STAGES.length,
    next: nextIndex === -1 ? null : SETUP_STAGES[nextIndex],
  };
}

export async function completeSetupStage(stageId, filePath = DEFAULT_PATH, now = new Date()) {
  const stage = SETUP_STAGES.find(({ id }) => id === stageId);
  if (!stage) {
    throw new Error(`Unknown setup stage: ${stageId}. Expected one of: ${SETUP_STAGES.map(({ id }) => id).join(', ')}.`);
  }
  const progress = await readSetupProgress(filePath);
  progress.completed[stageId] = now.toISOString();
  await atomicWriteJson(filePath, progress);
  return { progress, stage, status: setupStatus(progress) };
}

function render(progress) {
  const status = setupStatus(progress);
  const lines = [
    'Career Intelligence setup',
    `Progress: ${status.completedCount} of ${status.totalCount} stages complete`,
    ...SETUP_STAGES.map(({ id, label }, index) => `${progress.completed[id] ? '[done]' : '[    ]'} Stage ${index + 1} — ${label}`),
  ];
  lines.push(status.complete
    ? 'Next: Setup is complete. Run npm run status to check the live digest.'
    : `Next: Stage ${SETUP_STAGES.indexOf(status.next) + 1} — ${status.next.label}`);
  return `${lines.join('\n')}\n`;
}

function isMain() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMain()) {
  const command = process.argv[2] || 'show';
  try {
    if (command === 'show') {
      process.stdout.write(render(await readSetupProgress()));
    } else if (command === 'complete') {
      const result = await completeSetupStage(process.argv[3]);
      process.stdout.write(`Completed: ${result.stage.label}\n${render(result.progress)}`);
    } else if (command === 'reset') {
      await atomicWriteJson(DEFAULT_PATH, { schemaVersion: 1, completed: {} });
      process.stdout.write('Local setup progress was reset. No deployment, scan history, or credentials were changed.\n');
    } else {
      throw new Error('Usage: node scripts/setup-progress.mjs [show|complete <stage>|reset]');
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
