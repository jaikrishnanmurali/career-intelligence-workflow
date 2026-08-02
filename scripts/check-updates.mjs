#!/usr/bin/env node

import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkUpdates } from '../src/update-check.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const careerOpsRoot = path.resolve(process.env.CAREER_OPS_ROOT || path.join(ROOT, '..', '..'));
const result = await checkUpdates({ careerOpsRoot, extensionRoot: ROOT });
const summary = [
  `Career Ops: ${result.careerOps.local}${result.careerOps.remote ? ` → ${result.careerOps.remote}` : ' (remote unavailable)'}`,
  result.careerOps.remoteSupported === false
    ? 'Compatibility: the latest Career Ops version is outside this installed extension range; do not apply it first.'
    : 'Compatibility: the reported Career Ops version is inside this installed extension range.',
  `Career Intelligence: ${result.extension.local}${result.extension.remote ? ` → ${result.extension.remote}` : ' (remote unavailable)'}`,
  ...result.warnings.map((warning) => `Warning: ${warning}`),
].join('\n');
process.stdout.write(`${result.updatesAvailable ? 'UPDATE AVAILABLE' : 'UP TO DATE'}\n${summary}\n`);
if (process.env.GITHUB_OUTPUT) {
  await appendFile(
    process.env.GITHUB_OUTPUT,
    `updates_available=${result.updatesAvailable}\nsummary<<CAREER_EOF\n${summary}\nCAREER_EOF\n`,
    'utf8',
  );
}
