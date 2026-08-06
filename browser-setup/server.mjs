#!/usr/bin/env node

import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { access, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { stringify } from 'yaml';

import { installIntoCareerOps } from '../bin/cli.mjs';
import { installWorkflow } from '../scripts/install-workflow.mjs';
import { provisionSources } from '../scripts/provision-sources.mjs';
import {
  assertPrivateWorkspacePath,
  applyBrowserSourcePlan,
  browserSetupPreview,
  containsSecret,
  maskRecipient,
  mutationOriginAllowed,
  payloadFingerprint,
  redactSecrets,
  upstreamRemoteOps,
  SUPPORTED_CAREER_OPS_TAG,
  validateBrowserSetupInput,
  writeBrowserProfileFiles,
} from '../src/browser-setup.mjs';
import { sourcePlanText } from '../src/source-packs.mjs';

const SOURCE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATIC_ROOT = path.join(SOURCE_ROOT, 'browser-setup');
const SETUP_ROOT = path.resolve(process.env.CAREER_INTELLIGENCE_SETUP_ROOT || path.join(SOURCE_ROOT, '.career-intelligence-setup'));
const WORKSPACE_ROOT = path.join(SETUP_ROOT, 'career-ops');
const CAREER_OPS_REPO = 'https://github.com/santifer/career-ops.git';
const CHECKS_PATH = path.join(SETUP_ROOT, 'checks.json');
const SESSION_TOKEN = randomBytes(24).toString('base64url');
const MAX_BODY_BYTES = 7_000_000;
const authState = { status: 'idle', output: '', startedAt: null };

function argumentValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const HOST = argumentValue('--host', '127.0.0.1');
const PORT = Number(argumentValue('--port', process.env.PORT || 4173));

async function exists(filePath) {
  try { await access(filePath); return true; } catch { return false; }
}

async function readChecks() {
  try {
    const value = JSON.parse(await readFile(CHECKS_PATH, 'utf8'));
    return {
      schemaVersion: 1,
      pending: value.pending && typeof value.pending === 'object' ? value.pending : {},
      completed: value.completed && typeof value.completed === 'object' ? value.completed : {},
    };
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    return { schemaVersion: 1, pending: {}, completed: {} };
  }
}

async function writeChecks(value) {
  await mkdir(SETUP_ROOT, { recursive: true });
  await writeFile(CHECKS_PATH, JSON.stringify(value, null, 2), 'utf8');
}

function executableName(command) {
  if (process.platform !== 'win32') return command;
  if (command === 'npx') return 'npx.cmd';
  return command;
}

function commandInvocation(command, args) {
  if (command !== 'npm' || process.platform !== 'win32') {
    return { executable: executableName(command), commandArgs: args };
  }
  const bundledNpmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  const npmCli = process.env.npm_execpath || (existsSync(bundledNpmCli) ? bundledNpmCli : '');
  if (!npmCli) throw new Error('npm is installed but its cross-platform launcher could not be located.');
  return { executable: process.execPath, commandArgs: [npmCli, ...args] };
}

function commandEnvironment(command, extra = {}) {
  const combined = { ...process.env, ...extra };
  if (command === 'gh' && process.env.CODESPACES && process.env.CAREER_INTELLIGENCE_USE_CODESPACE_TOKEN !== 'true') {
    delete combined.GH_TOKEN;
    delete combined.GITHUB_TOKEN;
  }
  return combined;
}

function run(command, args, {
  cwd = SOURCE_ROOT,
  input = '',
  env = {},
  allowFailure = false,
  sensitiveOutput = false,
} = {}) {
  return new Promise((resolve, reject) => {
    const { executable, commandArgs } = commandInvocation(command, args);
    const child = spawn(executable, commandArgs, {
      cwd,
      env: commandEnvironment(command, env),
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('exit', (code) => {
      const result = {
        code,
        stdout: sensitiveOutput ? stdout : redactSecrets(stdout),
        stderr: sensitiveOutput ? stderr : redactSecrets(stderr),
      };
      if (code === 0 || allowFailure) resolve(result);
      else reject(new Error(redactSecrets(stderr || stdout || `${command} exited with code ${code}.`)));
    });
    if (input) child.stdin.write(input);
    child.stdin.end();
  });
}

function json(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  });
  response.end(JSON.stringify(body));
}

function securityHeaders(response) {
  response.setHeader('content-security-policy', "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  response.setHeader('x-frame-options', 'DENY');
  response.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  response.setHeader('referrer-policy', 'no-referrer');
  response.setHeader('x-content-type-options', 'nosniff');
}

async function requestBody(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('The request is too large.');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function assertMutationRequest(request) {
  if (request.headers['x-setup-token'] !== SESSION_TOKEN) throw new Error('This setup session has expired. Refresh the page.');
  if (!mutationOriginAllowed(request.headers.origin, request.headers.host)) throw new Error('Cross-origin setup requests are not allowed.');
}

async function environmentStatus() {
  const gh = await run('gh', ['--version'], { allowFailure: true });
  const git = await run('git', ['--version'], { allowFailure: true });
  const auth = gh.code === 0 ? await run('gh', ['auth', 'status', '--hostname', 'github.com'], { allowFailure: true }) : { code: 1 };
  let deployment = { repositoryPublished: false, emailConfigured: false, scheduleActive: false };
  const repositoryPath = path.join(SETUP_ROOT, 'repository.json');
  if (auth.code === 0 && await exists(repositoryPath)) {
    try {
      const repository = JSON.parse(await readFile(repositoryPath, 'utf8'));
      const verified = JSON.parse((await run('gh', ['repo', 'view', repository.nameWithOwner, '--json', 'visibility,nameWithOwner,url'])).stdout);
      if (verified.visibility === 'PRIVATE') {
        const secrets = JSON.parse((await run('gh', ['secret', 'list', '--repo', verified.nameWithOwner, '--json', 'name'])).stdout);
        const variables = JSON.parse((await run('gh', ['variable', 'list', '--repo', verified.nameWithOwner, '--json', 'name,value'])).stdout);
        const secretNames = new Set(secrets.map((item) => item.name));
        deployment = {
          repositoryPublished: true,
          repositoryUrl: verified.url,
          emailConfigured: ['RESEND_API_KEY', 'CAREER_DIGEST_FROM', 'CAREER_DIGEST_TO'].every((name) => secretNames.has(name)),
          scheduleActive: variables.some((item) => item.name === 'CAREER_DIGEST_ENABLED' && item.value === 'true'),
        };
      }
    } catch { /* resume status remains conservative */ }
  }
  const checks = await readChecks();
  return {
    node: process.version,
    gitAvailable: git.code === 0,
    githubCliAvailable: gh.code === 0,
    githubAuthenticated: auth.code === 0,
    codespace: Boolean(process.env.CODESPACES),
    workspacePrepared: await exists(path.join(WORKSPACE_ROOT, 'extensions', 'career-intelligence-workflow')),
    supportedCareerOpsTag: SUPPORTED_CAREER_OPS_TAG,
    completedChecks: Object.keys(checks.completed),
    pendingChecks: Object.keys(checks.pending),
    ...deployment,
  };
}

async function cloneCareerOps() {
  await mkdir(SETUP_ROOT, { recursive: true });
  if (await exists(WORKSPACE_ROOT)) {
    const entries = await readdir(WORKSPACE_ROOT);
    if (entries.length) throw new Error('A prepared workspace already exists. Continue it or remove it from the reset control after reviewing it.');
  }
  await run('git', ['clone', '--depth=1', '--branch', SUPPORTED_CAREER_OPS_TAG, CAREER_OPS_REPO, WORKSPACE_ROOT], { cwd: SETUP_ROOT });
  await run('git', ['switch', '-c', 'main'], { cwd: WORKSPACE_ROOT });
  await run('npm', ['install', '--ignore-scripts'], { cwd: WORKSPACE_ROOT });
}

async function prepareWorkspace(raw) {
  const input = validateBrowserSetupInput(raw);
  try {
    await cloneCareerOps();
    const profileResult = await writeBrowserProfileFiles(WORKSPACE_ROOT, input);
    await installIntoCareerOps(WORKSPACE_ROOT, { sourceRoot: SOURCE_ROOT, skipDependencies: false });
    const extensionRoot = path.join(WORKSPACE_ROOT, 'extensions', 'career-intelligence-workflow');
    await writeFile(
      path.join(extensionRoot, 'config', 'profile.yml'),
      `# Confirmed in Browser Setup. Discovery uses zero model tokens.\n${stringify(profileResult.deployment, { lineWidth: 0 })}`,
      'utf8',
    );
    const sourceResult = await provisionSources({ extensionRoot, careerOpsRoot: WORKSPACE_ROOT, mergePortals: true, force: true });
    await writeFile(sourceResult.outputPath, sourcePlanText(applyBrowserSourcePlan(sourceResult.plan, input)), 'utf8');
    await installWorkflow(WORKSPACE_ROOT);
    await writeFile(path.join(SETUP_ROOT, 'prepared.json'), JSON.stringify({
      schemaVersion: 1,
      preparedAt: new Date().toISOString(),
      fingerprint: payloadFingerprint(input),
      repoName: input.repoName,
      selectedPlatforms: input.selectedPlatforms,
    }, null, 2), 'utf8');
    return {
      status: 'prepared',
      workspace: WORKSPACE_ROOT,
      mode: 'discovery',
      modelTokens: 0,
      repoName: input.repoName,
      selectedPlatforms: input.selectedPlatforms,
    };
  } catch (error) {
    if (await exists(WORKSPACE_ROOT)) await rm(WORKSPACE_ROOT, { recursive: true, force: true });
    throw error;
  }
}

async function resetPreparedWorkspace() {
  if (!await exists(SETUP_ROOT)) return { status: 'already-empty' };
  if (await exists(path.join(SETUP_ROOT, 'repository.json'))) {
    throw new Error('The private repository has already been published. This local reset cannot delete or replace it.');
  }
  const resolved = path.resolve(SETUP_ROOT);
  const expected = path.join(SOURCE_ROOT, '.career-intelligence-setup');
  if (resolved !== expected && !process.env.CAREER_INTELLIGENCE_SETUP_ROOT) {
    throw new Error('Refusing to reset an unexpected directory.');
  }
  await rm(WORKSPACE_ROOT, { recursive: true, force: true });
  await rm(path.join(SETUP_ROOT, 'prepared.json'), { force: true });
  await rm(CHECKS_PATH, { force: true });
  return { status: 'reset' };
}

function startGitHubAuth() {
  if (authState.status === 'running') return authState;
  authState.status = 'running';
  authState.output = '';
  authState.startedAt = new Date().toISOString();
  const child = spawn(executableName('gh'), ['auth', 'login', '--hostname', 'github.com', '--git-protocol', 'https', '--web', '--skip-ssh-key'], {
    cwd: SOURCE_ROOT,
    env: commandEnvironment('gh', { BROWSER: 'echo' }),
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const capture = (chunk) => {
    authState.output = redactSecrets(`${authState.output}${chunk}`).slice(-6000);
  };
  child.stdout.on('data', capture);
  child.stderr.on('data', capture);
  child.on('error', (error) => { authState.status = 'failed'; authState.output = redactSecrets(error.message); });
  child.on('exit', (code) => { authState.status = code === 0 ? 'connected' : 'failed'; });
  return authState;
}

async function githubIdentity() {
  const result = await run('gh', ['api', 'user', '--jq', '{login: .login, id: .id}']);
  return JSON.parse(result.stdout);
}

async function remoteInfo(workspace) {
  const remotes = await run('git', ['remote', '-v'], { cwd: workspace, allowFailure: true });
  return remotes.stdout;
}

async function publishPrivateWorkspace(raw) {
  const workspace = await assertPrivateWorkspacePath(WORKSPACE_ROOT, SETUP_ROOT);
  const repoName = String(raw.repoName || '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
  if (!repoName) throw new Error('Choose a private repository name.');
  const auth = await run('gh', ['auth', 'status', '--hostname', 'github.com'], { allowFailure: true });
  if (auth.code !== 0) throw new Error('GitHub is not connected yet. Use the browser sign-in first.');
  const identity = await githubIdentity();
  const remotes = await remoteInfo(workspace);
  for (const args of upstreamRemoteOps(remotes)) {
    await run('git', args, { cwd: workspace });
  }
  await run('git', ['config', 'user.name', identity.login], { cwd: workspace });
  await run('git', ['config', 'user.email', `${identity.id}+${identity.login}@users.noreply.github.com`], { cwd: workspace });
  await run('git', ['add', '-A'], { cwd: workspace });
  const requiredGeneratedFiles = [
    'package-lock.json',
    'config/profile.yml',
    'cv.md',
    'portals.yml',
    'extensions/career-intelligence-workflow/package-lock.json',
    'extensions/career-intelligence-workflow/config/profile.yml',
    'extensions/career-intelligence-workflow/config/sources.yml',
  ];
  await run('git', ['add', '-f', ...requiredGeneratedFiles], { cwd: workspace });
  const staged = await run('git', ['diff', '--cached', '--no-ext-diff', '--unified=0'], { cwd: workspace, sensitiveOutput: true });
  if (containsSecret(staged.stdout)) throw new Error('A credential-like value was found in staged files. Nothing was published.');
  const changed = await run('git', ['diff', '--cached', '--quiet'], { cwd: workspace, allowFailure: true });
  if (changed.code !== 0) await run('git', ['commit', '-m', 'Set up private Career Intelligence workspace'], { cwd: workspace });

  const existing = await run('gh', ['repo', 'view', `${identity.login}/${repoName}`, '--json', 'visibility,nameWithOwner,url'], { allowFailure: true });
  let repository;
  if (existing.code === 0) {
    repository = JSON.parse(existing.stdout);
    if (repository.visibility !== 'PRIVATE') throw new Error('The chosen repository already exists and is not private. Choose another name.');
    if (!/^origin\s+/m.test(await remoteInfo(workspace))) {
      await run('git', ['remote', 'add', 'origin', `https://github.com/${repository.nameWithOwner}.git`], { cwd: workspace });
    }
    await run('git', ['push', '-u', 'origin', 'HEAD'], { cwd: workspace });
  } else {
    if (/^origin\s+/m.test(await remoteInfo(workspace))) {
      await run('git', ['remote', 'remove', 'origin'], { cwd: workspace });
    }
    const created = await run('gh', ['repo', 'create', repoName, '--private', '--source', workspace, '--remote', 'origin', '--push']);
    const urlMatch = created.stdout.match(/https:\/\/github\.com\/[^\s]+/);
    repository = {
      nameWithOwner: `${identity.login}/${repoName}`,
      url: urlMatch?.[0] || `https://github.com/${identity.login}/${repoName}`,
      visibility: 'PRIVATE',
    };
  }
  const verified = JSON.parse((await run('gh', ['repo', 'view', repository.nameWithOwner, '--json', 'visibility,nameWithOwner,url'])).stdout);
  if (verified.visibility !== 'PRIVATE') throw new Error('GitHub did not report the deployment repository as private.');
  await run('gh', ['variable', 'set', 'CAREER_DIGEST_ENABLED', '--body', 'false', '--repo', verified.nameWithOwner]);
  await writeFile(path.join(SETUP_ROOT, 'repository.json'), JSON.stringify({
    nameWithOwner: verified.nameWithOwner,
    url: verified.url,
    verifiedPrivateAt: new Date().toISOString(),
  }, null, 2), 'utf8');
  return { status: 'published-private', repository: verified };
}

async function repositoryRecord() {
  const recordPath = path.join(SETUP_ROOT, 'repository.json');
  if (!await exists(recordPath)) throw new Error('Publish the private repository first.');
  return JSON.parse(await readFile(recordPath, 'utf8'));
}

async function setGitHubSecret(repo, name, value) {
  if (!value) throw new Error(`${name} is required.`);
  await run('gh', ['secret', 'set', name, '--repo', repo], { input: `${value}\n` });
}

async function configureResend(raw) {
  const repository = await repositoryRecord();
  const apiKey = String(raw.apiKey || '').trim();
  const from = String(raw.from || '').trim();
  const to = String(raw.to || '').trim();
  if (!/^re_[A-Za-z0-9_-]{20,}$/.test(apiKey)) throw new Error('The Resend key format does not look valid.');
  if (!/^.+<[^\s@]+@[^\s@]+\.[^\s@]+>$/.test(from) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)) {
    throw new Error('Enter a valid sender, such as Career Intelligence <onboarding@resend.dev>.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error('Enter a valid recipient email.');
  await setGitHubSecret(repository.nameWithOwner, 'RESEND_API_KEY', apiKey);
  await setGitHubSecret(repository.nameWithOwner, 'CAREER_DIGEST_FROM', from);
  await setGitHubSecret(repository.nameWithOwner, 'CAREER_DIGEST_TO', to);
  let test = { sent: false };
  if (raw.sendTest === true) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        'idempotency-key': `career-intelligence-setup-${repository.nameWithOwner.replace('/', '-')}`,
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: 'Career Intelligence email check',
        text: 'Your private Career Intelligence workspace can send email. No job scan was run for this test.',
      }),
    });
    if (!response.ok) {
      const message = redactSecrets((await response.text()).slice(0, 1000));
      throw new Error(`Resend rejected the test email (${response.status}): ${message}`);
    }
    test = { sent: true, accepted: true };
  }
  return { status: 'email-configured', recipient: maskRecipient(to), test };
}

async function listWorkflowRuns(repository) {
  const result = await run('gh', [
    'run', 'list', '--repo', repository.nameWithOwner,
    '--workflow', 'career-intelligence.yml', '--event', 'workflow_dispatch', '--limit', '20',
    '--json', 'databaseId,status,conclusion,url,createdAt',
  ]);
  return JSON.parse(result.stdout);
}

async function locatePendingRun(repository, pending) {
  if (pending.runId) return pending.runId;
  const runs = await listWorkflowRuns(repository);
  const earlier = new Set((pending.beforeIds || []).map(String));
  const earliest = new Date(pending.triggeredAt).getTime() - 5_000;
  const match = runs.find((item) => !earlier.has(String(item.databaseId)) && new Date(item.createdAt).getTime() >= earliest);
  return match?.databaseId || null;
}

async function triggerWorkflow(mode) {
  if (!['guard-only', 'structured-only', 'run'].includes(mode)) throw new Error('Unsupported workflow mode.');
  const repository = await repositoryRecord();
  if (mode === 'run') {
    await run('gh', ['workflow', 'run', 'career-intelligence.yml', '--repo', repository.nameWithOwner, '-f', `mode=${mode}`]);
    return {
      status: 'triggered',
      mode,
      actionsUrl: `${repository.url}/actions/workflows/career-intelligence.yml`,
    };
  }

  const checks = await readChecks();
  if (checks.completed[mode]) {
    return { status: 'completed', conclusion: 'success', mode, runId: checks.completed[mode].runId, actionsUrl: checks.completed[mode].url };
  }
  if (mode === 'structured-only' && !checks.completed['guard-only']) {
    throw new Error('Run the guard-only safety check successfully before the no-email scan.');
  }

  let pending = checks.pending[mode];
  const pendingAge = pending ? Date.now() - new Date(pending.triggeredAt).getTime() : 0;
  if (pending?.conclusion || (pending && !pending.runId && pendingAge > 5 * 60_000)) {
    delete checks.pending[mode];
    await writeChecks(checks);
    pending = null;
  }
  if (pending) {
    const runId = await locatePendingRun(repository, pending);
    if (runId) {
      pending.runId = runId;
      await writeChecks(checks);
    }
    return {
      status: 'pending',
      mode,
      runId,
      actionsUrl: runId ? `${repository.url}/actions/runs/${runId}` : `${repository.url}/actions/workflows/career-intelligence.yml`,
    };
  }

  const before = await listWorkflowRuns(repository);
  checks.pending[mode] = {
    triggeredAt: new Date().toISOString(),
    beforeIds: before.map((item) => item.databaseId),
  };
  await writeChecks(checks);
  try {
    await run('gh', ['workflow', 'run', 'career-intelligence.yml', '--repo', repository.nameWithOwner, '-f', `mode=${mode}`]);
  } catch (error) {
    delete checks.pending[mode];
    await writeChecks(checks);
    throw error;
  }
  return {
    status: 'triggered',
    mode,
    actionsUrl: `${repository.url}/actions/workflows/career-intelligence.yml`,
  };
}

async function workflowStatus(raw) {
  const mode = String(raw.mode || '');
  if (!['guard-only', 'structured-only'].includes(mode)) throw new Error('Unsupported check mode.');
  const repository = await repositoryRecord();
  const checks = await readChecks();
  if (checks.completed[mode]) {
    return { status: 'completed', conclusion: 'success', mode, ...checks.completed[mode] };
  }
  const pending = checks.pending[mode];
  if (!pending) return { status: 'not-started', mode };
  const runId = await locatePendingRun(repository, pending);
  if (!runId) {
    return { status: 'locating', mode, actionsUrl: `${repository.url}/actions/workflows/career-intelligence.yml` };
  }
  pending.runId = runId;
  const runInfo = JSON.parse((await run('gh', [
    'run', 'view', String(runId), '--repo', repository.nameWithOwner,
    '--json', 'databaseId,status,conclusion,url,workflowName,event',
  ])).stdout);
  if (runInfo.event !== 'workflow_dispatch') throw new Error('The located check was not a manual setup run.');
  if (runInfo.status === 'completed') {
    if (runInfo.conclusion === 'success') {
      checks.completed[mode] = { runId, url: runInfo.url, completedAt: new Date().toISOString() };
      delete checks.pending[mode];
    } else {
      checks.pending[mode] = { ...pending, failedAt: new Date().toISOString(), conclusion: runInfo.conclusion };
    }
  }
  await writeChecks(checks);
  return {
    status: runInfo.status,
    conclusion: runInfo.conclusion,
    mode,
    runId,
    actionsUrl: runInfo.url,
  };
}

async function activateSchedule() {
  const repository = await repositoryRecord();
  const checks = await readChecks();
  if (!checks.completed['guard-only'] || !checks.completed['structured-only']) {
    throw new Error('Both cloud checks must finish successfully before the schedule can be activated.');
  }
  await run('gh', ['variable', 'set', 'CAREER_DIGEST_ENABLED', '--body', 'true', '--repo', repository.nameWithOwner]);
  return { status: 'active', repository: repository.nameWithOwner };
}

async function extractCv(raw) {
  const name = String(raw.name || '').slice(0, 200);
  const type = String(raw.type || '').toLowerCase();
  const encoded = String(raw.dataBase64 || '');
  const buffer = Buffer.from(encoded, 'base64');
  if (!buffer.length || buffer.length > 5_000_000) throw new Error('Choose a CV file smaller than 5 MB.');
  if (type.includes('text') || /\.(?:txt|md)$/i.test(name)) return { text: buffer.toString('utf8').slice(0, 600_000) };
  if (type.includes('pdf') || /\.pdf$/i.test(name)) {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 30); pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => item.str).join(' '));
    }
    return { text: pages.join('\n\n').trim().slice(0, 600_000) };
  }
  if (type.includes('word') || /\.docx$/i.test(name)) {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return { text: result.value.trim().slice(0, 600_000) };
  }
  throw new Error('Use a PDF, DOCX, TXT or Markdown CV.');
}

