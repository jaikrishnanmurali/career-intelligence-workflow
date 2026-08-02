import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { buildSourcePlan, mergeSourceQueries } from '../src/source-packs.mjs';

const packsText = await readFile(new URL('../config/source-packs.example.yml', import.meta.url), 'utf8');
const profile = {
  search_profile: {
    role_families: [
      { title_terms: ['product marketing', 'partner marketing', 'growth marketing'] },
      { title_terms: ['sustainability', 'circularity', 'product operations'] },
    ],
    location_groups: [
      { terms: ['Sweden', 'Stockholm'] },
      { terms: ['Netherlands', 'Amsterdam'] },
      { terms: ['Austria', 'Vienna'] },
    ],
  },
};

test('selects the global and regional source packs from the confirmed search profile', () => {
  const plan = buildSourcePlan(profile, packsText);
  assert.deepEqual(plan.selected_packs, ['global', 'sweden', 'netherlands', 'austria']);
  assert.equal(plan.platforms.length, 8);
  assert.ok(plan.platforms.every((platform) => platform.selected));
  assert.ok(plan.platforms.every((platform) => platform.search.query.includes('site:')));
});

test('merges one bounded query per platform idempotently', () => {
  const plan = buildSourcePlan(profile, packsText);
  const once = mergeSourceQueries({ search_queries: [] }, plan);
  const twice = mergeSourceQueries(once, plan);
  assert.equal(once.search_queries.length, 8);
  assert.deepEqual(twice, once);
});
