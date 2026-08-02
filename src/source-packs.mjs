import { parse, stringify } from 'yaml';

import { normalizeText } from './util.mjs';

function quotedOr(values, maximum = 8) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]
    .slice(0, maximum)
    .map((value) => `"${value.replaceAll('"', '')}"`)
    .join(' OR ');
}

export function buildSourcePlan(profile, packsText) {
  const packs = parse(String(packsText || ''));
  if (Number(packs?.version) !== 1 || !packs?.platforms || !packs?.packs) {
    throw new Error('Source packs must use version 1 with packs and platforms maps.');
  }
  const roleTerms = (profile?.search_profile?.role_families || [])
    .flatMap((family) => family?.title_terms || [])
    .map(String).filter(Boolean);
  const locationTerms = (profile?.search_profile?.location_groups || [])
    .flatMap((group) => group?.terms || [])
    .map(String).filter(Boolean);
  const locationText = normalizeText(locationTerms.join(' '));
  const selectedPacks = ['global'];
  for (const [packId, pack] of Object.entries(packs.packs)) {
    if (packId === 'global') continue;
    const matches = (pack.location_terms || [])
      .some((term) => locationText.includes(normalizeText(term)));
    if (matches) selectedPacks.push(packId);
  }
  const selectedPlatforms = new Set(
    selectedPacks.flatMap((packId) => packs.packs[packId]?.platforms || []),
  );
  const roleQuery = quotedOr(roleTerms, 10) || '"target role"';
  const locationQuery = quotedOr(locationTerms, 8) || '"preferred location"';
  return {
    version: 1,
    configured: false,
    selected_packs: selectedPacks,
    platforms: Object.entries(packs.platforms).map(([id, platform]) => ({
      id,
      label: String(platform.label || id),
      selected: selectedPlatforms.has(id),
      alert: {
        enabled: false,
        tested: false,
      },
      search: {
        enabled: selectedPlatforms.has(id),
        query: `site:${platform.search_domain} (${roleQuery}) (${locationQuery})`,
      },
      canonical_id: String(platform.canonical_id || 'canonical URL'),
      resolution: String(platform.resolution || 'employer_ats_first'),
    })),
  };
}

export function mergeSourceQueries(portals, sourcePlan) {
  const next = portals && typeof portals === 'object' && !Array.isArray(portals)
    ? structuredClone(portals) : {};
  const queries = Array.isArray(next.search_queries) ? [...next.search_queries] : [];
  const byName = new Map(queries.map((query, index) => [String(query?.name || ''), index]));
  for (const platform of sourcePlan.platforms || []) {
    if (!platform.selected || !platform.search?.enabled) continue;
    const name = `Career Intelligence — ${platform.label}`;
    const entry = { name, query: platform.search.query, enabled: true };
    if (byName.has(name)) queries[byName.get(name)] = entry;
    else queries.push(entry);
  }
  next.search_queries = queries;
  return next;
}

export function sourcePlanText(plan) {
  return `# Generated from the reviewed Career Intelligence role and location map.\n# Configure and test alerts before setting configured: true.\n${stringify(plan, { lineWidth: 0 })}`;
}
