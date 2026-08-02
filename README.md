# Career Intelligence Workflow

Twice-daily job discovery and private email digests for [Career Ops](https://github.com/santifer/career-ops).

[![Discovery Digest](https://img.shields.io/badge/default-Discovery_Digest-0F766E)](#choose-a-digest-mode)
[![Model tokens](https://img.shields.io/badge/structured_scan-0_model_tokens-2563EB)](#what-the-zero-token-scan-covers)
[![Tests](https://img.shields.io/badge/tests-35_passing-15803D)](#project-boundaries)

Created by Jai Krishnan Murali from a private Career Ops workflow developed for his own job search, then redesigned as a reusable open-source system with Codex assistance.

## What it does

Career Intelligence runs in GitHub Actions, so the user's computer can be off. Each scheduled run:

1. Searches public job feeds and a rolling selection of employer ATS boards.
2. Normalizes and deduplicates the listings.
3. Applies the user's reviewed role, location, language, seniority and work-authorization rules.
4. Separates exact timestamps, “posted today” signals and untimestamped jobs first discovered in this run.
5. Opens a bounded shortlist to check for expired pages and explicit blockers.
6. Saves the exact email payload before contacting Resend.
7. Emails recommendations only when at least one survives.

A zero-result run is still recorded as successful. It sends no empty email, and the later fallback triggers stop.

## Choose a digest mode

| | Discovery Digest — default | Smart Digest — optional |
|---|---|---|
| Public feeds and ATS endpoints | Yes | Yes |
| Deterministic filtering and ranking | Yes | Yes |
| Model tokens for discovery | 0 | Bounded usage |
| Career Ops browser and broad web-search gaps | No | Attempted by Codex or Claude Code |
| Full-description model evaluation | No | Bounded batch |
| Provider secret required | No | Yes |

The optional model worker is disabled by default with `CAREER_OPS_AGENT_ENABLED=false`. The structured scanner has its own run decision and continues working while the agent is disabled.

### What “reduced coverage” means

Discovery Digest is a real search, but it cannot see every place a person can browse interactively.

- A new Greenhouse, Lever or Ashby vacancy on a board reached by the current rolling shard can be found.
- A Platsbanken, Arbeitnow, The Hub, Welcome to the Jungle, Jobicy, Himalayas, Remotive or Remote OK listing can be found when its feed responds.
- A role visible only in a LinkedIn search result may be missed because Discovery does not crawl LinkedIn or run broad web queries.
- An Indeed or Glassdoor result may be missed unless the same vacancy also appears in a scanned employer feed or ATS board.
- A JavaScript-heavy careers page with a “Load more” button may be missed because it needs a browser.
- A supported ATS company can still be missed in one run because boards are scanned in bounded rotating groups rather than all at once.

Every run records which structured sources completed, partially completed or failed, and the digest names incomplete lanes. A source failure is never described as “no jobs found.”

Smart Digest adds the Career Ops browser and web-search layer for sources such as LinkedIn, regional boards, specialist climate boards and employer pages. It improves coverage, but it still cannot guarantee every vacancy on the internet: sites can require login, block automation, change their pages or hide posting dates.

## Quick start

Career Intelligence is an extension, not a replacement for Career Ops.

### 1. Install and onboard Career Ops

Run this in PowerShell, Terminal or the VS Code terminal:

```powershell
npx @santifer/career-ops init
cd career-ops
```

Open Codex or Claude Code from that folder and complete the Career Ops profile and CV onboarding first.

### 2. Install Career Intelligence

From the Career Ops root:

```powershell
npx --yes github:jaikrishnanmurali/career-intelligence-workflow setup
```

Then tell the agent:

```text
Set up my zero-token 12-hour Discovery Digest.
```

The setup assistant will:

- draft structured search rules from Career Ops;
- show the role, location and language rules for review;
- run checks without emailing anyone;
- help sign in to GitHub;
- create or use a private repository;
- add Resend secrets without asking the user to paste them into chat;
- install the twice-daily workflow only after confirmation.

The generated config starts with `configured: false`. Scheduling should not be enabled until the user has reviewed it and changed that value to `true`.

## What the zero-token scan covers

The structured scanner currently supports:

- Platsbanken JobStream;
- Arbeitnow;
- The Hub;
- Welcome to the Jungle;
- Jobicy;
- Himalayas;
- Remotive;
- Remote OK;
- rolling Greenhouse, Lever, Ashby and Workday company boards.

Large ATS directories are sharded. By default, one run checks up to 120 boards per ATS family, saves a cursor and continues from a later point next time. Boards that previously produced a recommendation can be prioritized. A failure on one source or company board is recorded without cancelling successful lanes.

Workday is the least reliable structured connector in the current implementation. Some or all requested Workday boards can fail in a run; that lane must then be shown as failed or partial, never silently counted as coverage.

Freshness has three honest labels:

- **Verified fresh:** an exact source timestamp is inside the configured lookback window.
- **Likely fresh:** the source says something current such as “Posted Today,” and the URL was not seen before.
- **Newly discovered:** no reliable posting time is available, but the URL was absent from saved state. It is considered once and never described as proven to be twelve hours old.

Previously seen untimestamped jobs, expired pages, already delivered URLs and explicit hard blockers are suppressed.

## Reliability design

Each morning and evening slot has three staggered GitHub triggers. They share one logical slot ID, so they are retries rather than three separate scans.

Before Resend is called, the exact subject, text, HTML, recipients, payload hash and stable delivery key are saved to a dedicated state branch. A retry reuses that saved payload without rescanning. A delivered slot cannot be forced to send again, and a Resend error is not treated as proof that an email arrived.

Runtime state is kept off the default branch. The state branch contains only an explicit allowlist of scan state, reports and Career Ops history needed for continuity.

## Optional Smart Digest

Smart Digest is for users who accept provider cost and cloud data sharing in exchange for broader discovery and full-description judgment.

It adds two isolated jobs:

1. A bounded discovery worker attempts the tracked-company and broad web-search gaps defined by Career Ops.
2. A bounded evaluator reviews complete descriptions for the newest candidates.

The worker receives no Resend key and no persisted Git credentials. A clean runner validates its structured output before another clean runner prepares and sends the email. Candidates beyond the evaluation cap remain visible as unscored rather than disappearing.

To enable it, the user must deliberately choose `digest.mode: smart`, add the selected provider credential and set the private repository variable `CAREER_OPS_AGENT_ENABLED=true`.

See [Digest modes](docs/DIGEST_MODES.md), [Agent integrations](docs/AGENT_INTEGRATIONS.md) and [Privacy](docs/PRIVACY.md).

## Useful commands

Run these from `extensions/career-intelligence-workflow` inside the private Career Ops repository:

```powershell
npm run doctor
npm run smoke
npm run scan:structured
npm run status
npm run pause
npm run resume
```

`scan:structured` performs live network discovery but does not send email. The GitHub workflow remains the supported path for scheduled state restoration, durable delivery and retries.

## Project boundaries

Career Intelligence can find and recommend jobs. It does not submit applications, fill forms, contact employers, tailor CVs or change the Career Ops application tracker.

The first public version supports one person per private deployment. It is not a shared multi-user service, and the ChatGPT website cannot run the installation commands. Use Codex CLI/Desktop or Claude Code from the Career Ops folder.

AI assisted the project's development and documentation. The zero-token claim applies to the structured Discovery scan. Smart Digest intentionally uses bounded model calls.

## Documentation

- [Setup](docs/SETUP.md)
- [Digest modes and coverage](docs/DIGEST_MODES.md)
- [Automation](docs/AUTOMATION.md)
- [Career Ops integration](docs/CAREER_OPS_INTEGRATION.md)
- [Resend](docs/RESEND.md)
- [Privacy](docs/PRIVACY.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Architecture](docs/architecture.md)

MIT licensed. Maintained mainly by Jai Krishnan Murali.