const routes = new Map([
  ['GET /api/session', async () => ({ token: SESSION_TOKEN })],
  ['GET /api/status', environmentStatus],
  ['GET /api/github/auth/status', async () => ({ ...authState, output: redactSecrets(authState.output) })],
  ['POST /api/github/auth/start', async () => startGitHubAuth()],
  ['POST /api/setup/preview', browserSetupPreview],
  ['POST /api/setup/prepare', prepareWorkspace],
  ['POST /api/setup/reset', resetPreparedWorkspace],
  ['POST /api/setup/extract-cv', extractCv],
  ['POST /api/github/publish', publishPrivateWorkspace],
  ['POST /api/resend/configure', configureResend],
  ['POST /api/workflow/run', async (raw) => triggerWorkflow(raw.mode)],
  ['POST /api/workflow/status', workflowStatus],
  ['POST /api/workflow/activate', activateSchedule],
]);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

async function serveStatic(request, response) {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const candidate = path.resolve(STATIC_ROOT, relative);
  if (!candidate.startsWith(`${STATIC_ROOT}${path.sep}`)) return false;
  try {
    const info = await stat(candidate);
    if (!info.isFile()) return false;
    securityHeaders(response);
    response.writeHead(200, {
      'content-type': mimeTypes[path.extname(candidate)] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    response.end(await readFile(candidate));
    return true;
  } catch {
    return false;
  }
}

const server = http.createServer(async (request, response) => {
  securityHeaders(response);
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const route = routes.get(`${request.method} ${url.pathname}`);
    if (route) {
      if (request.method !== 'GET') assertMutationRequest(request);
      const body = request.method === 'GET' ? {} : await requestBody(request);
      const result = await route(body);
      return json(response, 200, result);
    }
    if (request.method === 'GET' && await serveStatic(request, response)) return;
    return json(response, 404, { error: 'Not found.' });
  } catch (error) {
    return json(response, 400, { error: redactSecrets(error?.message || String(error)) });
  }
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`Career Intelligence Browser Setup is ready at http://${HOST}:${PORT}\n`);
  process.stdout.write('This setup service does not log form values or credentials.\n');
});
