# Troubleshooting

## Installation says Career Ops is incomplete

Run the installer from the Career Ops root after completing its onboarding. The root must contain `package.json` with the `career-ops` package name, `AGENTS.md`, `modes/`, `config/profile.yml`, and `cv.md`.

## The extension already exists

The installer refuses to overwrite `extensions/career-intelligence-workflow`. Review and update the existing extension instead of rerunning a fresh install.

## Diagnostics say the profile is unconfirmed

Start Codex or Claude from the Career Ops root and ask to set up the 12-hour digest. The imported draft intentionally says `configured: false` until the user reviews the search rules.

## YAML fails to load

Ask the agent to repair the extension's private `config/profile.yml` and rerun diagnostics. Do not edit Career Ops `config/profile.yml` merely to satisfy the extension.

## The smoke scan returns no recommendations

This can be correct. Inspect `reports/latest.json` for source failures, freshness decisions, hard blockers, and candidates outside the bounded verification budget. Widen one confirmed rule at a time.

## "Posted today" is not verified

"Today" does not prove an age under 12 hours. The scanner labels relative evidence `likely`. An untimestamped live role is `newly_discovered` and appears once.

## Email fails

Run:

```bash
npm run doctor -- --email --career-ops-root ../..
```

Check the key, verified sender domain, recipient restrictions, and exact GitHub secret names without printing the key.

## The workflow cannot find the extension

The supported path is `extensions/career-intelligence-workflow`. If the folder was renamed, update every workflow working-directory and saved-state path consistently.

## The schedule did not run exactly on time

Scheduled GitHub workflows can be delayed. Run the workflow manually and confirm it exists on the default branch of the private repository.

## Codex or Claude cannot find the skill

Start a new session from the Career Ops root. Confirm the installed adapter exists under `.agents/skills/career-intelligence/` or `.claude/skills/career-intelligence/`.
