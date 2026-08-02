import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { parse } from 'yaml';

const workflowText = await readFile(new URL('../examples/career-intelligence.scheduled.yml', import.meta.url), 'utf8');
const workflow = parse(workflowText);

test('isolates both model providers from the clean delivery runner', () => {
  for (const name of ['smart_discovery', 'smart_evaluation']) {
    const job = workflow.jobs[name];
    assert.equal(job.permissions.contents, 'read');
    const checkout = job.steps.find((step) => step.uses === 'actions/checkout@v4');
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
});

test('persists the prepared payload before the Resend delivery step', () => {
  const steps = workflow.jobs.deliver.steps.map((step) => step.name || step.uses);
  const prepare = steps.indexOf('Prepare the exact email payload');
  const persist = steps.indexOf('Save the prepared payload before Resend');
  const deliver = steps.indexOf('Deliver only the saved payload');
  assert.ok(prepare >= 0 && persist > prepare && deliver > persist);
});

test('workflow exposes retries and non-technical lifecycle controls', () => {
  assert.equal(workflow.on.schedule.length, 6);
  assert.deepEqual(workflow.on.workflow_dispatch.inputs.mode.options, [
    'run', 'guard-only', 'pause', 'resume',
  ]);
  assert.match(workflowText, /lifecycle\.mjs check/);
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

test('runs the zero-token scanner independently of the optional agent jobs', () => {
  const bootstrap = workflow.jobs.bootstrap;
  const scan = bootstrap.steps.find((step) => step.name === 'Run zero-token structured feeds and rolling ATS discovery');
  assert.ok(scan);
  assert.match(scan.run, /run-structured-scan\.mjs/);
  assert.doesNotMatch(scan.if, /provider|agent/i);
  assert.match(workflowText, /CAREER_OPS_AGENT_ENABLED|mode == 'smart'/);
});
