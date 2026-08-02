import { createHash } from 'node:crypto';

import { formatLocalTime } from './util.mjs';

const asList = (value) => (Array.isArray(value) ? value : []);

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function coverageCopy(report) {
  if (report.mode === 'discovery') return {
    label: 'Reduced coverage',
    summary: report.coverage?.summary || 'This run searched configured public feeds and rolling ATS boards. It did not attempt LinkedIn, Career Ops browser discovery or broad web search.',
    details: [
      'Likely included: a role exposed by a configured public feed or an ATS board reached by this run, such as Greenhouse.',
      'May be missed: a role visible only in LinkedIn or another search result.',
      'May be missed: a vacancy behind a dynamic careers page that needs a browser to open and paginate.',
      'May be missed this run: a supported ATS company outside the current rolling board shard.',
    ],
  };
  const complete = report.coverage?.completeness === 'complete';
  return {
    label: complete ? 'Smart coverage complete' : 'Smart coverage partial',
    summary: report.coverage?.summary || (complete
      ? 'Career Ops structured discovery, browser gaps, and broad web-search lanes completed.'
      : 'At least one Career Ops discovery lane did not complete. Found jobs are included and missing lanes are reported.'),
    details: asList(report.coverage?.warnings),
  };
}

function posted(role) {
  return role.postedAt
    ? `Posted: ${formatLocalTime(role.postedAt)}`
    : 'Posted: exact timestamp unavailable; new to the saved Career Ops history.';
}

function roleText(role, label) {
  return [
    `${label} · ${role.company || 'Company not stated'} — ${role.title || 'Title not stated'}`,
    role.location || 'Location not stated', posted(role),
    `Why: ${role.why || 'Not evaluated in this run.'}`,
    role.cautions ? `Caution: ${role.cautions}` : '', role.url,
  ].filter(Boolean).join('\n');
}

function textSection(title, roles, label) {
  return `${title}\n${roles.length ? roles.map((role) => roleText(role, label)).join('\n\n') : 'None in this run.'}`;
}

function htmlSection(title, roles, label) {
  if (!roles.length) return '';
  const items = roles.map((role) => `<li style="margin:0 0 22px">
    <strong>${escapeHtml(label)} · ${escapeHtml(role.company || 'Company not stated')} — ${escapeHtml(role.title || 'Title not stated')}</strong>
    <div style="color:#475569">${escapeHtml(role.location || 'Location not stated')}</div>
    <div style="margin-top:5px;color:#475569">${escapeHtml(posted(role))}</div>
    <div style="margin-top:7px"><strong>Why:</strong> ${escapeHtml(role.why || 'Not evaluated in this run.')}</div>
    ${role.cautions ? `<div style="color:#92400e"><strong>Caution:</strong> ${escapeHtml(role.cautions)}</div>` : ''}
    <div style="margin-top:8px"><a href="${escapeHtml(role.url)}">Open job posting</a></div>
  </li>`).join('');
  return `<h2 style="margin:26px 0 12px;font-size:19px">${escapeHtml(title)}</h2><ol style="padding-left:22px">${items}</ol>`;
}

export function buildDigest(report) {
  const recommended = asList(report.recommended || report.recommendations);
  const possible = asList(report.possible);
  const other = asList(report.other);
  const all = [...recommended, ...possible, ...other];
  const coverage = coverageCopy(report);
  const dateLabel = formatLocalTime(report.generatedAt);
  const modeLabel = report.mode === 'discovery' ? 'Discovery Digest' : 'Smart Digest';
  const subject = report.mode === 'discovery'
    ? `${modeLabel}: ${all.length} new job${all.length === 1 ? '' : 's'} — reduced coverage`
    : `${modeLabel}: ${all.length} new job${all.length === 1 ? '' : 's'}, ${recommended.length} recommended`;
  const text = [
    subject, dateLabel, '', `${coverage.label.toUpperCase()}: ${coverage.summary}`,
    ...coverage.details.map((item) => `- ${item}`), '', report.scanSummary || '', '',
    textSection('RECOMMENDED', recommended, 'Recommended'), '',
    textSection('POSSIBLE MATCHES', possible, 'Possible'), '',
    textSection('OTHER NEW OR UNSCORED JOBS', other, 'Other'), '',
    `HARD BLOCKED AND NOT EMAILED: ${Number(report.hardBlockedCount || 0)}`,
    `AWAITING EVALUATION BUT EMAILED: ${Number(report.awaitingEvaluationCount || 0)}`, '',
    'A model score never hides a retained recommendation. Every retained role is emailed unless an explicit hard requirement blocks it.',
    'An unavailable posting timestamp does not by itself remove a newly discovered role.',
    'No application was submitted.',
  ].join('\n');
  const details = coverage.details.length
    ? `<ul style="margin:10px 0 0;padding-left:20px">${coverage.details.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    : '';
  const html = `<!doctype html><html><body style="margin:0;background:#f1f5f9;color:#0f172a;font-family:Arial,sans-serif">
  <main style="max-width:780px;margin:0 auto;padding:28px 18px"><section style="background:#fff;border-radius:14px;padding:26px">
    <p style="margin:0;color:#0369a1;font-weight:700">CAREER OPS · ${escapeHtml(modeLabel)} · ${escapeHtml(dateLabel)}</p>
    <h1 style="margin:8px 0 10px">${all.length} new job${all.length === 1 ? '' : 's'}</h1>
    <div style="margin:18px 0;padding:15px;border-radius:9px;background:#fffbeb"><strong>${escapeHtml(coverage.label)}</strong><div>${escapeHtml(coverage.summary)}</div>${details}</div>
    <p style="color:#475569">${escapeHtml(report.scanSummary || '')}</p>
    ${htmlSection('Recommended', recommended, 'Recommended')}
    ${htmlSection('Possible matches', possible, 'Possible')}
    ${htmlSection('Other new or unscored jobs', other, 'Other')}
    <p style="color:#475569">${Number(report.hardBlockedCount || 0)} hard-blocked roles were not emailed. ${Number(report.awaitingEvaluationCount || 0)} roles awaited evaluation but were still emailed.</p>
    <p style="border-top:1px solid #e2e8f0;padding-top:18px;color:#475569;font-size:13px">A model score never hides a retained recommendation. An unavailable timestamp does not remove a newly discovered role. No application was submitted.</p>
  </section></main></body></html>`;
  return { subject, text, html };
}

export function digestPayload(digest) {
  const from = process.env.CAREER_DIGEST_FROM;
  const to = process.env.CAREER_DIGEST_TO;
  if (!from || !to) throw new Error('CAREER_DIGEST_FROM and CAREER_DIGEST_TO are required.');
  return { from, to: [to], subject: digest.subject, text: digest.text, html: digest.html };
}

export function payloadHash(payload) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export async function sendDigest(report, options = {}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is required.');
  const digest = options.digest || buildDigest(report);
  const payload = options.payload || digestPayload(digest);
  const idempotencyKey = options.idempotencyKey || payloadHash(payload);
  const response = await (options.fetchImpl || fetch)('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
    body: JSON.stringify(payload),
  });
  const bodyText = await response.text();
  let body = {};
  try { body = bodyText ? JSON.parse(bodyText) : {}; } catch { body = { message: bodyText }; }
  if (!response.ok) throw new Error(`Resend rejected the digest (${response.status}): ${body.message || body.name || 'unknown error'}`);
  return { digest, payload, result: body };
}
