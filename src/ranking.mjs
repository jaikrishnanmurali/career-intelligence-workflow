import {
  DEFAULT_MAX_PAGE_VERIFICATIONS,
  IC_TITLE_SIGNALS,
  LOCATION_GROUPS,
  LOOKBACK_HOURS,
  OBVIOUS_NON_EU_ONLY,
  ROLE_FAMILIES,
  TITLE_EXCLUDES,
  UNSUPPORTED_LOCAL_LANGUAGES,
} from './config.mjs';
import {
  canonicalUrl,
  fetchText,
  formatStockholm,
  isWithinHours,
  normalizeText,
  parallelMapLimit,
  sameStockholmDate,
  stripHtml,
} from './util.mjs';

function containsTerm(text, term) {
  const normalized = normalizeText(term);
  if (!normalized) return false;
  if (normalized.length <= 3) {
    return new RegExp(`(^|\\s)${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'i')
      .test(text);
  }
  return text.includes(normalized);
}

export function familyFor(job) {
  const title = normalizeText(job.title);
  const body = normalizeText(job.description);
  let best = null;
  for (const family of ROLE_FAMILIES) {
    const titleMatches = family.terms.filter((term) => containsTerm(title, term));
    const bodyMatches = family.responsibilityTerms.filter((term) => containsTerm(body, term));
    const genericIcTitle = IC_TITLE_SIGNALS.some((term) => containsTerm(title, term));
    const targetContextInTitle = [
      'marketing',
      'product',
      'partner',
      'partnership',
      'commercial',
      'market',
      'sustainability',
      'circular',
      'climate',
      'environmental',
      'growth',
      'operations',
      'delivery',
      'implementation',
      'onboarding',
      'customer',
      'program',
      'programme',
      'project',
    ].some((term) => containsTerm(title, term));
    if (
      titleMatches.length === 0
      && !(genericIcTitle && targetContextInTitle && bodyMatches.length >= 2)
    ) continue;
    const strength = titleMatches.length * 3 + bodyMatches.length;
    if (!best || strength > best.strength || (
      strength === best.strength && family.priority > best.family.priority
    )) {
      best = {
        family,
        strength,
        titleMatches,
        bodyMatches,
      };
    }
  }
  return best;
}

export function locationFor(value) {
  const text = ` ${normalizeText(value)} `;
  if (OBVIOUS_NON_EU_ONLY.some((term) => text.includes(normalizeText(term)))) {
    return { eligible: false, reason: 'Location is explicitly outside the EU search scope.' };
  }
  const nonEuCountry = [
    'united states',
    'usa',
    'canada',
    'india',
    'australia',
    'new zealand',
    'singapore',
    'philippines',
    'latin america',
    'latam',
    'apac',
  ].some((term) => text.includes(term));
  const explicitlyGlobalOrEuropean = [
    'worldwide',
    'global',
    'europe',
    'european union',
    'emea',
  ].some((term) => text.includes(term));
  if (nonEuCountry && !explicitlyGlobalOrEuropean) {
    return { eligible: false, reason: 'Location is outside the EU search scope.' };
  }
  for (const group of LOCATION_GROUPS) {
    if (group.terms.some((term) => text.includes(normalizeText(term)))) {
      return { eligible: true, group, caution: '' };
    }
  }
  if (!text.trim()) {
    return {
      eligible: true,
      group: { id: 'unknown', label: 'Location unconfirmed', score: 3 },
      caution: 'Location is not stated; confirm Sweden/EU eligibility.',
    };
  }
  return {
    eligible: false,
    reason: 'Location does not show Sweden, Amsterdam, Vienna, another EU country, or Europe-remote eligibility.',
  };
}

export function languageBlocker(value) {
  const text = normalizeText(value);
  const localLanguagePatterns = [
    ['swedish', /\b(?:flytande svenska|svenska i tal och skrift|goda kunskaper i svenska|svenska krav)\b/i],
    ['german', /\b(?:fliessend(?:e|es)? deutsch|sehr gute deutschkenntnisse|verhandlungssicher(?:es)? deutsch|deutsch c1|deutschkenntnisse erforderlich)\b/i],
    ['dutch', /\b(?:vloeiend nederlands|goede beheersing van de nederlandse taal|nederlands vereist)\b/i],
    ['french', /\b(?:francais courant|maitrise du francais|francais obligatoire|niveau c1 en francais|francais.{0,50}(?:professionnel(?:le)?s?|niveau b2|b2\+)|(?:professionnel(?:le)?s?|niveau b2|b2\+).{0,50}francais)\b/i],
  ];
  for (const [language, pattern] of localLanguagePatterns) {
    if (pattern.test(text)) return language;
  }
  for (const language of UNSUPPORTED_LOCAL_LANGUAGES) {
    const escaped = language.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const optionalOnly = new RegExp(
      `\\b${escaped}\\b.{0,55}\\b(?:preferred|a plus|helpful|nice to have|advantage|not required|optional)\\b`,
      'i',
    );
    if (optionalOnly.test(text)) continue;
    const requirementFirst = new RegExp(
      `\\b(?:must|required|requirement|mandatory|fluent|fluency|professional|business level|native|c1|c2)\\b.{0,70}\\b${escaped}\\b`,
      'i',
    );
    const languageFirst = new RegExp(
      `\\b${escaped}\\b.{0,70}\\b(?:must|required|requirement|mandatory|fluent|fluency|professional|business level|native|c1|c2)\\b`,
      'i',
    );
    if (requirementFirst.test(text) || languageFirst.test(text)) return language;
  }
  return null;
}

export function peopleManagementRequired(value) {
  const text = normalizeText(value);
  return [
    'manage a team',
    'managing a team',
    'people management',
    'direct reports',
    'line management',
    'hire and develop',
    'lead a team of',
    'build and lead a team',
  ].some((term) => text.includes(term));
}

export function authorizationBlocker(value) {
  const text = normalizeText(value);
  return [
    'we do not sponsor',
    'no visa sponsorship',
    'unable to sponsor',
    'cannot sponsor',
    'must already have the right to work',
    'must be authorized to work',
  ].some((term) => text.includes(term));
}

function freshnessFor(job, priorSeenUrls, scanStartedAt) {
  const canonical = canonicalUrl(job.url);
  const previouslySeen = priorSeenUrls.has(canonical);
  if (job.postedAt) {
    if (!isWithinHours(job.postedAt, scanStartedAt, LOOKBACK_HOURS)) {
      return {
        eligible: false,
        reason: `Source timestamp is outside the ${LOOKBACK_HOURS}-hour window.`,
      };
    }
    if (job.postingPrecision === 'relative') {
      return {
        eligible: !previouslySeen,
        freshness: 'likely',
        freshnessRank: 2,
        postedAt: '',
        firstSeenAt: scanStartedAt,
        postedAtEvidence: job.postedAtEvidence
          || `Source reports the role as current on ${formatStockholm(job.postedAt)}.`,
        reason: previouslySeen ? 'Already seen in a previous scan.' : '',
      };
    }
    return {
      eligible: !previouslySeen,
      freshness: 'verified',
      freshnessRank: 3,
      postedAt: job.postedAt,
      firstSeenAt: scanStartedAt,
      postedAtEvidence: job.postedAtEvidence || 'Source provides an exact timestamp.',
      reason: previouslySeen ? 'Already seen in a previous scan.' : '',
    };
  }
  if (previouslySeen) {
    return { eligible: false, reason: 'Untimestamped role was already seen.' };
  }
  return {
    eligible: true,
    freshness: 'newly_discovered',
    freshnessRank: 1,
    postedAt: '',
    firstSeenAt: scanStartedAt,
    postedAtEvidence: 'Absent from saved shortlist and scan state at scan start; exact posting time unavailable.',
    reason: '',
  };
}

function titleIsExcluded(title) {
  const text = normalizeText(title);
  return TITLE_EXCLUDES.some((term) => containsTerm(text, term));
}

function scoreCandidate(job, family, location, freshness) {
  const title = normalizeText(job.title);
  const description = normalizeText(job.description);
  let score = family.family.priority * 12;
  score += location.group.score;
  score += freshness.freshnessRank * 4;
  if (IC_TITLE_SIGNALS.some((term) => containsTerm(title, term))) score += 10;
  if (containsTerm(title, 'manager')) score -= 14;
  if (peopleManagementRequired(description)) score -= 24;
  score += Math.min(10, family.bodyMatches.length * 2);
  if (description.length >= 500) score += 3;
  return Math.round(score);
}

function fitBand(score) {
  if (score >= 88) return 'Priority';
  if (score >= 64) return 'Worth a look';
  return 'Stretch / review';
}

function whyText(candidate) {
  const signals = [
    ...candidate.family.titleMatches,
    ...candidate.family.bodyMatches,
  ].slice(0, 4);
  const detail = signals.length
    ? ` Signals found: ${signals.join(', ')}.`
    : '';
  return `${candidate.family.family.label} match in ${candidate.locationMatch.group.label}.${detail}`;
}

export function shortlistCandidates(jobs, state, scanStartedAt) {
  const priorSeenUrls = new Set(
    Object.keys(state.seenUrls || {}).map(canonicalUrl).filter(Boolean),
  );
  const rejected = [];
  const byUrl = new Map();

  for (const raw of jobs) {
    const url = canonicalUrl(raw.url);
    if (!url) continue;
    const current = byUrl.get(url);
    if (!current || (raw.description || '').length > (current.description || '').length) {
      byUrl.set(url, { ...raw, url });
    }
  }

  const candidates = [];
  for (const job of byUrl.values()) {
    if (titleIsExcluded(job.title)) {
      rejected.push({ ...job, reason: 'Excluded senior, technical, or academic title.' });
      continue;
    }
    const family = familyFor(job);
    if (!family) continue;
    const location = locationFor(job.location);
    if (!location.eligible) {
      rejected.push({ ...job, reason: location.reason });
      continue;
    }
    const freshness = freshnessFor(job, priorSeenUrls, scanStartedAt);
    if (!freshness.eligible) {
      rejected.push({ ...job, reason: freshness.reason });
      continue;
    }
    const body = normalizeText(job.description);
    const language = languageBlocker(body);
    if (language) {
      rejected.push({ ...job, reason: `Hard ${language} requirement.` });
      continue;
    }
    if (location.group.id !== 'sweden' && authorizationBlocker(body)) {
      rejected.push({ ...job, reason: 'Explicit work-authorization or no-sponsorship blocker outside Sweden.' });
      continue;
    }
    const score = scoreCandidate(job, family, location, freshness);
    if (containsTerm(normalizeText(job.title), 'manager') && score < 64) {
      rejected.push({ ...job, reason: 'Manager-titled role did not clear the stronger individual-contributor fit threshold.' });
      continue;
    }
    candidates.push({
      ...job,
      ...freshness,
      family,
      locationMatch: location,
      score,
      fit: fitBand(score),
    });
  }

  candidates.sort((a, b) => (
    b.score - a.score
    || b.freshnessRank - a.freshnessRank
    || a.company.localeCompare(b.company)
  ));
  return { candidates, rejected, priorSeenUrls };
}

const EXPIRED_SIGNALS = [
  'job is no longer available',
  'job no longer available',
  'position has been filled',
  'this job has expired',
  'applications are closed',
  'no longer accepting applications',
  'page not found',
];

async function verifyOne(candidate) {
  try {
    const page = await fetchText(candidate.url, {
      timeoutMs: 15_000,
      maxChars: 1_500_000,
    });
    const text = stripHtml(page.text);
    if (EXPIRED_SIGNALS.some((signal) => text.includes(signal))) {
      return { ...candidate, verified: false, rejectedReason: 'Live page indicates that the role is closed or expired.' };
    }
    const description = candidate.description.length >= text.length
      ? candidate.description
      : text;
    const language = languageBlocker(description);
    if (language) {
      return { ...candidate, verified: false, rejectedReason: `Hard ${language} requirement on the live page.` };
    }
    if (
      candidate.locationMatch.group.id !== 'sweden'
      && authorizationBlocker(description)
    ) {
      return {
        ...candidate,
        verified: false,
        rejectedReason: 'Live page states an authorization or sponsorship blocker outside Sweden.',
      };
    }
    const hasApplySignal = /\b(apply|submit application|apply now|send application)\b/i
      .test(page.text);
    const cautions = [
      candidate.locationMatch.caution,
      containsTerm(normalizeText(candidate.title), 'manager')
        ? 'Manager title; confirm that the role is genuinely individual-contributor work.'
        : '',
      peopleManagementRequired(description)
        ? 'The description includes people-management language; treat this as a material gap.'
        : '',
      !hasApplySignal
        ? 'The page loaded, but an application control was not visible in the fetched HTML; open it manually before applying.'
        : '',
      candidate.locationMatch.group.id === 'eu' && normalizeText(candidate.location).includes('remote')
        ? 'Confirm that remote employment is available from Sweden or another eligible EU country.'
        : '',
    ].filter(Boolean);
    const richer = {
      ...candidate,
      description,
      verified: true,
      finalUrl: page.finalUrl,
      cautions: cautions.join(' '),
    };
    const family = familyFor(richer) || richer.family;
    const score = scoreCandidate(richer, family, richer.locationMatch, richer);
    return {
      ...richer,
      family,
      score,
      fit: fitBand(score),
      why: whyText({ ...richer, family }),
    };
  } catch (error) {
    const authoritativeFeed = [
      'greenhouse',
      'lever',
      'ashby',
      'workday',
      'platsbanken-jobstream',
      'arbeitnow',
      'thehub',
    ].includes(candidate.source);
    if (!authoritativeFeed) {
      return {
        ...candidate,
        verified: false,
        rejectedReason: `Could not verify the live page: ${error.message}`,
      };
    }
    return {
      ...candidate,
      verified: true,
      cautions: `The source feed is live, but the posting page could not be fetched automatically: ${error.message}`,
      why: whyText(candidate),
    };
  }
}

export async function verifyCandidates(candidates) {
  const limit = Math.max(
    1,
    Number(process.env.MAX_PAGE_VERIFICATIONS) || DEFAULT_MAX_PAGE_VERIFICATIONS,
  );
  const selected = candidates.slice(0, limit);
  const verified = await parallelMapLimit(selected, 6, verifyOne);
  const recommendations = [];
  const rejected = [];
  for (const item of verified) {
    if (item.verified) recommendations.push(item);
    else rejected.push({ ...item, reason: item.rejectedReason });
  }
  recommendations.sort((a, b) => (
    b.score - a.score
    || b.freshnessRank - a.freshnessRank
    || a.company.localeCompare(b.company)
  ));
  return {
    recommendations,
    rejected,
    unverifiedDueToCap: Math.max(0, candidates.length - selected.length),
  };
}

export function recommendationRecord(candidate) {
  return {
    url: candidate.finalUrl || candidate.url,
    company: candidate.company,
    title: candidate.title,
    location: candidate.location,
    fit: candidate.fit,
    score: candidate.score,
    family: candidate.family.family.label,
    why: candidate.why || whyText(candidate),
    cautions: candidate.cautions || '',
    freshness: candidate.freshness,
    postedAt: candidate.postedAt || '',
    postedAtEvidence: candidate.postedAtEvidence,
    firstSeenAt: candidate.firstSeenAt,
    source: candidate.source,
    boardKey: candidate.boardKey,
  };
}

