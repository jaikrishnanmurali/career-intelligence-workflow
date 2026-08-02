# Troubleshooting

## Career Ops is missing or unsupported

Run setup from a Career Ops root containing `package.json`, `AGENTS.md`, `modes/scan.md`, `scan.mjs`, `portals.yml`, `config/profile.yml` and `cv.md`.

This release supports the validated Career Ops 1.22.x–1.24.x contract. A 1.21 or 1.25 workspace stops deliberately because the scan-history or mode contract may differ. Use the guided update or compatibility path rather than bypassing the check.

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

Check `config/sources.yml` first. A LinkedIn lane is honest only when its bounded search query is approved or its native alert has been forwarded and tested. Then check `reports/intake-latest.json`: `not_configured` means the route was never proven; `partial` or `failed` means it was unavailable; a zero lead count after a successful poll means no new recognized lead arrived in that poll.

Discovery can use a verified alert lead, but it does not sign in to or crawl LinkedIn. Smart additionally runs the approved LinkedIn web query and tries to resolve alert leads to employer or ATS specifications. Confirm `CAREER_OPS_AGENT_ENABLED=true` and the approved query exists when Smart is expected.

Even Smart Digest has no personal signed-in LinkedIn session in GitHub Actions. Search can discover a LinkedIn URL while the full page remains blocked. The coverage receipt should record that limitation. Add employer-site and ATS queries as complementary routes rather than claiming LinkedIn can always be traversed.

## Discovery Digest says reduced coverage

That is expected. It ran the official Career Ops structured scanner, supplemental public feeds, rolling ATS boards and configured alert intake, but it did not run signed-in platform crawling, adaptive browser navigation or broad web-search layers. Switch to Smart only after the structured and email paths are proven and the additional coverage is worth the provider cost.

## A platform alert arrived but was not recommended

Look for the separate manual-check section. An alert is only a lead. If the intake cannot verify a complete live specification, it shows the lead once as `manual_review` rather than guessing fit from the title. If it is missing entirely, check that the forwarded recipient exactly matches `RESEND_RECEIVING_ADDRESS`, the link uses a recognized platform host, and the intake workflow completed.

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

For receiving problems, run `npm run mail:doctor -- --live-receiving` from an ignored local environment. Receiving uses the separate full-access `RESEND_RECEIVING_API_KEY`; delivery should keep its sending-only key.

A 409 is treated as an error. The outbox remains prepared and a later attempt resends the identical payload with the same idempotency key.

## The second retry rescanned

It should not rescan when the slot has a durable `prepared` outbox. Check whether the first attempt successfully pushed the state branch before the delivery step. The gate output should say `resume_delivery=true`.

## The workflow did not start at local wall-clock time

GitHub cron entries are UTC. Reinstall the workflows after changing `schedule.timezone` or `schedule.delivery_times`. Installation generates standard-time and daylight-saving expressions and an exact local-clock gate discards the inactive seasonal trigger.

## The extension already exists

The installer refuses to overwrite it. Review and update the installed extension deliberately; do not delete private state or config without a backup.

## An update issue appeared

The weekly watch found a newer Career Ops or Career Intelligence version; it did not modify the deployment. From the canonical Career Ops root, ask Codex or Claude Code to “Update Career Intelligence safely.” If validation fails, leave the digest paused and use the documented rollback instead of forcing the schedule to resume.
