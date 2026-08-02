import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DIGEST_MODE } from '../src/config.mjs';
import { buildDigest } from '../src/email.mjs';
import { validateCareerOpsRoot } from '../src/career-ops.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const careerOpsRoot = path.resolve(process.env.CAREER_OPS_ROOT || path.join(root, '..', '..'));
const workspace = await validateCareerOpsRoot(careerOpsRoot, {
  requirePrivateInputs: DIGEST_MODE === 'smart',
});
const digest = buildDigest({
  generatedAt: new Date().toISOString(),
  mode: DIGEST_MODE,
  scanSummary: `Smoke validation only for Career Ops ${workspace.version}. No scan ran.`,
  coverage: {
    completeness: DIGEST_MODE === 'discovery' ? 'reduced' : 'partial',
    summary: 'Smoke validation does not claim source coverage.',
    warnings: [],
  },
  recommended: [],
  possible: [],
  other: [],
});
if (!digest.subject || !digest.text || !digest.html) throw new Error('Digest rendering failed.');
process.stdout.write(`Smoke validation passed for ${DIGEST_MODE}. No scan ran and no email was sent.\n`);