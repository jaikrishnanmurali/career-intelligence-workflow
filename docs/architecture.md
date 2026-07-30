# Architecture

## Design goals

The workflow is designed around five constraints:

1. Search several independent discovery lanes.
2. Keep freshness evidence separate from “new to my records.”
3. Reject hard blockers before ranking soft fit.
4. Preserve state so untimestamped jobs are not repeatedly recommended.
5. Use deterministic logic at runtime, avoiding paid model calls.

## Processing sequence

1. Read the previous private state, or create an empty state.
2. Fetch direct public feeds and rolling employer ATS-board shards.
3. Normalize titles, locations, descriptions, URLs, and timestamps.
4. Canonicalize URLs and remove duplicates.
5. Classify freshness as verified, likely, or newly discovered.
6. Apply title, location, language, authorization, and role-family gates.
7. Inspect a bounded set of promising live pages.
8. Rank the surviving roles and generate the digest.
9. Save the run state in a private deployment.

## Freshness model

- **Verified:** An exact timestamp or reliable relative age proves the role is
  inside the configured lookback window.
- **Likely:** Evidence such as “posted today” is useful but not exact.
- **Newly discovered:** The live vacancy exposes no useful time, but its URL was
  absent from prior state. It is surfaced once with that limitation stated.

“Newly discovered” never claims that the employer posted the role recently.

## Failure handling

Individual feeds and employer boards may fail, throttle, or change shape. The
scanner records source-level failures and continues with the remaining lanes.
Sources that do not expose enough description data are treated conservatively
when a live page cannot be verified.

## Public and private boundaries

The public repository contains code, tests, examples, and a manual bounded
workflow. A private deployment may additionally contain:

- personal role and location preferences;
- real search state and source cursors;
- live recommendations;
- email addresses and encrypted Actions secrets;
- an enabled recurring workflow.

