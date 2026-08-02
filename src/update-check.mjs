import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { supportedCareerOpsVersion } from './career-ops.mjs';

function parts(value) {
  const match = String(value || '').match(/(?:^|-)v?(\d+)\.(\d+)\.(\d+)/i);
  return match ? match.slice(1, 4).map(Number) : null;
}

export function compareSemver(left, right) {
  const a = parts(left);
  const b = parts(right);
  if (!a || !b) return null;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;
  }
  return 0;
}

async function fetchText(url, fetchImpl) {
  const response = await fetchImpl(url, {
    headers: { accept: 'application/json,text/plain', 'user-agent': 'CareerIntelligenceWorkflow/1.3' },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

function higherVersion(values) {
  return values.filter((value) => parts(value)).sort((left, right) => compareSemver(right, left))[0] || '';
}

export async function checkUpdates({ careerOpsRoot, extensionRoot, fetchImpl = fetch }) {
  const careerPackage = JSON.parse(await readFile(path.join(careerOpsRoot, 'package.json'), 'utf8'));
  const extensionPackage = JSON.parse(await readFile(path.join(extensionRoot, 'package.json'), 'utf8'));
  const warnings = [];
  let careerOpsRemote = '';
  try {
    const [versionText, releaseText] = await Promise.all([
      fetchText('https://raw.githubusercontent.com/santifer/career-ops/main/VERSION', fetchImpl),
      fetchText('https://api.github.com/repos/santifer/career-ops/releases/latest', fetchImpl),
    ]);
    const release = JSON.parse(releaseText);
    careerOpsRemote = higherVersion([versionText.trim().split(/\s+/)[0], release.tag_name]);
  } catch (error) {
    warnings.push(`Career Ops update check was unavailable: ${error.message}`);
  }
  let extensionRemote = '';
  try {
    const text = await fetchText(
      'https://raw.githubusercontent.com/jaikrishnanmurali/career-intelligence-workflow/main/package.json',
      fetchImpl,
    );
    extensionRemote = JSON.parse(text).version || '';
  } catch (error) {
    warnings.push(`Career Intelligence update check was unavailable: ${error.message}`);
  }
  const careerOpsUpdate = careerOpsRemote
    && compareSemver(careerPackage.version, careerOpsRemote) < 0;
  const extensionUpdate = extensionRemote
    && compareSemver(extensionPackage.version, extensionRemote) < 0;
  return {
    checkedAt: new Date().toISOString(),
    updatesAvailable: Boolean(careerOpsUpdate || extensionUpdate),
    careerOps: {
      local: careerPackage.version,
      remote: careerOpsRemote || null,
      updateAvailable: Boolean(careerOpsUpdate),
      remoteSupported: careerOpsRemote ? supportedCareerOpsVersion(careerOpsRemote) : null,
    },
    extension: { local: extensionPackage.version, remote: extensionRemote || null, updateAvailable: Boolean(extensionUpdate) },
    warnings,
  };
}
