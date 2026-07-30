import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { integrateCareerOps } from '../scripts/integrate-career-ops.mjs';

test('installs idempotent namespaced skills into a Career Ops workspace', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'career-intelligence-test-'));
  try {
    const careerOpsRoot = path.join(temp, 'career-ops');
    const extensionRoot = path.join(
      careerOpsRoot,
      'extensions',
      'career-intelligence-workflow',
    );
    await mkdir(path.join(careerOpsRoot, 'modes'), { recursive: true });
    await mkdir(extensionRoot, { recursive: true });
    await writeFile(path.join(careerOpsRoot, 'AGENTS.md'), '# Career Ops\n', 'utf8');

    const first = await integrateCareerOps(careerOpsRoot, { extensionRoot });
    assert.deepEqual(first.results.map((item) => item.status), ['installed', 'installed']);

    const codexSkill = await readFile(
      path.join(careerOpsRoot, '.agents', 'skills', 'career-intelligence', 'SKILL.md'),
      'utf8',
    );
    assert.match(codexSkill, /extensions\/career-intelligence-workflow/);
    assert.match(codexSkill, /never submits an application|Do not use it to submit applications/i);

    const second = await integrateCareerOps(careerOpsRoot, { extensionRoot });
    assert.deepEqual(second.results.map((item) => item.status), ['current', 'current']);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test('refuses to overwrite a different existing integration skill', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'career-intelligence-collision-'));
  try {
    const careerOpsRoot = path.join(temp, 'career-ops');
    const extensionRoot = path.join(careerOpsRoot, 'extensions', 'career-intelligence-workflow');
    const destination = path.join(
      careerOpsRoot,
      '.agents',
      'skills',
      'career-intelligence',
      'SKILL.md',
    );
    await mkdir(path.join(careerOpsRoot, 'modes'), { recursive: true });
    await mkdir(extensionRoot, { recursive: true });
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(path.join(careerOpsRoot, 'AGENTS.md'), '# Career Ops\n', 'utf8');
    await writeFile(destination, 'existing custom skill\n', 'utf8');

    await assert.rejects(
      integrateCareerOps(careerOpsRoot, { extensionRoot }),
      /Refusing to overwrite/,
    );
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});