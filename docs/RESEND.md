# Resend email setup

Career Intelligence uses the Resend HTTPS API to send a recommendation digest. It needs sending access only and never reads an inbox.

Complete profile onboarding, tests, and the no-email smoke scan before this step.

## 1. Verify a sending domain

Create a Resend account, add a domain you control, and publish the SPF and DKIM records Resend provides. A sending subdomain such as `updates.example.com` keeps this traffic separate from ordinary mail.

Resend documentation: <https://resend.com/docs/dashboard/domains/introduction>

## 2. Create a restricted key

Create a sending-only API key and restrict it to the verified domain where that option is available. Copy it once and store it privately.

Do not put the key in Career Ops YAML, the extension profile, a workflow file, a GitHub issue, or agent chat.

## 3. Test locally

From `career-ops/extensions/career-intelligence-workflow`, create the ignored `.env` from `.env.example` and edit it locally:

```dotenv
RESEND_API_KEY=re_replace_this_value
CAREER_DIGEST_FROM="Career Intelligence <digest@updates.example.com>"
CAREER_DIGEST_TO="you@example.com"
```

Validate without printing values:

```bash
npm run doctor -- --email --career-ops-root ../..
```

Send one real digest only when intended:

```bash
npm run scan -- --send
```

The sender domain must match the verified Resend domain. Initial Resend accounts may restrict test recipients until domain verification is complete.

## 4. Add GitHub Actions secrets

In the private Career Ops repository, add exactly:

| Secret | Value |
| --- | --- |
| `RESEND_API_KEY` | Restricted sending key |
| `CAREER_DIGEST_FROM` | `Career Intelligence <digest@verified-domain>` |
| `CAREER_DIGEST_TO` | Recipient address |

Do not commit the local `.env`.

## 5. Rotate an exposed key

1. Create a replacement key.
2. Update the local ignored value and the GitHub secret.
3. Run one successful test.
4. Revoke the exposed key.
5. Inspect Git history, workflow logs, and repository access.

Deleting a file does not remove a key from prior commits or logs.
