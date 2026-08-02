# Career Ops integration

Career Ops is the required career and application foundation. Career Intelligence adds unattended structured discovery, stateful retries and email delivery.

## Career Ops owns

- the complete candidate profile and CV;
- narrative experience rules and evidence;
- portal and broad-search instructions;
- interactive evaluation and tailoring;
- shortlist, tracker, outcomes and application work.

## Career Intelligence owns

- scheduled public-feed and rolling ATS discovery;
- the reviewed machine-readable scan projection;
- deterministic normalization, filtering, freshness and ranking;
- bounded live-page checks;
- source coverage receipts and health history;
- logical-slot retries, durable outbox state and Resend delivery;
- optional isolated Codex or Claude Code gap discovery and evaluation.

## Why a scan projection exists

Career Ops can reason over prose in a profile and CV. A zero-token scanner cannot. Setup therefore drafts explicit title terms, responsibility terms, location groups, language blockers and seniority weights from Career Ops.

The user must review that draft. It is not a second CV, and it must not contain invented experience. When Career Ops goals change, regenerate or edit the projection and confirm it again before scheduling.

## Installation layout

The supported layout is:

```text
career-ops/
  config/profile.yml
  cv.md
  portals.yml
  extensions/
    career-intelligence-workflow/
      config/profile.yml
```

Run Codex or Claude Code from the Career Ops root so the parent instructions are loaded before the namespaced extension skill.

## Discovery mode

The scheduled core is `scripts/run-structured-scan.mjs`. It does not invoke Career Ops `scan.mjs` and does not consume model tokens. It searches the configured feed and ATS connectors and reports the browser and broad-search layers it did not run.

## Smart mode

Smart mode starts with the same deterministic result. A bounded agent then follows Career Ops search instructions for tracked-company and broad web-search gaps. Validated discoveries are appended through Career Ops helpers so URL history and `jd_fingerprint` remain compatible. A second bounded pass evaluates complete descriptions.

The structured scanner remains eligible even when Smart is disabled or the model worker fails.

## Version contract

This release supports Career Ops 1.24.x and validates the nine-column `data/scan-history.tsv` schema before using Smart integration. A schema change fails closed instead of silently corrupting history.
