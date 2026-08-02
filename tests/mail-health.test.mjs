import assert from 'node:assert/strict';
import test from 'node:test';

import {
  sendMailTest,
  validateMailConfiguration,
  verifyReceivingKey,
} from '../src/mail-health.mjs';

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    text: async () => JSON.stringify(body),
  };
}

test('requires the receiving key only when inbound alerts are enabled', () => {
  const result = validateMailConfiguration({
    from: 'Digest <jobs@example.com>',
    to: 'person@example.com',
    sendingKey: 'send-only',
    receivingKey: '',
    receivingEnabled: true,
  });
  assert.match(result.failures.join(' '), /RESEND_RECEIVING_API_KEY/);
  const separate = validateMailConfiguration({
    from: 'Digest <jobs@example.com>',
    to: 'person@example.com',
    sendingKey: 'send-only',
    receivingKey: 'full-access',
    receivingEnabled: true,
  });
  assert.equal(separate.failures.length, 0);
  assert.equal(separate.warnings.length, 0);
});

test('checks receiving access and sends an explicitly requested test', async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    if (url.includes('/receiving')) return response(200, { data: [] });
    return response(200, { id: 'email_test_123' });
  };
  assert.deepEqual(await verifyReceivingKey('receive-key', fetchImpl), { ok: true, listed: 0 });
  assert.deepEqual(await sendMailTest({
    apiKey: 'send-key',
    from: 'Digest <jobs@example.com>',
    to: 'person@example.com',
    fetchImpl,
  }), { id: 'email_test_123' });
  assert.match(calls[0].init.headers.authorization, /receive-key/);
  assert.match(calls[1].init.headers.authorization, /send-key/);
  assert.ok(calls[1].init.headers['idempotency-key']);
});

test('fails closed when Resend rejects a request', async () => {
  await assert.rejects(
    verifyReceivingKey('bad-key', async () => response(401, { message: 'invalid key' })),
    /401.*invalid key/,
  );
  await assert.rejects(
    sendMailTest({
      apiKey: 'send-key',
      from: 'Digest <jobs@example.com>',
      to: 'person@example.com',
      fetchImpl: async () => response(409, { message: 'conflict' }),
    }),
    /409.*conflict/,
  );
});
