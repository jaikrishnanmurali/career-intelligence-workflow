# Troubleshooting

## The scanner says it is using the example profile

Run:

```bash
npm run init
```

Then edit `config/profile.yml`. The real filename has no `.example` segment. Run `npm run doctor` again.

## YAML fails to load

Common causes are tabs, uneven indentation, a missing colon, or an unquoted value containing special punctuation. Compare the affected section with `config/profile.example.yml`. The doctor reports the path and parser error without printing the profile.

## The scan returns no recommendations

This can be correct. Check `reports/latest.json` for:

- number of normalized jobs;
- provider failures;
- relevant roles rejected by freshness, location, language, authorization, expiry, or manager thresholds;
- candidates left outside the bounded verification budget.

Run `npm run smoke` first. Widen one rule at a time and add a regression test when a listing exposes a systematic false negative.

## A role says “posted today” but is not verified

“Today” does not prove that the posting is less than 12 hours old. The scanner labels relative evidence as `likely` and sends it only once when it is new to saved state. This is intentional.

## An old untimestamped role appeared once

Without timestamp evidence, the scanner can prove only that the URL is new to its state. It labels the role `newly_discovered`, does not call it recently posted, and suppresses it in later runs.

## A language preference was treated as mandatory

Record the exact sentence as a test case. The general gate ignores phrases such as “preferred,” “helpful,” and “nice to have,” but natural-language requirement patterns vary. Do not weaken all language checks to fix one phrase.

## Email fails with a 403

Check:

- the API key is current and has sending access;
- the sender domain exactly matches a verified Resend domain;
- the test recipient is permitted by the account's current verification state;
- the GitHub secret names match the workflow.

See [RESEND.md](RESEND.md) and Resend's error reference: <https://resend.com/docs/api-reference/errors>.

## The GitHub schedule did not run exactly on time

GitHub documents that scheduled workflows can be delayed during high load. Run the workflow manually from the Actions tab. Confirm the workflow exists on the default branch and has not been disabled.

## The workflow cannot find `yaml`

The workflow must run `npm ci` before tests or scans. Confirm `package-lock.json` is committed and the setup step has not been removed.

## Career Ops integration refuses to install

The scanner repository must be inside the Career Ops root, normally at `extensions/career-intelligence-workflow`. The installer also expects `AGENTS.md` and `modes/` in the supplied root.

If a destination skill already exists, inspect it. The installer refuses to overwrite a different file unless `--force` is supplied deliberately.

## Codex does not show the skill

Start Codex from the repository root and ask it to list active skills. Confirm `.agents/skills/career-intelligence/SKILL.md` exists. Restart the session if project instructions were added after the session began.

## Claude Code does not show `/career-intelligence`

Start Claude Code from the repository root and confirm `.claude/skills/career-intelligence/SKILL.md` exists. If the top-level skills directory was created during an existing session, restart Claude Code so it can watch the directory.