# Architecture

## Design goals

The workflow is built around six constraints:

1. Search several independent discovery lanes.
2. Keep exact freshness evidence separate from “new to my records.”
3. Reject hard blockers before ranking soft fit.
4. Treat experience and manager signals with nuance instead of blunt title matching.
5. Preserve state so untimestamped jobs are not repeatedly recommended.
6. Use deterministic logic at runtime, avoiding model API calls.

## Components

```text
config/profile.yml
        │
        ▼
public feeds + ATS directories
        │
        ▼
src/sources.mjs ── fetch, normalize, isolate failures
        │
        ▼
src/ranking.mjs ─ freshness, gates, verification, score
        │                         │
        ▼                         ▼
state/state.json           reports/latest.json
                                  │
                                  ▼
                           src/email.mjs → Resend
```

`src/config.mjs` loads and validates the private YAML profile. If no private profile exists, it loads the fictional example and exposes that fact to `npm run doctor`.

## Processing sequence

1. Read the previous private state, or create empty state.
2. Fetch direct public feeds and rolling employer ATS-board shards.
3. Normalize titles, locations, descriptions, URLs, and timestamps.
4. Canonicalize URLs and remove duplicates.
5. Classify freshness as verified, likely, or newly discovered.
6. Apply title, location, language, authorization, and role-family gates.
7. Inspect a bounded set of promising live pages.
8. Apply manager and experience cautions and deterministic ranking.
9. Generate the report and optional digest.
10. Save private run state.

## Freshness model

- **Verified:** An exact timestamp is inside the configured lookback.
- **Likely:** Relative evidence such as “posted today” is current enough to review once but cannot prove an exact age.
- **Newly discovered:** The live vacancy exposes no useful time, but its URL was absent from prior state. It is surfaced once with that limitation stated.

“Newly discovered” never claims that the employer posted the role recently.

## Experience model

The profile separates directly relevant `core_years` from `total_years_including_adjacent`.

- At or below core: no penalty.
- Above core but within total: small caution and score adjustment.
- Above total: stronger stretch caution and bounded score adjustment.

No experience-year signal is a hard rejection. Natural-language extraction can be imperfect, so the digest exposes the caution for human review.

## Failure handling

Individual feeds and employer boards can fail, throttle, or change shape. The scanner records source-level failures and continues with remaining lanes. Sources that do not expose enough description data are treated conservatively when a live page cannot be verified.

Network breadth is bounded by time, board, and live-page budgets. A rolling cursor distributes ATS coverage across runs while priority boards from prior matches remain in the next scan.

## Zero-token boundary

The scheduled path consists of Node.js modules, YAML configuration, JSON state, GitHub Actions, and the Resend HTTP API. There is no model SDK and no model request in `src/`.

Repository skills allow Codex or Claude Code to help a user configure or explain the project. Those conversations are optional and outside the scanner runtime.

## Standalone and Career Ops

Standalone mode owns discovery, ranking, state, and email. The Career Ops adapter installs namespaced skill files that point back to the extension. It does not copy scanner code into Career Ops or modify Career Ops' evaluation system.

The handoff contains a user-selected job URL and evidence summary. Career Ops then follows its own evaluation and CV rules.

## Public and private boundaries

The public repository contains code, tests, fictional examples, agent instructions, and opt-in workflow templates. A private deployment can additionally contain:

- personal role, experience, language, and location preferences;
- real source state and cursors;
- live recommendations;
- email addresses and encrypted Actions secrets;
- an enabled recurring workflow.

See [PRIVACY.md](PRIVACY.md) for the file-level data boundary.