import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

process.env.CAREER_PROFILE_PATH = fileURLToPath(
  new URL('../config/profile.example.yml', import.meta.url),
);

const {
  experienceSignal,
  familyFor,
  languageBlocker,
  locationFor,
  shortlistCandidates,
} = await import('../src/ranking.mjs');

const scanStartedAt = '2026-07-30T20:00:00.000Z';

test('recognizes adjacent role titles and priority locations', () => {
  const family = familyFor({
    title: 'Partner Enablement Specialist',
    description: 'Support partner launches and sales enablement.',
  });
  assert.equal(family.family.id, 'product-partner-marketing');
  assert.equal(locationFor('Stockholm, Sweden').group.id, 'sweden');
  assert.equal(locationFor('Amsterdam, Netherlands').group.id, 'amsterdam');
});

test('treats mandatory local language wording as a hard blocker', () => {
  assert.equal(languageBlocker('Fluent Swedish is required for this role.'), 'swedish');
  assert.equal(languageBlocker('Swedish is helpful but not required.'), null);
});

test('keeps verified, likely, and newly discovered roles distinct', () => {
  const base = {
    company: 'Example',
    title: 'Product Marketing Specialist',
    location: 'Stockholm, Sweden',
    description: 'Positioning, messaging, and product launches.',
    source: 'test',
  };
  const { candidates } = shortlistCandidates([
    {
      ...base,
      url: 'https://example.com/verified',
      postedAt: '2026-07-30T15:00:00.000Z',
      postingPrecision: 'exact',
      postedAtEvidence: 'Exact source timestamp',
    },
    {
      ...base,
      url: 'https://example.com/likely',
      postedAt: scanStartedAt,
      postingPrecision: 'relative',
      postedAtEvidence: 'Workday says “Posted Today”',
    },
    {
      ...base,
      url: 'https://example.com/new',
      postedAt: null,
      postingPrecision: 'unknown',
    },
    {
      ...base,
      url: 'https://example.com/old',
      postedAt: '2026-07-30T07:00:00.000Z',
      postingPrecision: 'exact',
    },
  ], {
    seenUrls: {},
  }, scanStartedAt);

  assert.deepEqual(
    candidates.map((item) => item.freshness).sort(),
    ['likely', 'newly_discovered', 'verified'],
  );
});

test('does not repeat an untimestamped role already in saved state', () => {
  const url = 'https://example.com/existing';
  const result = shortlistCandidates([{
    url,
    company: 'Example',
    title: 'Growth Marketing Specialist',
    location: 'Vienna, Austria',
    description: 'Lifecycle, retention, and growth campaigns.',
    source: 'test',
    postedAt: null,
  }], {
    seenUrls: {
      [url]: { firstSeenAt: '2026-07-29T20:00:00.000Z' },
    },
  }, scanStartedAt);
  assert.equal(result.candidates.length, 0);
});



test('rejects country-specific non-EU remote roles and generic false positives', () => {
  assert.equal(locationFor('United States, Remote').eligible, false);
  assert.equal(locationFor('Worldwide / Europe Remote').eligible, true);
  assert.equal(familyFor({
    title: 'BI Specialist',
    description: 'Customer insights, market research, product launches, and sales enablement.',
  }), null);
});


test('recognizes common local-language requirement wording and removes weak manager roles', () => {
  assert.equal(languageBlocker('Du hast sehr gute Deutschkenntnisse.'), 'german');
  assert.equal(languageBlocker('Du talar flytande svenska.'), 'swedish');
  assert.equal(languageBlocker('Français et anglais professionnels niveau B2+.'), 'french');
  const result = shortlistCandidates([{
    url: 'https://example.com/manager',
    company: 'Example',
    title: 'Performance Marketing Manager',
    location: 'Munich, Germany',
    description: 'SEO and conversion campaigns.',
    postedAt: '2026-07-30T18:00:00.000Z',
    postingPrecision: 'exact',
    source: 'test',
  }], { seenUrls: {} }, scanStartedAt);
  assert.equal(result.candidates.length, 0);
});

test('frames experience requirements as core, adjacent, or stretch', () => {
  assert.deepEqual(
    experienceSignal('At least 5 years of relevant professional experience.'),
    { minimumYears: 5, band: 'core', penalty: 0, caution: '' },
  );
  const adjacent = experienceSignal('Minimum 6 years of product marketing experience.');
  assert.equal(adjacent.band, 'adjacent');
  assert.match(adjacent.caution, /within total experience/i);
  const stretch = experienceSignal('8+ years of growth marketing experience required.');
  assert.equal(stretch.band, 'stretch');
  assert.ok(stretch.penalty > adjacent.penalty);
});