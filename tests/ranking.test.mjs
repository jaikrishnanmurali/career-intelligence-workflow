import assert from 'node:assert/strict';
import test from 'node:test';

import {
  familyFor,
  languageBlocker,
  locationFor,
  shortlistCandidates,
} from '../src/ranking.mjs';

const scanStartedAt = '2026-07-30T20:00:00.000Z';

test('uses configurable role families and locations', () => {
  const family = familyFor({
    title: 'Customer Education Specialist',
    description: 'Create training content and customer onboarding programmes.',
  });
  assert.equal(family.family.id, 'customer-education');
  assert.equal(locationFor('Example City, Example Country').group.id, 'home');
  assert.equal(locationFor('Remote, Europe').group.id, 'europe-remote');
});

test('blocks mandatory unsupported languages but keeps optional wording', () => {
  assert.equal(languageBlocker('Fluent German is required for this role.'), 'german');
  assert.equal(languageBlocker('German is helpful but not required.'), null);
});

test('keeps verified, likely and newly discovered freshness distinct', () => {
  const base = {
    company: 'Example',
    title: 'Customer Education Specialist',
    location: 'Example City',
    description: 'Training content and customer onboarding.',
    source: 'test',
  };
  const { candidates } = shortlistCandidates([
    { ...base, company: 'Verified Example', url: 'https://example.test/verified', postedAt: '2026-07-30T15:00:00.000Z', postingPrecision: 'exact' },
    { ...base, company: 'Likely Example', url: 'https://example.test/likely', postedAt: scanStartedAt, postingPrecision: 'relative', postedAtEvidence: 'Posted Today' },
    { ...base, company: 'New Example', url: 'https://example.test/new', postedAt: null, postingPrecision: 'unknown' },
    { ...base, company: 'Old Example', url: 'https://example.test/old', postedAt: '2026-07-30T07:00:00.000Z', postingPrecision: 'exact' },
  ], { seenUrls: {} }, scanStartedAt);
  assert.deepEqual(candidates.map((item) => item.freshness).sort(), ['likely', 'newly_discovered', 'verified']);
});

test('does not repeat an untimestamped role already saved as seen', () => {
  const url = 'https://example.test/existing';
  const result = shortlistCandidates([{
    url,
    company: 'Example',
    title: 'Partner Enablement Specialist',
    location: 'Example City',
    description: 'Partner onboarding and sales enablement.',
    source: 'test',
    postedAt: null,
  }], { seenUrls: { [url]: { firstSeenAt: '2026-07-29T20:00:00.000Z' } } }, scanStartedAt);
  assert.equal(result.candidates.length, 0);
});

test('deduplicates the same company, title and location across source URLs', () => {
  const base = {
    company: 'Example',
    title: 'Partner Enablement Specialist',
    location: 'Example City',
    description: 'Partner onboarding and sales enablement.',
    postedAt: scanStartedAt,
    postingPrecision: 'exact',
  };
  const result = shortlistCandidates([
    { ...base, source: 'feed', url: 'https://feed.example.test/jobs/42' },
    { ...base, source: 'ats', url: 'https://ats.example.test/jobs/42', description: `${base.description} Richer description.` },
  ], { seenUrls: {}, seenPostingKeys: {} }, scanStartedAt);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].source, 'ats');
});
