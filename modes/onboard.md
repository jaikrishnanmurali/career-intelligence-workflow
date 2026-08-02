# Set up the scheduled digest

Use this mode from the root of an onboarded Career Ops workspace in the validated 1.22.x–1.24.x range. If Career Ops is not installed yet, follow the bootstrap section below and return to Stage 2 only after its profile and CV are ready.

## Run the guided flow

Read `docs/ONBOARDING.md` completely and follow its eight-stage conversation contract. Resume from `npm run setup:status`; do not restart completed stages blindly. Lead one stage at a time, explain the immediate action before running it, and report the result before moving on.

The agent should run safe checks and commands for the user. Give copy-paste commands only when the current chat cannot run them. Ask one question at a time, and pause only for a real decision, explicit consent, or browser sign-in.

## Read first

1. Career Ops `AGENTS.md`, `config/profile.yml`, `cv.md`, `portals.yml` and `modes/scan.md`.
2. Extension `docs/DIGEST_MODES.md`, `docs/PRIVACY.md` and `config/profile.yml`.
3. Never ask for an API key in chat.

## Default product path

Explain that Discovery uses zero model tokens. It runs the official Career Ops structured scanner, supplemental public feeds, rolling Greenhouse, Lever, Ashby and Workday boards, and any verified leads from the eight platform-alert sources. Give concrete limits: a LinkedIn-only result whose alert never fired, an Indeed lead with no resolvable full specification, a dynamic “Load more” page or an ATS company outside this run's shard may be missed.

Smart Digest is an optional upgrade after Discovery and Resend are proven. It uses a billed Codex or Claude Code cloud worker to resolve remaining alert leads, cover Career Ops browser/search gaps and perform full-description evaluation.

The safe validation order is local no-email scan, private cloud workspace, Resend sending connection, optional receiving connection and platform-by-platform alert tests, `guard-only`, manual intake, `structured-only`, then one explicitly confirmed `run`. Never enable the schedule or send the first email merely because the user asked to begin setup.

If the user later chooses Smart, obtain explicit cloud privacy and cost consent, add only the selected provider credential and set `CAREER_OPS_AGENT_ENABLED=true`.

## Bootstrap when Career Ops is missing

Explain that Career Intelligence deliberately does not recreate the profile, CV, evidence rules, tailoring logic or application tracker. Offer to run the official Career Ops quick start from a user-approved parent folder:

```bash
npx @santifer/career-ops init
cd career-ops
codex
# or: claude
```

The agent should perform the commands it can, open the sign-in route when needed, and explain each handoff. Do not claim the ChatGPT or Claude website can install local files. After Career Ops onboarding is complete, return to the Career Ops root and install this extension with the one-command setup.

## Update behavior

Install the weekly compatibility-watch workflow alongside the digest. It opens one private issue when Career Ops or Career Intelligence changes upstream. Never auto-apply an upstream update to a live job-search workspace. Route an approved update through `modes/update.md`.
