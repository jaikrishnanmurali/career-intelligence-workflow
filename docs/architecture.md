# Architecture

## System boundary

```text
Career Ops profile + CV
          |
          v
deterministic profile importer
          |
          v
confirmed search-only profile
          |
          v
public feeds + rolling ATS boards
          |
          v
normalize -> freshness -> hard gates -> live verification -> rank
          |                                                    |
          v                                                    v
private state                                             private report
                                                               |
                                                               v
                                                         Resend digest
                                                               |
                                                               v
                                                    user selects a job URL
                                                               |
                                                               v
                                                       Career Ops evaluates
```

Career Ops owns candidate context and application work. The extension owns the unattended recommendation and email path.

## Profile import

The installer reads Career Ops `config/profile.yml` and imports target roles, archetype fit, city, country, and authorized locations. It excludes contact data, CV content, narrative, and proof points.

Imported data is insufficient for a safe scan, so the draft remains `configured: false`. Agent onboarding collects only search-specific gaps and requires a plain-language confirmation before setting it to true.

## Scheduled processing

1. Read private extension state.
2. Fetch independent public feeds and rolling employer ATS shards.
3. Normalize titles, locations, descriptions, URLs, and timestamps.
4. Canonicalize and deduplicate URLs.
5. Classify freshness as verified, likely, or newly discovered.
6. Apply configured title, location, language, authorization, and role-family rules.
7. Inspect a bounded set of promising live pages.
8. Apply experience and manager cautions and deterministic ranking.
9. Generate the private report and optional Resend digest.
10. Save state so untimestamped jobs are not emailed repeatedly.

## Failure isolation

Feeds and employer boards can throttle, fail, or change shape. Source failures are recorded while remaining lanes continue. Runtime, board count, and live-page verification are bounded.

Delivery slots use an initial GitHub Actions attempt and two delayed retries. Each attempt checks out the latest default-branch state before the guard runs. Saved slot history stops later scans after delivery; a stable Resend idempotency key protects the same slot when delivery succeeded but the state commit did not.

## Zero-model runtime

The scheduled path consists of Node.js modules, YAML, JSON state, GitHub Actions, and the Resend HTTPS API. There is no model SDK or model request in `src/`.

Career Ops and an interactive agent remain available after the user chooses a recommendation. They are not invoked by the schedule.
