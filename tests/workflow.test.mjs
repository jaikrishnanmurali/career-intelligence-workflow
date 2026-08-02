import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { parse } from 'yaml';

const workflowText = await readFile(new URL('../examples/career-intelligence.scheduled.yml', import.meta.url), 'utf8');
const workflow = parse(workflowText);
const intakeText = await readFile(new URL('../examples/career-intelligence.intake.yml', import.meta.url), 'utf8');
const intake = parse(intakeText);
const maintenanceText = await readFile(new URL('../examples/career-intelligence.maintenance.yml', import.meta.url), 'utf8');
const maintenance = parse(maintenanceText);

test('isolates both model providers from the clean delivery runner', () => {
  for (const name of ['smart_discovery', 'smart_evaluation']) {
    const job = workflow.jobs[name];
    assert.equal(job.permissions.contents, 'read');
    const checkout = job.steps.find((step) => step.uses === 'actions/checkout@v6');
    assert.equal(checkout.with['persist-credentials'], false);
    const lastActiveKinds = job.steps.slice(-2).map((step) => step.uses);
    assert.deepEqual(lastActiveKinds, [
      'openai/codex-action@v1',
      'anthropics/claude-code-action@v1',
    ]);
  }
  assert.deepEqual(workflow.jobs.deliver.needs, ['bootstrap', 'apply_discovery', 'smart_evaluation']);
  assert.match(workflowText, /output-schema-file: extensions\/career-intelligence-workflow\/schemas\/discovery-result\.schema\.json/);
  assert.match(workflowText, /scripts\/apply-agent-result\.mjs discovery/);
  assert.equal(workflow.jobs.smart_discovery.steps.find((step) => step.id === 'codex').with['permission-profile'], ':read-only');
  assert.doesNotMatch(workflowText, /Bash\(node \*\)|sandbox_workspace_write/);
});

test('persists the prepared payload before the Resend delivery step', () => {
  const steps = workflow.jobs.deliver.steps.map((step) => step.name || step.uses);
  const prepare = steps.indexOf('Prepare the exact email payload');
  const persist = steps.indexOf('Save the prepared payload before Resend');
  const deliver = steps.indexOf('Deliver only the saved payload');
  assert.ok(prepare >= 0 && persist > prepare && deliver > persist);
});

test('workflow exposes retries and non-technical lifecycle controls', () => {
  assert.equal(workflow.on.schedule.length, 12);
  assert.deepEqual(workflow.on.workflow_dispatch.inputs.mode.options, [
    'run', 'structured-only', 'guard-only', 'pause', 'resume',
  ]);
  assert.match(workflowText, /lifecycle\.mjs check/);
  assert.match(workflow.jobs.deliver.if, /should_run == 'true' && needs\.bootstrap\.outputs\.delivery_enabled == 'true'/);
});

test('agent JSON schemas are strict bounded handoffs', async () => {
  const discovery = JSON.parse(await readFile(new URL('../schemas/discovery-result.schema.json', import.meta.url), 'utf8'));
  const evaluation = JSON.parse(await readFile(new URL('../schemas/evaluation-result.schema.json', import.meta.url), 'utf8'));
  assert.equal(discovery.additionalProperties, false);
  assert.equal(discovery.properties.discoveries.maxItems, 200);
  assert.equal(discovery.properties.discoveries.items.properties.description.maxLength, 4000);
  assert.equal(evaluation.additionalProperties, false);
  assert.equal(evaluation.properties.evaluations.items.properties.score.maximum, 5);
});

test('runs Career Ops first and the supplemental scanner independently of optional agent jobs', () => {
  const bootstrap = workflow.jobs.bootstrap;
  const names = bootstrap.steps.map((step) => step.name || step.uses);
  const official = names.indexOf('Run the official Career Ops structured scan');
  const supplemental = names.indexOf('Run supplemental zero-token feeds and rolling ATS discovery');
  assert.ok(official >= 0 && supplemental > official);
  assert.match(bootstrap.steps[official].run, /run-career-ops-scan\.mjs/);
  assert.match(bootstrap.steps[supplemental].run, /run-structured-scan\.mjs/);
  assert.doesNotMatch(bootstrap.steps[supplemental].if || '', /provider|agent/i);
  assert.match(workflowText, /CAREER_OPS_AGENT_ENABLED|mode == 'smart'/);
});

test('the structured scanner honors the guarded effective mode', async () => {
  const script = await readFile(new URL('../scripts/run-structured-scan.mjs', import.meta.url), 'utf8');
  assert.match(script, /CAREER_INTELLIGENCE_EFFECTIVE_MODE/);
  assert.match(script, /createCoveragePlan\(portalsText, \{ runId, mode: EFFECTIVE_MODE, sourcesText \}\)/);
  assert.match(script, /mode: EFFECTIVE_MODE/);
});

test('gates DST cron duplicates by the configured local clock before scanning', () => {
  assert.match(workflowText, /scripts\/time-window\.mjs/);
  assert.match(workflow.jobs.bootstrap.if, /needs\.clock\.outputs\.in_window == 'true'/);
  assert.equal(workflow.concurrency.group, 'career-ops-state-writer');
});

test('keeps alert intake and update checks separate from digest delivery', () => {
  assert.equal(intake.concurrency.group, 'career-ops-state-writer');
  assert.match(intake.jobs.intake.if, /CAREER_ALERT_INTAKE_ENABLED/);
  assert.match(intakeText, /RESEND_RECEIVING_API_KEY/);
  assert.match(intakeText, /poll-alerts\.mjs/);
  assert.doesNotMatch(intakeText, /RESEND_API_KEY|CAREER_DIGEST_TO/);
  assert.match(maintenanceText, /check-updates\.mjs/);
  assert.match(maintenanceText, /update available/);
  assert.doesNotMatch(maintenanceText, /update-system\.mjs apply|git merge|git pull/);
});

test('Smart discovery schema can preserve every deterministic source status', async () => {
  const discovery = JSON.parse(await readFile(new URL('../schemas/discovery-result.schema.json', import.meta.url), 'utf8'));
  const statuses = discovery.properties.sources.items.properties.status.enum;
  for (const status of ['completed_structured', 'completed_intake', 'not_configured', 'disabled_by_user']) {
    assert.ok(statuses.includes(status));
  }
});
