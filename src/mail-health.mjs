function parseBody(text) {
  try { return text ? JSON.parse(text) : {}; }
  catch { return { message: text }; }
}

function headers(apiKey) {
  return {
    authorization: `Bearer ${apiKey}`,
    accept: 'application/json',
    'content-type': 'application/json',
    'user-agent': 'CareerIntelligenceWorkflow/1.3',
  };
}

export function validateMailConfiguration({ from, to, sendingKey, receivingKey, receivingEnabled }) {
  const failures = [];
  const warnings = [];
  if (!sendingKey) failures.push('RESEND_API_KEY is missing.');
  if (!from || !/@[^>\s]+/.test(from)) failures.push('CAREER_DIGEST_FROM is missing or invalid.');
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) failures.push('CAREER_DIGEST_TO is missing or invalid.');
  if (String(from || '').includes('@resend.dev')) {
    warnings.push('The resend.dev test sender can deliver only to the email address registered with that Resend account.');
  }
  if (receivingEnabled && !receivingKey) failures.push('RESEND_RECEIVING_API_KEY is missing. Alert intake needs a separate full-access key.');
  if (receivingEnabled && receivingKey && receivingKey === sendingKey) {
    warnings.push('Sending and receiving use the same key. Separate keys reduce the impact of credential exposure.');
  }
  return { failures, warnings };
}

export async function verifyReceivingKey(apiKey, fetchImpl = fetch) {
  const response = await fetchImpl('https://api.resend.com/emails/receiving?limit=1', {
    headers: headers(apiKey),
  });
  const body = parseBody(await response.text());
  if (!response.ok) throw new Error(`Resend Receiving rejected the key (${response.status}): ${body.message || 'unknown error'}`);
  return { ok: true, listed: Array.isArray(body.data) ? body.data.length : 0 };
}

export async function sendMailTest({ apiKey, from, to, fetchImpl = fetch }) {
  const idempotencyKey = `career-intelligence-mail-test/${new Date().toISOString().slice(0, 10)}/${to}`;
  const response = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: { ...headers(apiKey), 'idempotency-key': idempotencyKey },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'Career Intelligence email test',
      text: 'Your Career Intelligence email connection is working. No job scan ran and no application was submitted.',
    }),
  });
  const body = parseBody(await response.text());
  if (!response.ok) throw new Error(`Resend rejected the test (${response.status}): ${body.message || 'unknown error'}`);
  if (!body.id) throw new Error('Resend accepted the request without returning an email id.');
  return { id: body.id };
}
