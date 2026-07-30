# Run the digest every 12 hours

GitHub Actions runs while the user's computer is off. The workflow belongs in the user's private Career Ops repository because it reads the private extension profile and commits recommendation state.

The schedule uses three attempts for each morning and evening delivery slot. The later attempts are retries, not extra digests.

## Before enabling it

From `career-ops/extensions/career-intelligence-workflow`:

```bash
npm run doctor -- --email --career-ops-root ../..
npm test
npm run smoke
```

The smoke run must say that no email was sent.

## Install the workflow

After confirming the Career Ops repository is private:

```bash
npm run workflow:install -- --root ../..
```

This creates:

```text
career-ops/.github/workflows/career-intelligence.yml
```

The installer refuses to overwrite an existing workflow.

Add the private extension profile and generated lockfile deliberately:

```bash
cd ../..
git add .github/workflows/career-intelligence.yml
git add extensions/career-intelligence-workflow/package-lock.json
git add -f extensions/career-intelligence-workflow/config/profile.yml
git commit -m "Configure private Career Intelligence digest"
git push
```

Never add the extension `.env` file.

## Add GitHub secrets

In the private Career Ops repository, add these Actions secrets:

```text
RESEND_API_KEY
CAREER_DIGEST_FROM
CAREER_DIGEST_TO
```

See [RESEND.md](RESEND.md) for the no-domain personal setup and the optional verified-domain setup.

## How the delivery guard works

The example has two delivery slots. Each slot gets an initial attempt and two retries 20 and 40 minutes later:

| Slot | Initial attempt | Retry 1 | Retry 2 |
| --- | --- | --- | --- |
| Morning | 07:23 | 07:43 | 08:03 |
| Evening | 19:23 | 19:43 | 20:03 |

The example timezone is `UTC`. If every workflow `timezone` field is changed to `Europe/Stockholm`, those become Stockholm wall-clock times. Keep the workflow timezone aligned with `runtime.timezone` in the private extension profile.

Every attempt:

1. Checks out the repository's default branch so it sees the latest committed scan state.
2. Reads the saved delivery history before deciding whether to scan.
3. Skips the slot when a successful or deduplicated delivery is already recorded.
4. Uses the same Resend idempotency key for that repository and slot.
5. Records the slot, delivery status, and Resend result in private state after success.

If an attempt fails before delivery, the next attempt can scan. If Resend accepted the email but the run failed before state was committed, the repeated idempotency key suppresses another email and lets the retry record the slot as deduplicated. Resend retains idempotency keys for 24 hours, well beyond the 40-minute retry window. GitHub concurrency queues the attempts and prevents them from scanning at the same time.

Resend documents this behavior in [Idempotency Keys](https://resend.com/docs/dashboard/emails/idempotency-keys). GitHub documents default-branch scheduling, timezone behavior, and delayed starts in [Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

The retries reduce missed deliveries caused by a delayed or failed workflow run. They cannot deliver when Actions is disabled, repository secrets are wrong, Resend rejects every request, or all three GitHub attempts fail.

## Test the guard without scanning or emailing

1. Open the private repository's **Actions** tab.
2. Select **Scheduled Career Intelligence digest**.
3. Choose **Run workflow**.
4. Set `mode` to `guard-only`.
5. Start the workflow.

The guard step should complete, `should_run` should be false, and the validation, tests, scanner, email, and state-save steps should be skipped. The decision appears in the workflow summary.

## Test one real delivery

After the guard-only run passes:

1. Run the workflow again with `mode` set to `run`.
2. Confirm the scan and email steps pass.
3. Inspect the email's freshness labels and recommendation reasons.
4. Confirm the resulting commit changed only extension state and report files.
5. Let the next scheduled retry start and confirm it skips a delivered slot.

A manual `run` receives its own stable slot ID. Re-running the same GitHub run remains duplicate-safe.

## Change the schedule

Edit all six schedule entries together. Preserve the initial, +20 minute, and +40 minute pattern unless you intentionally choose another retry window. Set the same IANA timezone on every entry and in the extension profile.

Scheduled workflows can still start late. The times are delivery targets, not real-time guarantees.

## Disable it

Disable the workflow in the Actions tab or remove `.github/workflows/career-intelligence.yml` from the private Career Ops repository. Removing the example inside the extension has no effect.
