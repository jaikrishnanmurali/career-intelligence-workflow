# Roadmap

Career Intelligence Workflow is a portfolio-led open-source Career Ops companion maintained by Jai Krishnan Murali.

## Current

- One-command installation into an onboarded Career Ops workspace.
- Deterministic import of role and location foundations without contact data.
- Conversational confirmation of search-specific rules through Codex or Claude.
- Official Career Ops structured discovery plus supplemental public feeds and rolling Greenhouse, Lever, Ashby, and Workday boards.
- Optional Resend intake for verified alerts from eight broader job platforms, with full-spec resolution and a manual-review fallback.
- Exact, relative, and newly-discovered freshness evidence.
- Hard eligibility filters, ranking cautions, saved state, and Resend digests.
- Timezone-safe twice-daily private GitHub Actions workflow with retry slots, three-hour alert intake and a weekly compatibility watch.
- Zero model calls in the scheduled scanner.

## Next

- Publish a shorter versioned npm command after the GitHub installer is validated by external users.
- Turn the guided, state-preserving update mode into a versioned non-interactive updater after external migration testing.
- Expand compatibility fixtures when newer Career Ops releases are validated.
- Improve provider health reporting and multilingual language-requirement fixtures.
- Add a dry-run deployment audit that verifies private-repository assumptions before installing the workflow.

## Out of scope

- Rebuilding Career Ops candidate onboarding, CV generation, evaluation, or tracking.
- Automatic application submission or employer messaging.
- Replacing the deterministic core with an unbounded model-driven scan.
- Scraping behind authentication or bypassing access controls.
- Public storage of candidate profiles, CVs, reports, or search history.
