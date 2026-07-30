# Complete setup

This guide adds a private, twice-daily email digest to an existing Career Ops workspace. Career Intelligence is not a replacement for Career Ops.

## Prerequisites

- Career Ops installed and onboarded with `config/profile.yml` and `cv.md`.
- Node.js 22 or newer for this extension.
- Git and internet access.
- Codex or Claude for conversational setup.
- A Resend account only when email is enabled.
- A private GitHub repository only when cloud scheduling is enabled.

## 1. Install inside Career Ops

From the Career Ops root:

```bash
npx --yes github:jaikrishnanmurali/career-intelligence-workflow init
```

The installer refuses to continue when Career Ops onboarding is incomplete or when `extensions/career-intelligence-workflow` already exists. It does not overwrite an active extension.

Expected result:

```text
career-ops/
  .agents/skills/career-intelligence/SKILL.md
  .claude/skills/career-intelligence/SKILL.md
  extensions/career-intelligence-workflow/
```

No email is sent and no workflow is enabled.

## 2. Complete conversational onboarding

Start Codex or Claude from the Career Ops root:

```bash
codex
# or
claude
```

Ask:

```text
Set up my 12-hour Career Intelligence job digest.
```

The installer has already created an unconfirmed draft from Career Ops. The agent reads the Career Ops profile and CV, asks only for missing scan-specific rules, and shows a plain-language summary before writing.

The extension profile contains search terms and eligibility rules. It must not contain the candidate's email, phone number, full CV, narrative, or proof points.

## 3. Validate without email

The agent runs these commands from the extension:

```bash
npm run doctor -- --career-ops-root ../..
npm test
npm run smoke
```

Expected behavior:

- diagnostics detect the Career Ops root;
- the extension profile says `configured: true`;
- all tests pass;
- the smoke run is bounded and explicitly says no email was sent.

Zero recommendations can be a valid result. Review source coverage and rejection reasons before widening rules.

## 4. Configure Resend

Follow [RESEND.md](RESEND.md). Do not put the key in Career Ops YAML, the extension profile, an issue, or an agent conversation.

Validate the local secret without printing it:

```bash
npm run doctor -- --email --career-ops-root ../..
```

Send one email only when intended:

```bash
npm run scan -- --send
```

## 5. Move the Career Ops workspace to a private GitHub repository

The live profile, CV, state, report, and workflow reveal job-search activity. Confirm the destination repository is private before pushing.

The extension profile is ignored by default. Add it deliberately only to the private repository:

```bash
git add -f extensions/career-intelligence-workflow/config/profile.yml
git add extensions/career-intelligence-workflow/package-lock.json
```

Do not commit `.env`.

## 6. Install and test the workflow

From the extension:

```bash
npm run workflow:install -- --root ../..
```

Then follow [AUTOMATION.md](AUTOMATION.md) to add secrets, run `guard-only` without scanning or emailing, test one deliberate delivery, inspect its saved state, and only then retain the recurring schedule.

## Updating

The installer does not overwrite an existing extension. Until an automated updater is released, review upstream changes and update the extension deliberately. Preserve the private profile, `.env`, state, and reports, then rerun tests and diagnostics.
