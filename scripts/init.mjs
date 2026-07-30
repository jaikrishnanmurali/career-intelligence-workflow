#!/usr/bin/env node

import { constants } from 'node:fs';
import {
  copyFile,
  mkdir,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function copyIfMissing(source, destination) {
  await mkdir(path.dirname(destination), { recursive: true });
  try {
    await copyFile(source, destination, constants.COPYFILE_EXCL);
    return 'created';
  } catch (error) {
    if (error?.code === 'EEXIST') return 'kept';
    throw error;
  }
}

const files = [
  ['config/profile.example.yml', 'config/profile.yml'],
  ['.env.example', '.env'],
];

for (const [sourceName, destinationName] of files) {
  const result = await copyIfMissing(
    path.join(ROOT, sourceName),
    path.join(ROOT, destinationName),
  );
  process.stdout.write(`${result === 'created' ? 'Created' : 'Kept existing'} ${destinationName}\n`);
}

process.stdout.write([
  '',
  'Next:',
  '1. Edit config/profile.yml with your search criteria.',
  '2. Run npm run doctor.',
  '3. Run npm run smoke.',
  '4. Follow docs/RESEND.md before enabling email.',
  '',
].join('\n'));