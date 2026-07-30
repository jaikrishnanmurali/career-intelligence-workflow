# Resend email setup

Career Intelligence uses the Resend HTTPS API to send the recommendation digest. It needs sending access only and never reads an inbox.

You do not need a live website. You may not need a domain either.

Complete profile onboarding, tests, and the no-email smoke scan before enabling delivery.

## Choose the simplest sending option

### No domain: send the digest to yourself

Use this route when the digest will go to the same email address used for your Resend account.

Resend lets a new account send from `onboarding@resend.dev` to that account email. It will not send from this test domain to a different recipient.

Use:

```dotenv
CAREER_DIGEST_FROM="Career Intelligence <onboarding@resend.dev>"
CAREER_DIGEST_TO="the-email-used-for-your-resend-account@example.com"
```

This is enough for a personal job-search digest. No domain purchase, DNS change, or website is required.

Resend documents the recipient restriction here: <https://resend.com/docs/knowledge-base/403-error-resend-dev-domain>

### Your own domain: send to other recipients

Choose this route if the digest must go to another address, several people, or a user other than the Resend account owner.

You need a domain you control and access to its DNS records. The domain does not need to host a website. Add the SPF and DKIM records shown by Resend, wait for verification, and use an address on that domain:

```dotenv
CAREER_DIGEST_FROM="Career Intelligence <digest@updates.example.com>"
CAREER_DIGEST_TO="recipient@example.net"
```

A sending subdomain such as `updates.example.com` keeps this email traffic separate from ordinary mail.

Resend domain guide: <https://resend.com/docs/dashboard/domains/introduction>

## Create a sending key

Create a sending-only Resend API key. If you use a verified domain and Resend offers a domain restriction for the key, select that domain. Copy the key once and store it privately.

Do not put the key in Career Ops YAML, the extension profile, a workflow file, a GitHub issue, or agent chat.

## Test locally

From `career-ops/extensions/career-intelligence-workflow`, copy `.env.example` to an ignored `.env` and add the three values:

```dotenv
RESEND_API_KEY=re_replace_this_value
CAREER_DIGEST_FROM="Career Intelligence <onboarding@resend.dev>"
CAREER_DIGEST_TO="the-email-used-for-your-resend-account@example.com"
```

Validate without printing the values:

```bash
npm run doctor -- --email --career-ops-root ../..
```

Send one real digest only when intended:

```bash
npm run scan -- --send
```

If you use `onboarding@resend.dev`, `CAREER_DIGEST_TO` must be the email associated with the Resend account. With a verified domain, the sender must use that domain.

## Add GitHub Actions secrets

In the private Career Ops repository, add exactly:

| Secret | No-domain personal setup | Verified-domain setup |
| --- | --- | --- |
| `RESEND_API_KEY` | Sending-only key | Sending-only key |
| `CAREER_DIGEST_FROM` | `Career Intelligence <onboarding@resend.dev>` | `Career Intelligence <digest@your-domain>` |
| `CAREER_DIGEST_TO` | Resend account email | Intended recipient |

Do not commit the local `.env`.

## Rotate an exposed key

1. Create a replacement key.
2. Update the local ignored value and the GitHub secret.
3. Run one successful test.
4. Revoke the exposed key.
5. Inspect Git history, workflow logs, and repository access.

Deleting a file does not remove a key from prior commits or logs.
