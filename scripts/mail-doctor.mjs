#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { INBOUND_ALERTS_ENABLED } from '../src/config.mjs';
import { sendMailTest, validateMailConfiguration, verifyReceivingKey } from '../src/mail-health.mjs';
import { loadLocalEnv } from '../src/util.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await loadLocalEnv(path.join(ROOT, '.env'));

const values = {
  from: process.env.CAREER_DIGEST_FROM,
  to: process.env.CAREER_DIGEST_TO,
  sendingKey: process.env.RESEND_API_KEY,
  receivingKey: process.env.RESEND_RECEIVING_API_KEY,
  receivingEnabled: INBOUND_ALERTS_ENABLED,
};
const check = validateMailConfiguration(values);
process.stdout.write('Career Intelligence mail doctor\n');
for (const warning of check.warnings) process.stdout.write(`WARNING: ${warning}\n`);
for (const failure of check.failures) process.stderr.write(`ERROR: ${failure}\n`);
if (check.failures.length) process.exit(1);

if (process.argv.includes('--live-receiving')) {
  if (!values.receivingKey) throw new Error('RESEND_RECEIVING_API_KEY is required for --live-receiving.');
  const result = await verifyReceivingKey(values.receivingKey);
  process.stdout.write(`Receiving API authenticated; ${result.listed} recent message reference${result.listed === 1 ? '' : 's'} returned.\n`);
}
if (process.argv.includes('--send-test')) {
  if (!process.argv.includes('--confirm-send')) {
    throw new Error('--send-test also requires --confirm-send because it sends a real email.');
  }
  const result = await sendMailTest({
    apiKey: values.sendingKey,
    from: values.from,
    to: values.to,
  });
  process.stdout.write(`Resend accepted the test email. Receipt: ${result.id}\n`);
} else {
  process.stdout.write('Configuration is present. No email was sent.\n');
}
