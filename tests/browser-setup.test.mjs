import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  browserSetupPreview,
  applyBrowserSourcePlan,
  buildBrowserDeploymentProfile,
  buildCareerOpsProfile,
  containsSecret,
  deliveryAttempts,
  maskRecipient,
  mutationOriginAllowed,
  redactSecrets,
  SUPPORTED_CAREER_OPS_TAG,
  upstreamRemoteOps,
  validateBrowserSetupInput,
} from '../src/browser-setup.mjs';

function fictionalInput(overrides = {}) {
  return {
    fullName: 'Morgan Example',
    email: 'morgan@example.test',
    cvText: '# Morgan Example\n\nOperations specialist with fictional experience used only for an automated test. '.repeat(4),
    city: 'Dublin',
    country: 'Ireland',
    timezone: 'Europe/Dublin',
    roles: [{
      label: 'Partner operations',
      titleTerms: ['Partner Operations Specialist', 'Partner Enablement Specialist'],
      responsibilityTerms: ['Partner onboarding', 'Cross-functional delivery'],
    }],
    locations: [
      { label: 'Dublin, Ireland', terms: ['Dublin', 'Ireland'] },
      { label: 'European Union — remote', terms: ['European Union', 'Europe', 'Remote'] },
    ],
    workingLanguages: ['English'],
    unsupportedLanguages: ['German', 'French'],
    authorizedIn: ['Ireland', 'European Union'],
    needsSponsorship: false,
    managerPreference: 'prefer-ic',
    selectedPlatforms: ['linkedin', 'indeed'],
    morningTime: '07:23',
    eveningTime: '19:23',
    weekdaysOnly: false,
    repoName: 'career-ops-private',
    discoveryConsent: true,
    privateRepoConsent: true,
    profileConfirmed: true,
    ...overrides,
  };
}

test('browser setup builds three guarded attempts for each delivery window', () => {
  assert.deepEqual(deliveryAttempts('23:45', '07:05'), ['23:45', '00:05', '00:25', '07:05', '07:25', '07:45']);
});

test('browser setup validates consent and real search-map details', () => {
  const input = validateBrowserSetupInput(fictionalInput());
  assert.equal(input.roles[0].label, 'Partner operations');
  assert.equal(input.deliveryTimes.length, 6);
  assert.throws(() => validateBrowserSetupInput(fictionalInput({ discoveryConsent: false })), /reduced coverage/i);
  assert.throws(() => validateBrowserSetupInput(fictionalInput({ roles: [] })), /role family/i);
});

test('browser setup creates Career Ops and confirmed Discovery profiles without inventing narrative claims', () => {
  const input = validateBrowserSetupInput(fictionalInput());
  const careerOps = buildCareerOpsProfile(input);
  const deployment = buildBrowserDeploymentProfile(input);
  assert.equal(careerOps.narrative.headline, '');
  assert.deepEqual(careerOps.narrative.proof_points, []);
  assert.equal(deployment.configured, true);
  assert.equal(deployment.digest.mode, 'discovery');
  assert.equal(deployment.search_profile.role_families[0].responsibility_terms[0], 'Partner onboarding');
  assert.deepEqual(deployment.search_profile.unsupported_languages, ['german', 'french']);
});

test('browser setup confirms the reviewed source plan without pretending requested alerts are connected', () => {
  const input = validateBrowserSetupInput(fictionalInput());
  const plan = applyBrowserSourcePlan({
    configured: false,
    platforms: [
      { id: 'linkedin', alert: { enabled: false, tested: false } },
      { id: 'wellfound', alert: { enabled: false, tested: false } },
    ],
  }, input);
  assert.equal(plan.configured, true);
  assert.deepEqual(plan.platforms[0].alert, { requested: true, enabled: false, tested: false });
  assert.deepEqual(plan.platforms[1].alert, { requested: false, enabled: false, tested: false });
});

test('browser preview states privacy, reduced provider use, and zero model tokens', () => {
  const preview = browserSetupPreview(fictionalInput());
  assert.equal(preview.privacy, 'private-repository-required');
  assert.equal(preview.mode, 'discovery');
  assert.equal(preview.modelTokens, 0);
  assert.deepEqual(preview.selectedPlatforms, ['linkedin', 'indeed']);
});

test('browser setup secret checks detect and redact credential-shaped values', () => {
  const value = `token re_${'a'.repeat(30)} then ghp_${'b'.repeat(30)}`;
  assert.equal(containsSecret(value), true);
  const redacted = redactSecrets(value);
  assert.doesNotMatch(redacted, /re_[a-z]{20}/i);
  assert.doesNotMatch(redacted, /ghp_[a-z]{20}/i);
});

