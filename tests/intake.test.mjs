import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canonicalPlatformLead,
  extractJobPosting,
  parseAlertEmail,
  resolvePublicLead,
  safePublicUrl,
} from '../src/intake.mjs';

const PLATFORM_URLS = {
  linkedin: 'https://www.linkedin.com/jobs/view/product-marketing-1234567890?trk=email',
  indeed: 'https://se.indeed.com/viewjob?jk=abc123&utm_source=alert',
  glassdoor: 'https://www.glassdoor.com/job-listing/example?jobListingId=7654321',
  jobbsafari: 'https://www.jobbsafari.se/jobb/product-specialist-sasrb-12345',
  iamexpat: 'https://www.iamexpat.nl/career/jobs-netherlands/amsterdam/product-specialist',
  'karriere-at': 'https://www.karriere.at/jobs/987654/product-specialist',
  climatebase: 'https://jobs.climatebase.org/job/24680/product-specialist',
  wellfound: 'https://wellfound.com/jobs/13579-product-specialist',
};

test('recognizes and canonicalizes all eight supported platform leads', () => {
  for (const [platform, url] of Object.entries(PLATFORM_URLS)) {
    const lead = canonicalPlatformLead(url);
    assert.equal(lead?.platform, platform, `${platform} was not recognized`);
    assert.ok(lead.boardJobId);
    assert.ok(lead.candidateKey.startsWith(`${platform}:`));
  }
});

test('recognizes common alert-link variants without retaining tracking URLs', () => {
  assert.equal(
    canonicalPlatformLead('https://www.linkedin.com/comm/jobs/view/9876543210?trackingId=secret')?.boardUrl,
    'https://www.linkedin.com/jobs/view/9876543210',
  );
  assert.equal(
    canonicalPlatformLead('https://www.linkedin.com/jobs/search/?currentJobId=1234567890')?.boardJobId,
    '1234567890',
  );
  assert.equal(
    canonicalPlatformLead('https://www.glassdoor.com/job-listing/example?jl=12345678')?.boardJobId,
    '12345678',
  );
  assert.equal(
    canonicalPlatformLead('https://alerts.example.test/click?url=https%3A%2F%2Fse.indeed.com%2Frc%2Fclk%3Fjk%3Dabc987')?.boardUrl,
    'https://se.indeed.com/viewjob?jk=abc987',
  );
});

test('rejects local, private-network, and non-web links', () => {
  for (const value of [
    'http://localhost/job',
    'http://127.0.0.1/job',
    'http://10.0.0.4/job',
    'http://192.168.1.1/job',
    'file:///etc/passwd',
    'javascript:alert(1)',
  ]) assert.equal(safePublicUrl(value), '');
});

test('extracts platform leads without retaining the raw alert body', () => {
  const secretMarker = 'PRIVATE-ALERT-CONTENT-SHOULD-NOT-PERSIST';
  const html = Object.entries(PLATFORM_URLS)
    .map(([platform, url]) => `<a href="${url}">${platform} Product Specialist</a>`)
    .join('') + secretMarker;
  const leads = parseAlertEmail({ html, text: '' });
  assert.equal(leads.length, 8);
  assert.doesNotMatch(JSON.stringify(leads), new RegExp(secretMarker));
  assert.ok(leads.every((lead) => lead.specStatus === 'unresolved'));
});

test('parses a complete public JobPosting specification', () => {
  const description = 'Build partner campaigns and improve circular product adoption. '.repeat(8);
  const html = `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: 'Product Marketing Specialist',
    hiringOrganization: { name: 'Example Climate Company' },
    jobLocation: { address: { addressLocality: 'Stockholm', addressCountry: 'SE' } },
    datePosted: '2026-07-30T08:00:00+02:00',
    validThrough: '2099-08-30T23:59:59+02:00',
    description,
    url: 'https://jobs.climatebase.org/job/24680/product-specialist',
  })}</script>`;
  const posting = extractJobPosting(html, PLATFORM_URLS.climatebase);
  assert.equal(posting.title, 'Product Marketing Specialist');
  assert.equal(posting.company, 'Example Climate Company');
  assert.equal(posting.specStatus, 'verified');
  assert.equal(posting.postingPrecision, 'exact');
  assert.match(posting.location, /Stockholm/);
});

test('does not scrape restricted platform detail pages and fails public parsing closed', async () => {
  let fetches = 0;
  const linkedin = canonicalPlatformLead(PLATFORM_URLS.linkedin);
  const unchanged = await resolvePublicLead(linkedin, {
    fetchImpl: async () => { fetches += 1; throw new Error('must not run'); },
  });
  assert.equal(fetches, 0);
  assert.equal(unchanged.specStatus, undefined);

  const publicLead = canonicalPlatformLead(PLATFORM_URLS.wellfound);
  const unresolved = await resolvePublicLead(publicLead, {
    fetchImpl: async () => ({ ok: true, url: publicLead.boardUrl, text: async () => '<html>No job spec</html>' }),
  });
  assert.equal(unresolved.specStatus, 'manual_review');
});

test('refuses a platform redirect to a private network target', async () => {
  const lead = canonicalPlatformLead(PLATFORM_URLS.wellfound);
  const result = await resolvePublicLead(lead, {
    fetchImpl: async () => ({
      ok: false,
      status: 302,
      headers: { get: () => 'http://127.0.0.1/private-job' },
      text: async () => '',
    }),
  });
  assert.equal(result.specStatus, 'manual_review');
});
