# GitHub Actions automation

The installed workflow runs from a private Career Ops repository while the user's computer is off. Discovery Digest is the default. Smart Digest uses the same file with an explicit mode and feature flag.

## Run order

1. Check out the private default branch and refuse a public repository.
2. Restore allowlisted scanner, Career Ops and delivery state from `career-intelligence-state`.
3. Check pause, snooze, hired outcome and logical-slot state.
4. Run the zero-token public-feed and rolling ATS scanner whenever `should_run=true`.
5. Save structured candidates, source receipts, cursors and seen history.
6. If `agent_should_run=true`, run the isolated Smart discovery and evaluation jobs.
7. On a clean runner, validate any model output and merge it with structured candidates.
8. Build the exact Resend payload and save it to the state branch.
9. If recommendations exist, send only that saved payload and save the receipt.
10. If none exist, record `no-recommendations`, send nothing and close the slot.

The gate has separate `should_run` and `agent_should_run` outputs. `CAREER_OPS_AGENT_ENABLED=false` prevents model work but never prevents structured discovery.

## State branch

Fresh GitHub runners have no memory. Without durable state, an untimestamped vacancy could look new on every run and ATS sharding would restart from the first board.

The dedicated branch stores only an allowlist, including:

- scanner seen URLs, sent identities, ATS cursors and priority boards;
- logical runs, pause state and durable outbox entries;
- source plans, coverage receipts and prepared candidates;
- Career Ops scan history and pipeline files used by Smart integration;
- the latest digest report.

The branch is private and is not merged into the default branch.

## Retry slots

Each morning and evening slot has three triggers:

| Slot | Attempt 1 | Attempt 2 | Attempt 3 |
|---|---:|---:|---:|
| Morning | 07:23 | 07:43 | 08:03 |
| Evening | 19:23 | 19:43 | 20:03 |

The cron entries are UTC. The configured timezone determines the local slot date and email display, not GitHub's trigger clock.

- A delivered slot stops.
- A zero-result completed slot stops.
- A prepared slot resumes the exact saved email without scanning.
- A new slot starts discovery.
- A different recent successful slot respects the minimum gap.

The Resend idempotency key is scoped to the repository and slot. A 409 or any other non-2xx response remains an error unless a delivery receipt already exists.

## Secrets and variables

Discovery requires:

```text
RESEND_API_KEY
CAREER_DIGEST_FROM
CAREER_DIGEST_TO
```

Smart with Codex also requires `OPENAI_API_KEY`. Smart with Claude Code also requires `CLAUDE_CODE_OAUTH_TOKEN`.

Smart additionally requires this private repository variable:

```text
CAREER_OPS_AGENT_ENABLED=true
```

Use `gh secret set NAME` and `gh variable set NAME --body VALUE`. Never place a key in YAML, a commit, an issue or a chat.

## Safe validation

Run `guard-only` first. It makes no network scan and sends no email. Then run one manual `run`, inspect the source receipt and verify both positive and zero-result behavior before relying on the schedule.

## Stopping

Use the manual pause control, disable the workflow in GitHub Actions, or remove `.github/workflows/career-intelligence.yml`. The private state branch remains until the user deliberately archives or deletes it.
