---
name: career-intelligence
description: Configure, run, explain, or integrate the Career Intelligence Workflow, including zero-token job scans, Resend digests, privacy checks, and Career Ops handoff. Use for onboarding, scanning, troubleshooting recommendations, or installing this project alongside Career Ops. Do not use it to submit applications.
---

# Career Intelligence Workflow

Use the smallest mode that matches the request:

- Setup or change a search profile: read `modes/onboard.md`.
- Run a scan or inspect the latest digest: read `modes/scan.md`.
- Explain why a job passed or failed: read `modes/explain.md`.
- Install alongside Career Ops: read `modes/integrate-career-ops.md`.

Always preserve these boundaries:

1. The scheduled scanner is deterministic and uses zero model API tokens.
2. Agent interaction may help configure or explain the system, but it is outside the scheduled runtime.
3. Never submit applications, fill forms, contact employers, or imply that the tool did.
4. Never expose or commit a real profile, email address, API key, report, or scan state.
5. Never describe `likely` or `newly_discovered` roles as provably posted inside the lookback window.
6. Ask before sending a real email or enabling a recurring workflow.
7. In a Career Ops installation, stop after handing the selected job URL to its evaluation pipeline.

Use `npm run doctor` after configuration changes and `npm test` after code changes. Use `npm run smoke` for a bounded live-source check that sends no email.