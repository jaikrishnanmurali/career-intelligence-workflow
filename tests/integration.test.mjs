import assert from 'node:assert/strict';
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
import test from 'node:test';

import { parse } from 'yaml';

import { installIntoCareerOps } from '../bin/cli.mjs';
import { integrateCareerOps } from '../scripts/integrate-career-ops.mjs';
import { importCareerOpsProfile } from '../scripts/import-career-ops-profile.mjs';
import { installWorkflow } from '../scripts/install-workflow.mjs';

const SOURCE_ROOT = fileURLToPath(new URL('..', import.meta.url));

async function createCareerOpsFixture(root) {
  await mkdir(path.join(root, 'modes'), { recursive: true });
  await mkdir(path.join(root, 'config'), { recursive: true });
  await writeFile(path.join(root, 'AGENTS.md'), '# Career Ops\n', 'utf8');
  await writeFile(path.join(root, 'modes', 'scan.md'), '# Scan contract\n', 'utf8');
  await writeFile(path.join(root, 'scan.mjs'), 'process.exit(0);\n', 'utf8');
  await writeFile(path.join(root, 'portals.yml'), 'search_queries: []\ntracked_companies: []\n', 'utf8');
  await writeFile(path.join(root, 'fingerprint-core.mjs'), 'export const fingerprintText = () => "";\n', 'utf8');
  await writeFile(path.join(root, 'cv.md'), '# Fictional CV\n', 'utf8');
  await writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'career-ops', version: '1.24.0' }),
    'utf8',
  );
  await writeFile(
    path.join(root, 'config', 'profile.yml'),
    [
      'candidate:',
      '  full_name: Fictional Person',
      '  email: private@example.test',
      'target_roles:',
      '  primary:',
      '    - Customer Success Specialist',
      '  archetypes:',
      '    - name: Community Operations',
      '      fit: secondary',
      'location:',
      '  city: Dublin',
      '  country: Ireland',
      '  authorized_in: [Ireland]',
      '',
    ].join('\n'),
    'utf8',
  );
}

test('installs idempotent namespaced skills into a completed Career Ops workspace', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'career-intelligence-test-'));
  try {
    const careerOpsRoot = path.join(temp, 'career-ops');
    const extensionRoot = path.join(careerOpsRoot, 'extensions', 'career-intelligence-workflow');
    await createCareerOpsFixture(careerOpsRoot);
    await mkdir(extensionRoot, { recursive: true });

    const first = await integrateCareerOps(careerOpsRoot, { extensionRoot });
    assert.deepEqual(first.results.map((item) => item.status), ['installed', 'installed']);

    const codexSkill = await readFile(
      path.join(careerOpsRoot, '.agents', 'skills', 'career-intelligence', 'SKILL.md'),
      'utf8',
    );
    assert.match(codexSkill, /extensions\/career-intelligence-workflow/);
    assert.match(codexSkill, /Do not use it to submit applications/i);

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
      '.claude',
      'skills',
      'career-intelligence',
      'SKILL.md',
    );
    await createCareerOpsFixture(careerOpsRoot);
    await mkdir(extensionRoot, { recursive: true });
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, 'existing custom skill\n', 'utf8');

    await assert.rejects(
      integrateCareerOps(careerOpsRoot, { extensionRoot }),
      /Refusing to overwrite/,
    );
    await assert.rejects(
      access(path.join(careerOpsRoot, '.agents', 'skills', 'career-intelligence', 'SKILL.md')),
    );
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test('creates a reviewable zero-token scan draft without copying contact data', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'career-intelligence-import-'));
  try {
    const careerOpsRoot = path.join(temp, 'career-ops');
    const output = path.join(temp, 'extension', 'config', 'profile.yml');
    await createCareerOpsFixture(careerOpsRoot);
    await importCareerOpsProfile(careerOpsRoot, output);

    const text = await readFile(output, 'utf8');
    const imported = parse(text);
    assert.equal(imported.configured, false);
    assert.equal(imported.version, 2);
    assert.equal(imported.digest.mode, 'discovery');
    assert.equal(imported.digest.include_unscored, true);
    assert.ok(imported.scanner.direct_sources.includes('arbeitnow'));
    assert.ok(Array.isArray(imported.search_profile.role_families));
    assert.doesNotMatch(text, /Fictional Person|private@example\.test/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test('one-command installer copies the extension and leaves delivery disabled', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'career-intelligence-installer-'));
  try {
    const careerOpsRoot = path.join(temp, 'career-ops');
    await createCareerOpsFixture(careerOpsRoot);

    const result = await installIntoCareerOps(careerOpsRoot, {
      sourceRoot: SOURCE_ROOT,
      skipDependencies: true,
    });
    const installedProfile = parse(
      await readFile(path.join(result.extensionRoot, 'config', 'profile.yml'), 'utf8'),
    );
    assert.equal(installedProfile.configured, false);
    assert.equal(
      JSON.parse(await readFile(path.join(result.extensionRoot, 'package.json'), 'utf8')).name,
      'career-intelligence-workflow',
    );
    assert.equal(
      await readFile(path.join(careerOpsRoot, '.claude', 'skills', 'career-intelligence', 'SKILL.md'), 'utf8')
        .then((text) => text.includes('scheduling and email companion')),
      true,
    );
    await assert.rejects(
      installIntoCareerOps(careerOpsRoot, { sourceRoot: SOURCE_ROOT, skipDependencies: true }),
      /already exists/,
    );
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});


test('installer removes its staging directory after an incomplete package fails', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'career-intelligence-cleanup-'));
  try {
    const careerOpsRoot = path.join(temp, 'career-ops');
    const incompleteSource = path.join(temp, 'incomplete-package');
    const extensionsRoot = path.join(careerOpsRoot, 'extensions');
    await createCareerOpsFixture(careerOpsRoot);
    await mkdir(incompleteSource, { recursive: true });

    await assert.rejects(
      installIntoCareerOps(careerOpsRoot, {
        sourceRoot: incompleteSource,
        skipDependencies: true,
      }),
      /Installer package is incomplete/,
    );
    await assert.rejects(access(path.join(extensionsRoot, 'career-intelligence-workflow')));
    await assert.rejects(access(path.join(extensionsRoot, '.career-intelligence-workflow-installing')));
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});


test('workflow installer adds three guarded attempts per delivery slot', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'career-intelligence-workflow-'));
  try {
    const careerOpsRoot = path.join(temp, 'career-ops');
    await createCareerOpsFixture(careerOpsRoot);

    const destination = await installWorkflow(careerOpsRoot);
    const workflow = await readFile(destination, 'utf8');
    assert.equal((workflow.match(/- cron:/g) || []).length, 6);
    assert.match(workflow, /guard-only/);
    assert.match(workflow, /schedule-guard\.mjs/);
    assert.match(workflow, /state-sync\.mjs restore/);
    assert.match(workflow, /state-sync\.mjs save/);
    assert.match(workflow, /openai\/codex-action@v1/);
    assert.match(workflow, /anthropics\/claude-code-action@v1/);
    assert.match(workflow, /repository\.private/);
    assert.match(workflow, /--slot/);

    await assert.rejects(installWorkflow(careerOpsRoot), /Refusing to overwrite/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
