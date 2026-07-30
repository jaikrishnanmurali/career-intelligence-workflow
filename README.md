<p align="center">
  <img src="docs/hero.webp" alt="Career Intelligence Workflow - job signals become a focused email digest" width="100%">
</p>

<p align="center">
  <img alt="Career Ops companion" src="https://img.shields.io/badge/built_for-Career_Ops-2563EB">
  <img alt="Zero model tokens" src="https://img.shields.io/badge/scheduled_runtime-0_model_tokens-0F766E">
  <img alt="Privacy first" src="https://img.shields.io/badge/deployment-private-0369A1">
  <img alt="Node 22 or newer" src="https://img.shields.io/badge/node-%3E%3D22-339933?logo=nodedotjs&logoColor=white">
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-64748B"></a>
</p>

# Career Intelligence Workflow

Always-on job discovery and email recommendations for [Career Ops](https://github.com/santifer/career-ops).

Career Ops already knows the candidate: their CV, career story, target roles, evidence, and application workflow. Career Intelligence adds the missing delivery layer. It runs a deterministic scan in GitHub Actions, remembers what it has seen, and emails a focused Resend digest every 12 hours while the user's computer is off.

The scheduled scanner uses **zero model API tokens**. Codex or Claude can help with setup, but no agent runs inside the scheduled decision path.

**Created by Jai Krishnan Murali from a private Career Ops workflow developed for his own job search, then redesigned as a reusable open-source system with Codex assistance.**

## Quick start

Career Intelligence requires an onboarded Career Ops workspace. If you are new to Career Ops:

```bash
npx @santifer/career-ops init
cd career-ops
```

Open Codex or Claude there and complete the Career Ops onboarding first. When `config/profile.yml` and `cv.md` are ready, run this from the Career Ops root:

```bash
npx --yes github:jaikrishnanmurali/career-intelligence-workflow init
```

Then reopen your agent from the Career Ops root and say:

```text
Set up my 12-hour Career Intelligence job digest.
```

The installer creates `extensions/career-intelligence-workflow`, imports a private draft from the Career Ops profile, installs namespaced Codex and Claude adapters, and installs the scanner dependency. It does **not** send email or enable a schedule.

## What the setup conversation does

The agent reuses Career Ops instead of asking the user to rebuild their profile. It asks only for scan-specific gaps:

- adjacent titles and responsibility signals;
- titles to exclude and whether manager roles should rank lower;
- directly relevant and total adjacent experience;
- ordered locations and hard location exclusions;
- languages that become blockers only when a posting makes them mandatory;
- confirmation of the 12-hour lookback and twice-daily cadence.

It shows the interpreted rules in plain language before writing them. The profile remains `configured: false` until the user confirms it. Then the agent runs diagnostics, tests, and a bounded scan that sends no email.

## What the extension adds

| Career Ops provides | Career Intelligence adds |
| --- | --- |
| Candidate profile, CV, evidence, target roles | Search-specific rules imported from that foundation |
| Interactive portal scanning and evaluation | Unattended rolling discovery across public feeds and ATS boards |
| CV tailoring, reports, tracker, application workflow | Freshness checks, deterministic ranking, saved state, Resend digest |
| Agent reasoning when the user chooses a role | Zero-model-token scheduled runtime every 12 hours |

When the user selects a recommendation, its URL and evidence summary return to Career Ops for evaluation and any later CV work. Career Intelligence never applies, fills a form, edits the tracker, or contacts an employer.

## What a scheduled run does

1. Searches independent public feeds and rolling Greenhouse, Lever, Ashby, and Workday boards.
2. Normalizes and deduplicates listings.
3. Separates exact freshness evidence from weaker signals.
4. Filters hard title, location, language, authorization, and expiry blockers.
5. Applies configurable experience and manager cautions.
6. Verifies a bounded set of live pages.
7. Emails only recommendations that have not already been sent.
8. Saves private state for the next run.

One broken source is recorded without stopping the other lanes.

### Freshness stays honest

- **Verified:** an exact source timestamp is inside the configured lookback.
- **Likely:** the source says something relative such as "posted today," but the exact age is unknown.
- **Newly discovered:** the live URL is absent from saved state and exposes no reliable posting time.

`newly_discovered` never means "provably posted within the last 12 hours." It appears once and is then suppressed by saved state.

## Add email and cloud scheduling

Only after the no-email scan passes:

1. Configure a sending-only Resend key using [the Resend guide](docs/RESEND.md). For a personal digest sent to the Resend account email, no domain or live website is required.
2. Put the Career Ops workspace in a **private** GitHub repository.
3. Add the three documented GitHub Actions secrets.
4. From the extension directory, install the workflow only after reviewing it:

```bash
cd extensions/career-intelligence-workflow
npm run workflow:install -- --root ../..
```

5. Commit the private profile, workflow, and generated package lock to the private repository.
6. Run the workflow manually once before relying on its schedule.

See [the automation guide](docs/AUTOMATION.md) for the exact commands and checks.

## Privacy boundary

The public repository contains code, fictional fixtures, and empty example state. A real deployment belongs inside the user's private Career Ops repository. The importer copies target-role and location foundations but deliberately omits contact data, CV text, narrative, and proof points.

Resend credentials and email addresses belong in an ignored `.env` for local testing or GitHub Actions secrets for cloud delivery. Never paste an API key into agent chat or commit it.

Read [the privacy model](docs/PRIVACY.md) and [security policy](SECURITY.md) before enabling automation.

## Repository map

```text
career-ops/
|-- config/profile.yml                   # Career Ops candidate source of truth
|-- cv.md                                # Career Ops CV source of truth
|-- .agents/skills/career-intelligence/  # installed Codex adapter
|-- .claude/skills/career-intelligence/  # installed Claude adapter
`-- extensions/
    `-- career-intelligence-workflow/
        |-- config/profile.yml            # private search-only additions
        |-- src/                          # deterministic scan and email code
        |-- state/                        # private seen-job history
        |-- reports/                      # private latest result
        `-- modes/                        # setup, scan, explain, deploy instructions
```

## Documentation

- [Complete setup](docs/SETUP.md)
- [How it uses Career Ops](docs/CAREER_OPS_INTEGRATION.md)
- [Resend email](docs/RESEND.md)
- [GitHub Actions automation](docs/AUTOMATION.md)
- [Codex and Claude](docs/AGENT_INTEGRATIONS.md)
- [Privacy](docs/PRIVACY.md)
- [Architecture](docs/architecture.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

## Project relationship

Career Intelligence Workflow is independently maintained by Jai Krishnan Murali. It requires and acknowledges [Career Ops](https://github.com/santifer/career-ops), created by Santiago Fernandez de Valderrama. It is not affiliated with or endorsed by the Career Ops maintainer.

AI assisted development and documentation. The scheduled recommendation path itself contains no model call.

## License

This project is available under the [MIT License](LICENSE). Career Ops and job-data providers remain subject to their own licenses and terms.
