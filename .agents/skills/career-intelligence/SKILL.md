---
name: career-intelligence
description: Configure and operate the Career Intelligence email and job-discovery companion inside an onboarded Career Ops workspace. Use when a user asks to set up a recurring job digest, run or inspect the deterministic scan, explain a recommendation, configure Resend, install the private GitHub Actions schedule, or hand a selected job back to Career Ops. Do not use it to apply or tailor a CV.
---

# Career Intelligence companion

Use the smallest matching mode:

- Set up or change the digest profile: read `modes/onboard.md`.
- Run a scan, preview a digest, or inspect results: read `modes/scan.md`.
- Explain why a job passed or failed: read `modes/explain.md`.
- Install or deploy the extension: read `modes/integrate-career-ops.md`.

Always enforce these rules:

1. Require a completed Career Ops `config/profile.yml` and `cv.md`.
2. Reuse Career Ops evidence. Ask only for missing search-automation details.
3. Keep the extension profile marked `configured: false` until the user confirms the interpreted rules.
4. Do not ask for API keys in chat. Configure Resend through ignored local files or GitHub secrets.
5. Run a no-email smoke scan before offering email or scheduling.
6. Ask before sending a real email or installing a recurring workflow.
7. Keep exact, relative, and unknown freshness evidence separate.
8. Hand selected URLs to Career Ops; never duplicate its evaluation or application workflow.
9. The scheduled scanner uses zero model API tokens. Agent onboarding does not.
