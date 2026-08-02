# Digest modes and coverage

Discovery Digest is the safe starting point. It has a proven zero-token search path and leaves the optional cloud agent disabled. Smart Digest can be enabled later when the user has validated email delivery and accepts model cost and cloud data sharing.

## Discovery Digest

Discovery runs deterministic code in GitHub Actions. It searches the enabled public feeds and rolling ATS directories, normalizes jobs, removes known URLs, applies the reviewed search profile, verifies a bounded shortlist and prepares an email only when recommendations survive.

It currently supports these structured lanes:

- Platsbanken JobStream;
- Arbeitnow;
- The Hub;
- Welcome to the Jungle;
- Jobicy;
- Himalayas;
- Remotive;
- Remote OK;
- Greenhouse, Lever, Ashby and Workday rolling company boards.

The ATS directories contain too many companies to query in every run. Discovery scans a bounded shard, saves a cursor and moves through the directory over time. A board that produced a recommendation can be checked earlier in later runs.

Workday endpoints vary more than the other supported ATS families and may fail across a complete shard. The receipt must expose that result while other lanes continue.

### What it can and cannot see

| Example | Discovery result | Reason |
|---|---|---|
| A fresh role in a Greenhouse board reached by this run's shard | Likely found | The board exposes a supported structured endpoint. |
| A Platsbanken role with an exact publication timestamp | Likely found and labelled verified fresh | JobStream exposes structured time data. |
| A LinkedIn-only result | May be missed | Discovery does not sign in to or crawl LinkedIn. |
| An Indeed result whose employer listing is also in Greenhouse | May still be found | The employer ATS provides another route to the same vacancy. |
| A vacancy behind a JavaScript “Load more” page | May be missed | That page needs browser interaction. |
| A supported ATS company outside the current 120-board shard | Not checked in this run | Its turn arrives as the saved cursor rotates. |
| A new role with no timestamp | Considered once as newly discovered | First seen is not presented as proof of posting age. |

The email therefore says “reduced coverage.” It also names structured sources that failed or returned only a partial result. A failed source is not equivalent to a successful source with zero jobs.

Discovery uses zero model tokens. GitHub Actions and Resend are still subject to their account limits.

## Smart Digest

Smart starts with the same deterministic scan. If and only if the private repository variable `CAREER_OPS_AGENT_ENABLED` is `true`, it adds two bounded cloud steps:

1. Codex or Claude Code attempts the Career Ops tracked-company, browser and broad web-search gaps.
2. A separate evaluation pass reads complete descriptions for a capped candidate set.

The search plan can include LinkedIn, Indeed, Glassdoor, Climatebase, Wellfound, Jobbsafari, IamExpat, karriere.at, employer sites and ATS families that are not covered by the zero-token connectors. Each configured lane must return a coverage receipt. Missing or partial lanes appear in the digest and remain marked for catch-up.

Candidates outside the evaluation budget are emailed as unscored. A model score cannot silently hide a structured recommendation. Only explicit evidence such as an expired page, a mandatory unsupported language, an impossible location or an authorization blocker can remove it.

Smart improves coverage but does not recreate a person's signed-in browser. LinkedIn can expose a search result while blocking the full description, and some sites will reject GitHub-hosted traffic. The receipt must show that limitation.

## Freshness language

- **Verified fresh** means the source supplied an exact timestamp inside the configured window.
- **Likely fresh** means the source supplied a current relative signal such as “Posted Today” and the URL was not previously seen.
- **Newly discovered** means the system had not seen the canonical URL before, but the posting time is unknown.

Clearly old timestamped jobs, expired pages, previously seen untimestamped jobs and previously delivered URLs are excluded. “Newly discovered” must never be rewritten as “posted in the last twelve hours.”

## Recommendation

Start with Discovery Digest. Confirm the search profile, run a live no-email scan, validate a positive email fixture and observe source health. Enable Smart only when the extra sources are worth the provider cost and privacy tradeoff.
