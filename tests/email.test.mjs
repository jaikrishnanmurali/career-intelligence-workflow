import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDigest, sendDigest } from '../src/email.mjs';

const report = {
  generatedAt: '2026-07-30T20:00:00.000Z',
  scanSummary: 'Broad zero-token scan completed.',
  rejectedCount: 2,
  sourceFailureCount: 0,
  recommendations: [{
    url: 'https://example.com/1',
    company: 'Example <script>',
    title: 'Product Marketing Specialist',
    location: 'Stockholm, Sweden',
    fit: 'Priority',
    why: 'Product marketing match.',
    cautions: '',
    freshness: 'verified',
    postedAt: '2026-07-30T18:00:00.000Z',
    postedAtEvidence: 'Official timestamp',
  }],
};

test('renders safe HTML and freshness evidence', () => {
  const digest = buildDigest(report);
  assert.match(digest.subject, /1 new recommendation/);
  assert.doesNotMatch(digest.html, /Example <script>/);
  assert.match(digest.html, /Example &lt;script&gt;/);
  assert.match(digest.text, /Verified fresh/);
});

test('sends through Resend without putting the API key in the payload', async () => {
  const previous = {
    key: process.env.RESEND_API_KEY,
    from: process.env.CAREER_DIGEST_FROM,
    to: process.env.CAREER_DIGEST_TO,
  };
  process.env.RESEND_API_KEY = 'secret-test-key';
  process.env.CAREER_DIGEST_FROM = 'Career Ops <jobs@example.com>';
  process.env.CAREER_DIGEST_TO = 'candidate@example.com';
  let captured;
  const fetchImpl = async (url, options) => {
    captured = { url, options };
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: 'email_123' }),
    };
  };
  try {
    const result = await sendDigest(report, fetchImpl);
    assert.equal(result.result.id, 'email_123');
    assert.equal(captured.url, 'https://api.resend.com/emails');
    assert.doesNotMatch(captured.options.body, /secret-test-key/);
  } finally {
    for (const [key, value] of Object.entries({
      RESEND_API_KEY: previous.key,
      CAREER_DIGEST_FROM: previous.from,
      CAREER_DIGEST_TO: previous.to,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

