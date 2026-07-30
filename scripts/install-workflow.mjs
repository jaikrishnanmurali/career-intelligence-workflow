#!/usr/bin/env node

import {
  access,
  constants,
  copyFile,
  mkdir,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  const source = path.join(ROOT, 'examples', 'deep-job-scan.scheduled.yml');
  const destination = path.join(root, '.github', 'workflows', 'career-intelligence.yml');
  await mkdir(path.dirname(destination), { recursive: true });
  try {
    await copyFile(source, destination, constants.COPYFILE_EXCL);
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new Error(`Refusing to overwrite ${destination}. Review the existing workflow first.`);
    }
    throw error;
  }
  return destination;
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
    .then((destination) => {
      process.stdout.write(`Installed ${destination}\n`);
      process.stdout.write('The workflow will become active only after it is committed to a private GitHub repository.\n');
    })
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
