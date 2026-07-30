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
    title: 'Customer Onboarding Specialist',
    description: 'Support onboarding, adoption, and the customer journey.',
  });
  assert.equal(family.family.id, 'customer-success');
  assert.equal(locationFor('Dublin, Ireland').group.id, 'ireland');
  assert.equal(locationFor('Europe Remote').group.id, 'europe-remote');
});

test('treats mandatory local language wording as a hard blocker', () => {
  assert.equal(languageBlocker('Fluent German is required for this role.'), 'german');
  assert.equal(languageBlocker('German is helpful but not required.'), null);
});

test('keeps verified, likely, and newly discovered roles distinct', () => {
  const base = {
    company: 'Example',
    title: 'Customer Success Specialist',
    location: 'Dublin, Ireland',
    description: 'Customer onboarding, adoption, and retention.',
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
    title: 'Community Operations Specialist',
    location: 'Europe Remote',
    description: 'Member experience and community program delivery.',
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
  assert.equal(locationFor('United States only, Remote').eligible, false);
  assert.equal(locationFor('Worldwide / Europe Remote').eligible, true);
  assert.equal(familyFor({
    title: 'BI Specialist',
    description: 'Financial reporting and database maintenance.',
  }), null);
});


test('recognizes common local-language requirement wording and removes weak manager roles', () => {
  assert.equal(languageBlocker('Du hast sehr gute Deutschkenntnisse.'), 'german');
  assert.equal(languageBlocker('Français et anglais professionnels niveau B2+.'), 'french');
  const result = shortlistCandidates([{
    url: 'https://example.com/manager',
    company: 'Example',
    title: 'Community Operations Manager',
    location: 'Dublin, Ireland',
    description: 'Lead a team of 12, own hiring, and deliver community programs.',
    postedAt: '2026-07-30T18:00:00.000Z',
    postingPrecision: 'exact',
    source: 'test',
  }], { seenUrls: {} }, scanStartedAt);
  assert.equal(result.candidates.length, 0);
});

test('frames experience requirements as core, adjacent, or stretch', () => {
  assert.deepEqual(
    experienceSignal('At least 3 years of relevant professional experience.'),
    { minimumYears: 3, band: 'core', penalty: 0, caution: '' },
  );
  const adjacent = experienceSignal('Minimum 5 years of customer success experience.');
  assert.equal(adjacent.band, 'adjacent');
  assert.match(adjacent.caution, /within total experience/i);
  const stretch = experienceSignal('7+ years of community operations experience required.');
  assert.equal(stretch.band, 'stretch');
  assert.ok(stretch.penalty > adjacent.penalty);
});