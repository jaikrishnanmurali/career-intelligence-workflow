# Resend email setup

Career Intelligence sends digest emails through Resend's HTTPS API. It uses a sending key only; it does not need inbox access.

## 1. Create and verify a sending domain

1. Create a Resend account at <https://resend.com>.
2. Open **Domains** and add a domain you control. Resend recommends a subdomain such as `updates.example.com` to isolate sending reputation.
3. Add the SPF and DKIM records shown by Resend to your DNS provider.
4. Wait until the domain is marked verified.

Resend's domain documentation: <https://resend.com/docs/dashboard/domains/introduction>

For initial testing, Resend may restrict delivery to the email address associated with your account. A verified domain is required for ordinary delivery to other recipients.

## 2. Create the least-privileged API key

1. Open the Resend API Keys dashboard.
2. Select **Create API Key**.
3. Name it for this deployment, for example `career-intelligence-github`.
4. Choose **Sending access** and restrict it to the verified domain when that option is available.
5. Copy the key immediately. Resend shows a new key only once.

API-key documentation: <https://resend.com/docs/dashboard/api-keys/introduction>

Do not paste the key into `profile.yml`, a workflow file, an issue, a chat intended for sharing, or any committed file.

## 3. Test locally

Open the ignored `.env` created by `npm run init`:

```dotenv
RESEND_API_KEY=re_replace_this_value
CAREER_DIGEST_FROM="Career Intelligence <digest@updates.example.com>"
CAREER_DIGEST_TO="you@example.com"
```

The domain after `@` in `CAREER_DIGEST_FROM` must match the domain or subdomain verified in Resend. Resend accepts a friendly sender name in the `Name <address>` format.

Validate without printing the secret:

```bash
npm run doctor -- --email
```

Send one real digest:

```bash
npm run scan -- --send
```

The API request includes an idempotency key derived from the run timestamp and recommendation URLs, reducing duplicate sends if the same request is retried. Resend documents idempotency keys in its send-email reference: <https://resend.com/docs/api-reference/emails/send-email>.

## 4. Add GitHub Actions secrets

In the private deployment repository:

1. Open **Settings**.
2. Select **Secrets and variables**, then **Actions**.
3. Add these repository secrets exactly:

| Secret | Value |
| --- | --- |
| `RESEND_API_KEY` | The sending-only Resend key. |
| `CAREER_DIGEST_FROM` | `Career Intelligence <digest@your-verified-domain>` |
| `CAREER_DIGEST_TO` | The recipient address. |

GitHub only exposes a repository secret to a workflow when the workflow maps it explicitly. The scheduled example maps these three values as environment variables. GitHub's secrets overview is at <https://docs.github.com/en/actions/concepts/security/secrets>.

Do not also commit a `.env` file to the cloud repository.

## 5. Rotate a key

If a key is pasted into a public place or committed, treat it as compromised:

1. Create a replacement sending key.
2. Update the local `.env` and the GitHub Actions secret.
3. Run one successful test.
4. Delete the old key in Resend.

Deleting a file from the latest Git commit does not remove the secret from prior history. Revoke the key first. Resend's key-handling guidance is at <https://resend.com/docs/knowledge-base/how-to-handle-api-keys>.

## Common errors

- **Invalid API key:** create a new key and replace the stored value; do not print it for debugging.
- **Domain not verified:** make `CAREER_DIGEST_FROM` use the exact verified domain and recheck SPF/DKIM status.
- **Testing recipient restriction:** send to the Resend account's own address or complete domain verification.
- **No email:** open the Actions log or local terminal, confirm the scan completed, and check the Resend logs for the request id.