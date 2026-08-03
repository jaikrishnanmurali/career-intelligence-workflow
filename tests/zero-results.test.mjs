import assert from 'node:assert/strict';
import test from 'node:test';

import { zeroResultsDeliveryDecision } from '../src/run.mjs';

test('zero results with confirmation off stays silent and terminal', () => {
  const decision = zeroResultsDeliveryDecision({ emailedCount: 0, confirmZeroResults: false });
  assert.equal(decision.status, 'no-recommendations');
  assert.equal(decision.deliverable, false);
  assert.equal(decision.sendConfirmation, false);
});

test('zero results with confirmation on prepares a confirmation email', () => {
  const decision = zeroResultsDeliveryDecision({ emailedCount: 0, confirmZeroResults: true });
  assert.equal(decision.status, 'prepared');
  assert.equal(decision.deliverable, true);
  assert.equal(decision.sendConfirmation, true);
});

test('non-zero results are unaffected by the confirmation flag', () => {
  for (const confirmZeroResults of [false, true]) {
    const decision = zeroResultsDeliveryDecision({ emailedCount: 3, confirmZeroResults });
    assert.equal(decision.status, 'prepared');
    assert.equal(decision.deliverable, true);
    assert.equal(decision.sendConfirmation, false);
  }
});

test('defaults to the silent zero-result behavior when arguments are missing', () => {
  const decision = zeroResultsDeliveryDecision();
  assert.equal(decision.status, 'no-recommendations');
  assert.equal(decision.deliverable, false);
});
