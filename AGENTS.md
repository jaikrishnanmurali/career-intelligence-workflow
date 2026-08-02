# Career Intelligence Workflow

## Purpose

This repository is the scheduled discovery and email layer for Career Ops. Career Ops owns the CV, full career context, tailoring, tracker and application workflow. This extension owns the unattended structured scanner, its reviewed machine-readable search rules, delivery state and email.

## Foundation rule

- For any setup or installation request, read `docs/ONBOARDING.md` completely and run its eight-stage conversation one stage at a time. If Career Ops is missing, offer to run its official initializer and complete its onboarding before installing this extension.
- Career Ops 1.22.x through 1.24.x is supported only while its validated scan-history contract remains unchanged. Do not present this project as a standalone career system.
- The supported layout is `career-ops/extensions/career-intelligence-workflow/`.
- Start Codex or Claude Code from the Career Ops root and read its instructions first.
- Career Ops `config/profile.yml`, `cv.md`, `portals.yml`, `modes/scan.md` and `data/scan-history.tsv` remain source-of-truth context for interactive work and the optional Smart layer.
- Setup derives a deterministic scan profile from Career Ops. The user must review and confirm its role terms, locations and language rules before scheduling. Do not hard-code one person's profile in source files.

## Discovery and recommendation boundary

- Run the official Career Ops `scan.mjs` first as the canonical structured pass, followed by `scripts/run-structured-scan.mjs` for supplemental public feeds and rolling Greenhouse, Lever, Ashby and Workday boards. Both passes use zero model tokens.
- Discovery Digest stops after that core and must be labelled reduced coverage. State plainly that LinkedIn-only, alert-only, search-index-only and browser-only jobs may be missed, with examples.
- Smart Digest may use one bounded Codex or Claude Code worker for uncovered Career Ops browser and broad web-search sources, then one bounded full-description evaluation pass.
- Treat LinkedIn, Indeed, Glassdoor, Jobbsafari, IamExpat, karriere.at, Climatebase and Wellfound alerts as leads. Require a complete live specification before automatic evaluation. Email an unresolved new lead once in a separate manual-check section; never label it a recommendation.
- Do not invoke the full Career Ops application pipeline on a schedule.
- The structured scanner owns feed normalization, canonical URL deduplication, freshness tiers, configurable filtering, bounded verification and deterministic ranking. Smart discoveries still reuse Career Ops history and `jd_fingerprint`.
- Every enabled source must receive a coverage receipt. Missing, partial and failed sources must be visible and marked for catch-up.
- A model score must never hide a structured recommendation. Email every new non-hard-blocked recommendation, including evaluation overflow as unscored.
- Use a hard blocker only for explicit evidence such as an expired listing, mandatory unsupported language, impossible work location or incompatible authorization.
- Unknown posting time is not itself a blocker. Say that the exact time is unavailable.

## Delivery and state

- Save the exact email payload to the dedicated state branch before calling Resend.
- Retrying a prepared slot must reuse that payload and stable idempotency key without rescanning.
- A delivered slot cannot be forced to send again.
- Treat every non-2xx Resend response, including 409, as an error unless an independently saved delivery receipt already exists.
- A successful zero-result run sends no email, records `no-recommendations` and closes the logical slot so retries stop.
- Persist only the allowlisted Career Ops history and extension state files. Never push runtime state to the default branch.
- Install alert-intake, digest and compatibility-watch workflows with one shared state-writer lock. Report upstream updates, but never auto-apply them to a live workspace.

## Privacy and consent

- A live deployment must use a private GitHub repository.
- Never ask for an API key in chat, print a secret or commit `.env`.
- Keep Resend sending and receiving on separate keys. Never persist raw inbound email or publish the receiving address.
- Smart Digest sends private Career Ops and job context to the selected provider. Obtain explicit consent and explain model cost before enabling it.
- Never submit an application, fill a form, message an employer, tailor a CV or edit the Career Ops tracker through this extension.
- Public examples and tests must be fictional.

## Development

- Node.js 22 or newer is required.
- Pin and validate the supported Career Ops version and nine-column scan-history schema; fail closed on change.
- Test coverage receipts, schema validation, deduplication, unscored overflow, durable outbox behavior, schedule guards, secret safety and Resend failures.
- Run `npm test` and `npm run doctor` before release.

## Attribution

Created by Jai Krishnan Murali from a private Career Ops workflow developed for his own job search, then redesigned as a reusable open-source system with Codex assistance.
