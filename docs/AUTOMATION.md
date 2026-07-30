# Run the digest every 12 hours

GitHub Actions runs while the user's computer is off. The workflow belongs in the user's private Career Ops repository because it reads the private extension profile and commits recommendation state.

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

See [RESEND.md](RESEND.md) for values and domain verification.

## What the workflow does

1. Checks out the private Career Ops repository.
2. Installs the extension's locked dependencies.
3. Verifies the Career Ops foundation and confirmed extension profile.
4. Runs the extension tests.
5. Performs the scan and sends the digest.
6. Commits only the extension's saved state and latest report when changed.

The example runs at minute 23 twice per day in `UTC`. Change the workflow timezone and hours to the user's confirmed schedule. Scheduled workflows can be delayed, so this is a twice-daily delivery target rather than a real-time guarantee.

## Test before relying on it

1. Open the private repository's Actions tab.
2. Select **Scheduled Career Intelligence digest**.
3. Run it manually.
4. Confirm every step passes.
5. Inspect the email's freshness labels and recommendation reasons.
6. Confirm the commit changed only extension state and report files.

Keep the recurring schedule only after this manual run succeeds.

## Disable it

Disable the workflow in the Actions tab or remove `.github/workflows/career-intelligence.yml` from the private Career Ops repository. Removing the example inside the extension has no effect.
