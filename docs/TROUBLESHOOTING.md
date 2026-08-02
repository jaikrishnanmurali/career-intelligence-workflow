# Troubleshooting

## Career Ops is missing or unsupported

Run setup from a Career Ops root containing `package.json`, `AGENTS.md`, `modes/scan.md`, `scan.mjs`, `portals.yml`, `config/profile.yml` and `cv.md`.

This release supports Career Ops 1.24.x. A 1.23 or 1.25 workspace stops deliberately because the scan-history or mode contract may differ. Update the extension rather than bypassing the check.

## I started in ChatGPT or the Claude website

Those websites cannot install the files. Open PowerShell, Terminal or VS Code’s terminal, enter the Career Ops folder and start `codex` or `claude` there.

## I use another Career Ops agent

Keep using it. Install this extension normally, then use Codex or Claude Code only for setup and the optional Smart cloud runner. Your normal Career Ops workflow does not need to move.

## The workflow says the repository is public

Stop. Make the live Career Ops repository private before retrying. Do not weaken the workflow gate.

## The workflow forgot old jobs

Check whether `career-intelligence-state` exists and whether the restore step succeeded. A fresh runner without that branch has no scan history. Do not solve this by committing all of `data/` to main; repair the state-branch permission or remote.

## Smart Digest is partial

Open the email or `reports/latest.json` and read the failed source names. Common causes are login walls, rate limits, changed page markup, inaccessible complete descriptions or missing provider credentials.

A partial receipt means “the run cannot prove this lane completed,” not “there were no jobs.” The next run keeps the source marked for catch-up.

## I do not see LinkedIn jobs

Confirm Smart Digest is selected, `CAREER_OPS_AGENT_ENABLED=true` is set and `portals.yml` contains enabled LinkedIn web queries. Discovery Digest does not run them.

Even Smart Digest has no personal signed-in LinkedIn session in GitHub Actions. Search can discover a LinkedIn URL while the full page remains blocked. The coverage receipt should record that limitation. Add employer-site and ATS queries as complementary routes rather than claiming LinkedIn can always be traversed.

## Discovery Digest says reduced coverage

That is expected. It searched the configured public feeds and rolling ATS boards but did not run LinkedIn, browser or broad web-search layers. Switch to Smart only after the structured and email paths are proven and the additional coverage is worth the provider cost.

## New jobs are unscored

A model step may have failed or the number of discoveries exceeded `max_full_evaluations`. The job is still emailed by design. Increase the cap only after considering model cost and runtime.

## A role has no exact posting time

Unknown timestamp is not the same as old. If a live role is new to persistent scanner history, it can be emailed once with an “exact timestamp unavailable” note. It must not be described as proven to be inside 12 hours.

## Email fails

Run diagnostics without printing secrets:

```bash
npm run doctor -- --email --career-ops-root ../..
```

Check the exact secret names, Resend sender restrictions and recipient. With `onboarding@resend.dev`, the recipient must be the Resend account email.

A 409 is treated as an error. The outbox remains prepared and a later attempt resends the identical payload with the same idempotency key.

## The second retry rescanned

It should not rescan when the slot has a durable `prepared` outbox. Check whether the first attempt successfully pushed the state branch before the delivery step. The gate output should say `resume_delivery=true`.

## The workflow did not start at local wall-clock time

The cron entries are UTC. The config timezone controls slot dates and display, not GitHub’s scheduler. Adjust all six cron entries when the desired UTC offset changes.

## The extension already exists

The installer refuses to overwrite it. Review and update the installed extension deliberately; do not delete private state or config without a backup.
