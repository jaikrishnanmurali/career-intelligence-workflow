# Roadmap

Career Intelligence Workflow is currently a portfolio-led open-source project maintained by Jai Krishnan Murali. The roadmap protects the small, deterministic core before adding surface area.

## Current release

- Generic YAML search profile with validation.
- Public feeds and rolling Greenhouse, Lever, Ashby, and Workday discovery.
- Exact, relative, and newly-discovered freshness evidence.
- Language, location, authorization, expiry, manager, and experience rules.
- Stateful deduplication and Resend email delivery.
- Manual and twice-daily GitHub Actions workflows.
- Shared Codex and Claude Code skill.
- Optional Career Ops handoff.
- Zero model calls in the scheduled scanner.

## Next

- Provider health telemetry and clearer per-source coverage reports.
- More regression fixtures for multilingual hard-requirement wording.
- A profile migration command for future YAML schema versions.
- A safe configuration form that produces YAML without storing candidate data.
- Release packaging and a one-command installer after the template workflow is proven with external users.

## Deliberately out of scope

- Automatic application submission.
- Recruiter messaging or outreach automation.
- Hidden model-based ranking in scheduled runs.
- Scraping behind authentication or bypassing access controls.
- Storing CVs or full application histories in the public repository.
- Reimplementing Career Ops' CV and application workflow.

Feature requests should explain the user problem, the privacy impact, and whether the behavior can remain deterministic and testable.