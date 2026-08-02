# Connect email without exposing a key

Resend has two separate jobs in Career Intelligence:

- it sends the finished recommendation digest;
- optionally, it receives forwarded alerts from the eight broader job platforms.

The scanner still runs in GitHub Actions. Resend does not run Career Ops, evaluate jobs or submit applications.

You do not need a live website. A custom domain is optional for a personal setup.

## 1. Connect digest delivery

### The simplest personal setup

If the digest goes to the same email address used for the Resend account, use:

```dotenv
CAREER_DIGEST_FROM="Career Intelligence <onboarding@resend.dev>"
CAREER_DIGEST_TO="the-email-used-for-the-resend-account@example.com"
```

Resend's test sender can send only to the account email. This route needs no domain purchase or DNS work. Confirm the current restriction in [Resend's test-domain guidance](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain) during setup.

### Sending to another address

Use a domain you control, add the DNS records Resend shows, and send from an address on that verified domain. The domain does not need to host a website. A sending subdomain such as `updates.example.com` keeps this traffic separate from ordinary email. See [Resend's domain guide](https://resend.com/docs/dashboard/domains/introduction).

Create `RESEND_API_KEY` with **sending access only**. If Resend offers a domain restriction, select the digest domain. This key never needs receiving access.

## 2. Add platform-alert intake (optional, recommended for coverage)

Use a Resend-managed receiving domain if you do not own a domain. Resend will show an address under its managed `resend.app` receiving domain. A custom receiving domain is also supported, but it is not required. See [Resend Receiving](https://resend.com/docs/dashboard/receiving/introduction).

Create a second key named `RESEND_RECEIVING_API_KEY` with full access. Resend currently does not offer a receiving-only permission, so separating it from the sending-only key limits the delivery job's access.

Save the receiving address as `RESEND_RECEIVING_ADDRESS`. Do not publish it in the repository: an exposed address can attract unwanted mail and consume intake capacity.

The intake runs every three hours. It lists new received messages, retrieves only the bounded set it has not seen, extracts recognized job links and saves normalized candidates. It hashes inbound message identities and does not save raw bodies, subjects, attachments or sender addresses to GitHub state.

## 3. Add the private GitHub secrets

Run these from the private Career Ops repository. Each command opens a secure prompt; the value should not be typed into agent chat or placed on the command line.

```bash
gh secret set RESEND_API_KEY
gh secret set CAREER_DIGEST_FROM
gh secret set CAREER_DIGEST_TO
```

If platform-alert intake is enabled, also run:

```bash
gh secret set RESEND_RECEIVING_API_KEY
gh secret set RESEND_RECEIVING_ADDRESS
gh variable set CAREER_ALERT_INTAKE_ENABLED --body true
```

The alert-intake workflow stays dormant on its schedule until that repository variable is `true`. A manual test can still be run while setup is in progress.

## 4. Validate before sending

From `career-ops/extensions/career-intelligence-workflow`, first check the names and formats without making a network request:

```bash
npm run mail:doctor
```

With the ignored local `.env` loaded, the guided agent can verify receiving access without sending mail:

```bash
npm run mail:doctor -- --live-receiving
```

A real test message is deliberately harder to trigger. It requires both flags:

```bash
npm run mail:doctor -- --send-test --confirm-send
```

The agent must explain the recipient and ask before running that command.

## 5. Connect the platform alerts

Follow [PLATFORM_ALERTS.md](PLATFORM_ALERTS.md) one platform at a time. Most platforms send alerts only to the account email, so use a narrow forwarding rule in that inbox. Forward only verified job-alert messages from the selected platform—not the entire mailbox—to the private Resend receiving address.

Mark a platform tested only when a manual intake run recognizes it. If the email arrives but the full job specification cannot be resolved, the pipeline records `manual_review`; it does not recommend the role from a title alone.

## Retry safety

The exact digest payload is saved before delivery. All attempts for one morning or evening slot reuse the same repository-scoped idempotency key. Do not add a timestamp or attempt number to the key. A 409 or any other non-2xx response is still an error unless an independent delivery receipt is already saved.

## If a key was exposed

Create a replacement, update the private secret, run the appropriate connection test, revoke the old key, and inspect repository history and workflow logs. Deleting visible text does not remove a key from prior chat, commits or logs.
