import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { checkUpdates, compareSemver } from '../src/update-check.mjs';

test('compares semantic versions without treating prefixes as releases', () => {
  assert.equal(compareSemver('1.23.0', 'v1.24.0'), -1);
  assert.equal(compareSemver('v1.24.0', '1.24.0'), 0);
  assert.equal(compareSemver('1.25.0', '1.24.9'), 1);
  assert.equal(compareSemver('unknown', '1.0.0'), null);
});

test('reports upstream changes without applying them', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'career-intelligence-updates-'));
  try {
    const careerOpsRoot = path.join(temp, 'career-ops');
    const extensionRoot = path.join(careerOpsRoot, 'extensions', 'career-intelligence-workflow');
    await mkdir(extensionRoot, { recursive: true });
    await writeFile(path.join(careerOpsRoot, 'package.json'), JSON.stringify({ version: '1.23.0' }));
    await writeFile(path.join(extensionRoot, 'package.json'), JSON.stringify({ version: '1.2.0' }));
    const fetchImpl = async (url) => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => {
        if (url.endsWith('/VERSION')) return '1.24.0\n';
        if (url.includes('/releases/latest')) return JSON.stringify({ tag_name: 'v1.24.1' });
        return JSON.stringify({ version: '1.3.0' });
      },
    });
    const result = await checkUpdates({ careerOpsRoot, extensionRoot, fetchImpl });
    assert.equal(result.updatesAvailable, true);
    assert.deepEqual(result.careerOps, {
      local: '1.23.0',
      remote: 'v1.24.1',
      updateAvailable: true,
      remoteSupported: true,
    });
    assert.deepEqual(result.extension, { local: '1.2.0', remote: '1.3.0', updateAvailable: true });
    assert.equal(result.warnings.length, 0);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
