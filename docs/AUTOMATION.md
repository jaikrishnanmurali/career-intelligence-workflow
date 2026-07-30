# Run the scanner every 12 hours

GitHub Actions runs in GitHub's managed environment, so the user's computer can be off. The schedule belongs in a private deployment because state and reports reveal job-search behavior.

## Before enabling a schedule

Complete these checks locally:

```bash
npm install
npm run init
npm run doctor -- --email
npm test
npm run smoke
```

Then configure the three repository secrets described in [RESEND.md](RESEND.md).

## Install the recurring workflow

Copy:

```text
examples/deep-job-scan.scheduled.yml
```

to:

```text
.github/workflows/deep-job-scan.yml
```

Because `config/profile.yml` is ignored for safety, add it deliberately only in the private deployment:

```bash
git add .github/workflows/deep-job-scan.yml
git add -f config/profile.yml
git commit -m "Configure private career scan"
git push
```

Before committing, confirm the repository visibility says **Private** on GitHub.

## What the workflow does

1. Checks out the private repository.
2. Installs the locked npm dependencies with `npm ci`.
3. Validates that a real deployment profile exists.
4. Runs the tests.
5. Performs a full scan and sends a Resend digest.
6. Commits the updated private state and latest report when they changed.

The state commit lets an untimestamped vacancy appear once as newly discovered instead of being emailed repeatedly.

## Schedule

The example runs at minute 23, twice per day, in `Europe/Stockholm`:

```yaml
on:
  schedule:
    - cron: "23 7,19 * * *"
      timezone: "Europe/Stockholm"
```

GitHub Actions supports IANA timezones for scheduled workflows. Scheduled runs use the latest commit on the default branch and can be delayed during high load; avoiding minute `0` reduces that risk. GitHub's workflow syntax is documented at <https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onschedule>.

Change the two hours or timezone in your private copy when needed. The interval between `7` and `19` is 12 hours.

## Test before relying on it

1. Open the private repository's **Actions** tab.
2. Select **Scheduled career-intelligence scan**.
3. Choose **Run workflow**.
4. Confirm all steps pass.
5. Confirm one email arrives and its freshness labels are clear.
6. Confirm the workflow committed `state/state.json` and `reports/latest.json` only to the private repository.

Do not enable the schedule until this manual run succeeds.

## Cost and limits

The scanner makes no model API calls. GitHub Actions and Resend may have account-specific free-tier limits that can change, so review their current dashboards before increasing frequency or source budgets.

The workflow bounds runtime, ATS boards, and live-page verification. Increasing those values makes a scan deeper but also increases requests and execution time. Respect source terms and rate limits.

## If a run is missed

GitHub schedules are not real-time guarantees. A delayed or dropped run does not mean the scanner has failed permanently. Run the workflow manually; saved state will still prevent repeated untimestamped recommendations.

## Disable automation

Disable the workflow from the Actions tab or remove `.github/workflows/deep-job-scan.yml` from the private deployment. Removing the public example under `examples/` has no effect because GitHub only executes workflow files under `.github/workflows/`.