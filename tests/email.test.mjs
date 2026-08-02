import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

process.env.CAREER_INTELLIGENCE_CONFIG = fileURLToPath(
  new URL('../config/profile.example.yml', import.meta.url),
);

const { buildDigest, sendDigest } = await import('../src/email.mjs');
const { deliveryKeyFor } = await import('../src/run.mjs');

const smartReport = {
  generatedAt: '2026-07-30T20:00:00.000Z',
  mode: 'smart',
  scanSummary: 'Career Ops discovery completed.',
  coverage: { completeness: 'complete', summary: 'All configured lanes completed.', warnings: [] },
  recommended: [{
    url: 'https://example.com/1',
    company: 'Example <script>',
    title: 'Customer Success Specialist',
    location: 'Dublin, Ireland',
    why: 'The complete description matches the target responsibilities.',
    cautions: '',
    postedAt: '2026-07-30T18:00:00.000Z',
  }],
  possible: [],
  other: [],
};

test('namespaces stable delivery keys by repository and slot', () => {
  const first = deliveryKeyFor('2026-07-30-evening', 'example/career-ops');
  assert.equal(first, deliveryKeyFor('2026-07-30-evening', 'example/career-ops'));
  assert.notEqual(first, deliveryKeyFor('2026-07-30-morning', 'example/career-ops'));
  assert.notEqual(first, deliveryKeyFor('2026-07-30-evening', 'another/career-ops'));
});

test('renders safe Smart Digest HTML', () => {
  const digest = buildDigest(smartReport);
  assert.match(digest.subject, /Smart Digest: 1 new job, 1 recommended/);
  assert.doesNotMatch(digest.html, /Example <script>/);
  assert.match(digest.html, /Example &lt;script&gt;/);
  assert.match(digest.text, /SMART COVERAGE COMPLETE/);
});

test('explains Discovery Digest reduced coverage with concrete examples', () => {
  const digest = buildDigest({
    ...smartReport,
    mode: 'discovery',
    recommended: [],
    other: smartReport.recommended,
    coverage: { completeness: 'reduced' },
  });
  assert.match(digest.subject, /reduced coverage/i);
  assert.match(digest.text, /ATS board reached by this run.*Greenhouse/i);
  assert.match(digest.text, /visible only in LinkedIn/i);
  assert.match(digest.text, /dynamic careers page/i);
});

test('treats every Resend 409 as an error, never as proof of delivery', async () => {
  const previous = {
    key: process.env.RESEND_API_KEY,
    from: process.env.CAREER_DIGEST_FROM,
    to: process.env.CAREER_DIGEST_TO,
  };
  process.env.RESEND_API_KEY = 'secret-test-key';
  process.env.CAREER_DIGEST_FROM = 'Career Ops <jobs@example.com>';
  process.env.CAREER_DIGEST_TO = 'candidate@example.com';
  try {
    await assert.rejects(
      sendDigest(smartReport, {
        idempotencyKey: 'career-digest/example/repository/2026-07-30-evening',
        fetchImpl: async () => ({
          ok: false,
          status: 409,
          text: async () => JSON.stringify({
            name: 'invalid_idempotent_request',
            message: 'Idempotency key already used with different parameters',
          }),
        }),
      }),
      /Resend rejected.*409/,
    );
  } finally {
    for (const [key, value] of Object.entries({
      RESEND_API_KEY: previous.key,
      CAREER_DIGEST_FROM: previous.from,
      CAREER_DIGEST_TO: previous.to,
    })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
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
  try {
    const result = await sendDigest(smartReport, {
      fetchImpl: async (url, options) => {
        captured = { url, options };
        return { ok: true, status: 200, text: async () => JSON.stringify({ id: 'email_123' }) };
      },
    });
    assert.equal(result.result.id, 'email_123');
    assert.equal(captured.url, 'https://api.resend.com/emails');
    assert.doesNotMatch(captured.options.body, /secret-test-key/);
  } finally {
    for (const [key, value] of Object.entries({
      RESEND_API_KEY: previous.key,
      CAREER_DIGEST_FROM: previous.from,
      CAREER_DIGEST_TO: previous.to,
    })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
