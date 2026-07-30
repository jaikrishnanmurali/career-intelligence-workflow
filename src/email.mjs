import { createHash } from 'node:crypto';

import { formatStockholm } from './util.mjs';

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function freshnessLine(role) {
  if (role.freshness === 'verified') {
    return `Verified fresh · ${formatStockholm(role.postedAt)} · ${role.postedAtEvidence}`;
  }
  if (role.freshness === 'likely') {
    return `Likely fresh · ${role.postedAtEvidence}`;
  }
  return `Newly discovered · exact posting time unavailable · ${role.postedAtEvidence}`;
}

export function buildDigest(report) {
  const roles = Array.isArray(report.recommendations) ? report.recommendations : [];
  const dateLabel = formatStockholm(report.generatedAt);
  const subject = `Career deep scan: ${roles.length} new recommendation${roles.length === 1 ? '' : 's'} — ${dateLabel}`;

  const roleText = (role) => [
    `${role.fit} · ${role.company} — ${role.title}`,
    role.location || 'Location not stated',
    `Freshness: ${freshnessLine(role)}`,
    `Why: ${role.why}`,
    role.cautions ? `Caution: ${role.cautions}` : '',
    role.url,
  ].filter(Boolean).join('\n');

  const text = [
    subject,
    '',
    report.scanSummary,
    '',
    'NEW RECOMMENDATIONS',
    roles.length
      ? roles.map(roleText).join('\n\n')
      : 'No new qualified discoveries in this scan.',
    '',
    `FILTERED OR REJECTED: ${report.rejectedCount || 0}`,
    `SOURCE FAILURES: ${report.sourceFailureCount || 0}`,
    '',
    'Freshness labels are evidence grades: “newly discovered” means new to the saved scan state, not a proven employer posting time.',
    'Public reference build: keep candidate-specific experience framing in a private fork.',
    'No application was submitted.',
  ].join('\n');

  const renderRole = (role) => `
    <li style="margin:0 0 22px">
      <div style="font-weight:700">${escapeHtml(role.fit)} · ${escapeHtml(role.company)} — ${escapeHtml(role.title)}</div>
      <div style="color:#475569">${escapeHtml(role.location || 'Location not stated')}</div>
      <div style="margin-top:5px;color:#475569"><strong>Freshness:</strong> ${escapeHtml(freshnessLine(role))}</div>
      <div style="margin-top:7px"><strong>Why:</strong> ${escapeHtml(role.why)}</div>
      ${role.cautions ? `<div style="margin-top:5px;color:#92400e"><strong>Caution:</strong> ${escapeHtml(role.cautions)}</div>` : ''}
      <div style="margin-top:8px"><a href="${escapeHtml(role.url)}">Open job posting</a></div>
    </li>`;

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f1f5f9;color:#0f172a;font-family:Arial,sans-serif">
    <main style="max-width:780px;margin:0 auto;padding:28px 18px">
      <section style="background:#ffffff;border-radius:14px;padding:26px">
        <p style="margin:0;color:#0369a1;font-weight:700">CAREER OPS · ${escapeHtml(dateLabel)}</p>
        <h1 style="margin:8px 0 10px;font-size:26px">${roles.length} new recommendation${roles.length === 1 ? '' : 's'}</h1>
        <p style="margin:0 0 24px;color:#475569">${escapeHtml(report.scanSummary)}</p>
        ${roles.length
          ? `<ol style="padding-left:22px">${roles.map(renderRole).join('')}</ol>`
          : '<p>No new qualified discoveries in this scan.</p>'}
        <p style="margin-top:24px;color:#475569">
          ${report.rejectedCount || 0} results were filtered or rejected.
          ${report.sourceFailureCount || 0} source lanes reported a failure.
        </p>
        <p style="margin-top:22px;padding-top:18px;border-top:1px solid #e2e8f0;color:#475569;font-size:13px">
          “Newly discovered” means new to the saved scan state, not a proven employer posting time.
          No application was submitted.
        </p>
      </section>
    </main>
  </body>
</html>`;

  return { subject, text, html };
}

export async function sendDigest(report, fetchImpl = fetch) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CAREER_DIGEST_FROM;
  const to = process.env.CAREER_DIGEST_TO;
  if (!apiKey || !from || !to) {
    throw new Error('Resend is not fully configured.');
  }
  const digest = buildDigest(report);
  const idempotencyKey = createHash('sha256')
    .update(`${report.generatedAt}\n${report.recommendations.map((role) => role.url).sort().join('\n')}`)
    .digest('hex');
  const response = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'idempotency-key': idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: digest.subject,
      text: digest.text,
      html: digest.html,
    }),
  });
  const bodyText = await response.text();
  let body = {};
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    body = { message: bodyText };
  }
  if (!response.ok) {
    throw new Error(`Resend rejected the digest (${response.status}): ${body.message || 'unknown error'}`);
  }
  return { digest, result: body };
}

