# Career Ops integration

Career Ops is the required career and application foundation. Career Intelligence adds unattended execution of Career Ops discovery, supplemental sources, platform-alert intake, stateful retries and email delivery.

## Career Ops owns

- the complete candidate profile and CV;
- narrative experience rules and evidence;
- portal and broad-search instructions;
- interactive evaluation and tailoring;
- shortlist, tracker, outcomes and application work.

## Career Intelligence owns

- scheduling the official Career Ops structured scanner before every eligible digest;
- supplemental public-feed and rolling ATS discovery;
- normalized alert intake for the selected broader platforms;
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

The scheduled core invokes Career Ops `scan.mjs` first. Career Intelligence then runs its supplemental public-feed and rolling ATS scanner and adds any verified normalized alert leads. These steps do not consume model tokens. Browser interaction and adaptive broad web search are still omitted and must be reported as reduced coverage.

Platform alerts do not bypass Career Ops evaluation standards. A lead must resolve to a complete, live employer or ATS specification before it can be automatically evaluated or recommended. Unresolved leads remain visible as manual review work.

## Smart mode

Smart mode starts with the same deterministic result. A bounded agent then follows Career Ops search instructions for tracked-company and broad web-search gaps. Validated discoveries are appended through Career Ops helpers so URL history and `jd_fingerprint` remain compatible. A second bounded pass evaluates complete descriptions.

The structured scanner remains eligible even when Smart is disabled or the model worker fails.

## Version contract

This release supports the validated Career Ops 1.22.x–1.24.x range and checks the nine-column `data/scan-history.tsv` schema before scanning. A weekly workflow reports upstream releases but never applies one automatically. The guided updater pauses, backs up, updates and validates before the user resumes the digest. A schema change fails closed instead of silently corrupting history.
