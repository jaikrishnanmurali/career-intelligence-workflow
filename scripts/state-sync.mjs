#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EXTENSION_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CAREER_OPS_ROOT = path.resolve(process.env.CAREER_OPS_ROOT || path.join(EXTENSION_ROOT, '..', '..'));
const STATE_BRANCH = process.env.CAREER_INTELLIGENCE_STATE_BRANCH || 'career-intelligence-state';
const extensionRelative = path.relative(CAREER_OPS_ROOT, EXTENSION_ROOT).split(path.sep).join('/');
const FILES = [
  'data/scan-history.tsv',
  'data/pipeline.md',
  'data/shortlist.md',
  'data/applications.md',
  `${extensionRelative}/state/state.json`,
  `${extensionRelative}/state/before-scan.tsv`,
  `${extensionRelative}/state/run-context.json`,
  `${extensionRelative}/state/coverage-plan.json`,
  `${extensionRelative}/state/coverage-result.json`,
  `${extensionRelative}/state/candidates.json`,
  `${extensionRelative}/state/evaluations.json`,
  `${extensionRelative}/state/pending-scanner-state.json`,
  `${extensionRelative}/reports/latest.json`,
];

async function exists(filePath) {
  try { await access(filePath); return true; } catch { return false; }
}

function git(args, options = {}) {
  const result = spawnSync('git', args, {
    cwd: CAREER_OPS_ROOT,
    encoding: options.binary ? null : 'utf8',
    env: { ...process.env, ...(options.env || {}) },
  });
  if (options.allowFailure) return result;
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`git ${args[0]} failed: ${String(result.stderr || '').trim() || `exit ${result.status}`}`);
  }
  return result;
}

async function restore() {
  const remoteRef = `refs/remotes/origin/${STATE_BRANCH}`;
  const fetch = git(
    ['fetch', '--no-tags', 'origin', `refs/heads/${STATE_BRANCH}:${remoteRef}`],
    { allowFailure: true },
  );
  if (fetch.status !== 0) {
    const message = String(fetch.stderr || '');
    if (/couldn.t find remote ref|remote ref does not exist/i.test(message)) {
      process.stdout.write('No state branch exists yet; this is the first saved run.\n');
      return;
    }
    throw new Error(`Could not restore ${STATE_BRANCH}: ${message.trim()}`);
  }
  let restored = 0;
  for (const relative of FILES) {
    const result = git(['show', `${remoteRef}:${relative}`], { allowFailure: true, binary: true });
    if (result.status !== 0) continue;
    const destination = path.join(CAREER_OPS_ROOT, ...relative.split('/'));
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, result.stdout);
    restored += 1;
  }
  process.stdout.write(`Restored ${restored} allowlisted state files from ${STATE_BRANCH}.\n`);
}

async function save() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'career-intelligence-state-'));
  const indexPath = path.join(tempRoot, 'index');
  const gitEnv = {
    GIT_INDEX_FILE: indexPath,
    GIT_AUTHOR_NAME: 'career-intelligence-bot',
    GIT_AUTHOR_EMAIL: 'career-intelligence-bot@users.noreply.github.com',
    GIT_COMMITTER_NAME: 'career-intelligence-bot',
    GIT_COMMITTER_EMAIL: 'career-intelligence-bot@users.noreply.github.com',
  };
  try {
    git(['read-tree', '--empty'], { env: gitEnv });
    let saved = 0;
    for (const relative of FILES) {
      const source = path.join(CAREER_OPS_ROOT, ...relative.split('/'));
      if (!await exists(source)) continue;
      const blob = git(['hash-object', '-w', '--', source]).stdout.trim();
      git(['update-index', '--add', '--cacheinfo', '100644', blob, relative], { env: gitEnv });
      saved += 1;
    }
    if (!saved) throw new Error('No allowlisted state files exist to save.');
    const tree = git(['write-tree'], { env: gitEnv }).stdout.trim();
    const remoteRef = `refs/remotes/origin/${STATE_BRANCH}`;
    const parent = git(['rev-parse', '--verify', remoteRef], { allowFailure: true }).stdout?.trim();
    const commitArgs = ['commit-tree', tree];
    if (parent) commitArgs.push('-p', parent);
    commitArgs.push('-m', `chore: save Career Intelligence state ${new Date().toISOString()}`);
    const commit = git(commitArgs, { env: gitEnv }).stdout.trim();
    git(['push', 'origin', `${commit}:refs/heads/${STATE_BRANCH}`]);
    process.stdout.write(`Saved ${saved} allowlisted state files to ${STATE_BRANCH}.\n`);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

const command = process.argv[2];
if (command === 'restore') await restore();
else if (command === 'save') await save();
else throw new Error('Usage: node scripts/state-sync.mjs restore|save');
