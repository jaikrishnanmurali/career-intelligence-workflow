#!/usr/bin/env node

import { realpathSync } from 'node:fs';
import {
  access,
  cp,
  mkdir,
  readFile,
  rename,
  rm,
} from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { integrateCareerOps } from '../scripts/integrate-career-ops.mjs';
import { supportedCareerOpsVersion } from '../src/career-ops.mjs';
import { importCareerOpsProfile } from '../scripts/import-career-ops-profile.mjs';
import { provisionSources } from '../scripts/provision-sources.mjs';

const SOURCE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXTENSION_NAME = 'career-intelligence-workflow';
const DISTRIBUTION_ENTRIES = [
  '.agents/skills',
  '.claude/skills',
  '.env.example',
  'AGENTS.md',
  'CLAUDE.md',
  'LICENSE',
  'README.md',
  'ROADMAP.md',
  'SECURITY.md',
  'bin',
  'config/profile.example.yml',
  'config/source-packs.example.yml',
  'docs',
  'examples',
  'integrations',
  'modes',
  'package.json',
  'reports/latest.example.json',
  'schemas',
  'scripts',
  'src',
  'state/state.example.json',
  'tests',
];

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function runCommand(command, args, cwd) {
  let executable = command;
  let commandArgs = args;
  if (command === 'npm') {
    const bundledNpmCli = path.join(
      path.dirname(process.execPath),
      'node_modules',
      'npm',
      'bin',
      'npm-cli.js',
    );
    const npmCli = process.env.npm_execpath
      || (await exists(bundledNpmCli) ? bundledNpmCli : '');
    if (npmCli) {
      executable = process.execPath;
      commandArgs = [npmCli, ...args];
    } else if (process.platform === 'win32') {
      executable = 'npm.cmd';
    }
  }
  return new Promise((resolve, reject) => {
    const child = spawn(executable, commandArgs, {
      cwd,
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}.`));
    });
  });
}

export async function validateCareerOpsWorkspace(careerOpsRoot) {
  const root = path.resolve(careerOpsRoot);
  if (!await exists(path.join(root, 'package.json')) || !await exists(path.join(root, 'AGENTS.md'))) {
    throw new Error(
      `Career Ops was not found at ${root}. Run "npx @santifer/career-ops init", `
      + 'enter the new career-ops folder, complete its chat onboarding, then run this setup command again.',
    );
  }

  const required = [
    'AGENTS.md',
    'modes/scan.md',
    'scan.mjs',
    'portals.yml',
    'fingerprint-core.mjs',
    'config/profile.yml',
    'cv.md',
    'package.json',
  ];
  for (const relativePath of required) {
    if (!await exists(path.join(root, relativePath))) {
      throw new Error(
        `Career Ops is not fully onboarded: ${relativePath} is missing from ${root}. Complete Career Ops setup first.`,
      );
    }
  }
  const packageJsonText = await readFile(path.join(root, 'package.json'), 'utf8');
  const packageJson = JSON.parse(packageJsonText.replace(/^\uFEFF/, ''));
  if (packageJson.name !== 'career-ops') {
    throw new Error(`Expected a Career Ops workspace at ${root}; package name is ${packageJson.name || 'missing'}.`);
  }
  if (!supportedCareerOpsVersion(packageJson.version)) {
    throw new Error(
      `Career Ops ${packageJson.version || 'unknown'} is not supported. This release requires the validated >=1.22.0 and <1.25.0 contract.`,
    );
  }
  return { root, version: packageJson.version || 'unknown' };
}

async function copyDistribution(sourceRoot, destination) {
  await mkdir(destination, { recursive: false });
  for (const entry of DISTRIBUTION_ENTRIES) {
    const source = path.join(sourceRoot, ...entry.split('/'));
    if (!await exists(source)) {
      throw new Error(`Installer package is incomplete: ${entry} is missing.`);
    }
    const target = path.join(destination, ...entry.split('/'));
    await mkdir(path.dirname(target), { recursive: true });
    await cp(source, target, { recursive: true, errorOnExist: true, force: false });
  }
  const gitIgnoreSource = await exists(path.join(sourceRoot, '.gitignore'))
    ? path.join(sourceRoot, '.gitignore')
    : path.join(sourceRoot, '.npmignore');
  if (!await exists(gitIgnoreSource)) {
    throw new Error('Installer package is incomplete: privacy ignore rules are missing.');
  }
  await cp(gitIgnoreSource, path.join(destination, '.gitignore'), {
    errorOnExist: true,
  });
}

export async function installIntoCareerOps(careerOpsRoot, {
  sourceRoot = SOURCE_ROOT,
  skipDependencies = false,
} = {}) {
  const workspace = await validateCareerOpsWorkspace(careerOpsRoot);
  const extensionsRoot = path.join(workspace.root, 'extensions');
  const extensionRoot = path.join(extensionsRoot, EXTENSION_NAME);
  const stagingRoot = path.join(extensionsRoot, `.${EXTENSION_NAME}-installing`);
  if (await exists(extensionRoot)) {
    throw new Error(
      `${extensionRoot} already exists. The installer will not overwrite an active extension.`,
    );
  }
  if (await exists(stagingRoot)) {
    throw new Error(
      `${stagingRoot} is left from an interrupted installation. Remove it after reviewing its contents, then retry.`,
    );
  }

  await mkdir(extensionsRoot, { recursive: true });
  try {
    await copyDistribution(sourceRoot, stagingRoot);
    await importCareerOpsProfile(
      workspace.root,
      path.join(stagingRoot, 'config', 'profile.yml'),
    );
    await provisionSources({
      extensionRoot: stagingRoot,
      careerOpsRoot: workspace.root,
    });
    if (!skipDependencies) {
      await runCommand('npm', ['install', '--ignore-scripts'], stagingRoot);
    }
    await rename(stagingRoot, extensionRoot);
    try {
      await integrateCareerOps(workspace.root, { extensionRoot });
    } catch (error) {
      await rm(extensionRoot, { recursive: true, force: true });
      throw error;
    }
  } catch (error) {
    if (await exists(stagingRoot)) {
      await rm(stagingRoot, { recursive: true, force: true });
    }
    throw error;
  }
  return { ...workspace, extensionRoot };
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

function printHelp() {
  process.stdout.write([
    'Career Intelligence Workflow',
    '',
    'Usage:',
    '  career-intelligence-workflow setup [--root <career-ops-directory>]',
    '',
    'Setup requires the validated Career Ops >=1.22.0 and <1.25.0 contract with a completed profile and cv.md.',
    'It installs a namespaced extension. It does not send email or enable a schedule.',
    '',
  ].join('\n'));
}

function isExecutedDirectly() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  }
}

const isMain = isExecutedDirectly();

if (isMain) {
  const command = process.argv[2] || 'help';
  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
  } else if (command === 'setup' || command === 'init') {
    const root = path.resolve(argumentValue('--root') || process.cwd());
    installIntoCareerOps(root)
      .then((result) => {
        process.stdout.write([
          '',
          `Installed Career Intelligence for Career Ops ${result.version}.`,
          `Extension: ${result.extensionRoot}`,
          '',
          'Next:',
          '1. Open Codex or Claude from the Career Ops root.',
          '2. Say: "Set up my 12-hour Career Intelligence digest."',
          '3. Review the generated role, location, language and platform source plan.',
          '4. The agent will validate both scanners, email and optional platform alerts before enabling delivery.',
          '',
          'No email was sent and no recurring workflow was enabled.',
          '',
        ].join('\n'));
      })
      .catch((error) => {
        process.stderr.write(`Installation failed: ${error.message}\n`);
        process.exitCode = 1;
      });
  } else {
    process.stderr.write(`Unknown command: ${command}\n\n`);
    printHelp();
    process.exitCode = 1;
  }
}