test('upstream remote reconciliation is idempotent across failed-publish retries', () => {
  const santiferOrigin = [
    'origin\thttps://github.com/santifer/career-ops.git (fetch)',
    'origin\thttps://github.com/santifer/career-ops.git (push)',
  ].join('\n');
  // Fresh clone: origin points upstream, no leftover remote -> just the rename.
  assert.deepEqual(upstreamRemoteOps(santiferOrigin), [
    ['remote', 'rename', 'origin', 'career-ops-upstream'],
  ]);
  // The reported failure: a previous publish already renamed origin into
  // career-ops-upstream and then failed, but a fresh prepare recreated origin.
  // Both now coexist, which today makes `git remote rename` abort. The helper
  // clears the stale upstream name first so the retry succeeds.
  const withStaleUpstream = [
    santiferOrigin,
    'career-ops-upstream\thttps://github.com/santifer/career-ops.git (fetch)',
    'career-ops-upstream\thttps://github.com/santifer/career-ops.git (push)',
  ].join('\n');
  assert.deepEqual(upstreamRemoteOps(withStaleUpstream), [
    ['remote', 'remove', 'career-ops-upstream'],
    ['remote', 'rename', 'origin', 'career-ops-upstream'],
  ]);
  // Already reconciled: origin is gone and upstream is already named. The
  // upstream pointer must be preserved, not deleted.
  const reconciled = [
    'career-ops-upstream\thttps://github.com/santifer/career-ops.git (fetch)',
    'career-ops-upstream\thttps://github.com/santifer/career-ops.git (push)',
  ].join('\n');
  assert.deepEqual(upstreamRemoteOps(reconciled), []);
  // Private repo already claimed origin: nothing to reconcile.
  const privateOrigin = [
    'origin\thttps://github.com/morgan/career-ops-private.git (fetch)',
    'origin\thttps://github.com/morgan/career-ops-private.git (push)',
  ].join('\n');
  assert.deepEqual(upstreamRemoteOps(privateOrigin), []);
  assert.deepEqual(upstreamRemoteOps(''), []);
});

test('recipient masking hides the local part even for unusually short addresses', () => {
  assert.equal(maskRecipient('morgan@example.com'), 'mo***@example.com');
  assert.equal(maskRecipient('a@b.co'), 'a***@b.co'); // previously leaked in full
  assert.equal(maskRecipient('ab@b.co'), 'a***@b.co');
  assert.equal(maskRecipient('not-an-email'), '');
  assert.equal(maskRecipient(''), '');
});

test('mutation origin check rejects absent, mismatched and malformed origins', () => {
  assert.equal(mutationOriginAllowed('https://setup.codespace.dev', 'setup.codespace.dev'), true);
  assert.equal(mutationOriginAllowed(undefined, 'setup.codespace.dev'), false); // absent -> reject (previously allowed)
  assert.equal(mutationOriginAllowed('https://evil.example', 'setup.codespace.dev'), false);
  assert.equal(mutationOriginAllowed('not-a-url', 'setup.codespace.dev'), false);
  assert.equal(mutationOriginAllowed('https://setup.codespace.dev', undefined), false);
});

test('browser setup hardens cross-origin mutations, masks recipients and frees the origin remote', async () => {
  const server = await readFile(new URL('../browser-setup/server.mjs', import.meta.url), 'utf8');
  assert.match(server, /mutationOriginAllowed\(request\.headers\.origin, request\.headers\.host\)/);
  assert.match(server, /maskRecipient\(to\)/);
  // the old "if (origin && ...)" implicit-allow must be gone
  assert.doesNotMatch(server, /if \(origin && new URL\(origin\)\.host !== host\)/);
  // a stale `origin` is cleared before `gh repo create` claims the name
  assert.match(server, /'remote', 'remove', 'origin'/);
});

test('browser setup recovers from a slow-starting service and bounds workflow polling', async () => {
  const app = await readFile(new URL('../browser-setup/app.js', import.meta.url), 'utf8');
  const html = await readFile(new URL('../browser-setup/index.html', import.meta.url), 'utf8');
  assert.match(app, /apiWithRetry/);
  assert.match(app, /startBoot\(\)/);
  assert.match(app, /showBootRetry/);
  assert.match(html, /id="boot-retry"/);
  // a stalled GitHub run must not lock the check button forever
  assert.match(app, /15 \* 60_000/);
});

test('browser assets expose eight stages and a private Codespaces port', async () => {
  const html = await readFile(new URL('../browser-setup/index.html', import.meta.url), 'utf8');
  const script = await readFile(new URL('../browser-setup/app.js', import.meta.url), 'utf8');
  const devcontainer = JSON.parse(await readFile(new URL('../.devcontainer/devcontainer.json', import.meta.url), 'utf8'));
  assert.equal((html.match(/data-stage="\d"/g) || []).length, 8);
  assert.match(html, /No VS Code/);
  assert.match(html, /reduced-coverage examples/i);
  assert.doesNotMatch(script, /localStorage|sessionStorage/);
  assert.equal(devcontainer.portsAttributes['4173'].visibility, 'private');
  assert.equal(devcontainer.portsAttributes['4173'].onAutoForward, 'openBrowser');
});

test('scheduled workflow remains disabled until Browser Setup activates it', async () => {
  const workflow = await readFile(new URL('../examples/career-intelligence.scheduled.yml', import.meta.url), 'utf8');
  assert.match(workflow, /CAREER_DIGEST_ENABLED/);
  assert.match(workflow, /workflow_dispatch/);
});

test('browser setup pins a real Career Ops release and gates activation on both cloud checks', async () => {
  const server = await readFile(new URL('../browser-setup/server.mjs', import.meta.url), 'utf8');
  const script = await readFile(new URL('../browser-setup/app.js', import.meta.url), 'utf8');
  assert.equal(SUPPORTED_CAREER_OPS_TAG, 'career-ops-v1.23.0');
  assert.match(server, /checks\.completed\['guard-only'\]/);
  assert.match(server, /checks\.completed\['structured-only'\]/);
  assert.match(server, /Both cloud checks must finish successfully/);
  assert.match(server, /'package-lock\.json'/);
  assert.match(server, /extensions\/career-intelligence-workflow\/package-lock\.json/);
  assert.match(script, /Wait for both cloud checks to pass/);
});
