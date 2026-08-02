---
name: career-intelligence
description: Configure and operate the Career Ops scheduling and email companion. Use for Smart or Discovery Digest setup, coverage receipts, Resend delivery, private GitHub Actions deployment, diagnostics, and handoff of selected jobs to Career Ops. Do not use it to apply or tailor a CV.
---

# Career Intelligence companion

Use the smallest matching mode:

- Setup or change deployment: read `modes/onboard.md`.
- Run, preview or inspect a digest: read `modes/scan.md`.
- Explain a result or coverage gap: read `modes/explain.md`.
- Install or deploy: read `modes/integrate-career-ops.md`.
- Check or apply updates: read `modes/update.md`.

Always enforce these rules:

1. Require supported, onboarded Career Ops. Its profile, CV, portals and application workflow remain canonical.
2. Default to zero-token Discovery Digest with the model worker disabled. It must run the official Career Ops scanner first, then supplemental sources. Offer Smart only after structured scanning, optional alert intake and the email path have been validated.
3. Explain with examples that an alert from LinkedIn, Indeed, Glassdoor, Jobbsafari, IamExpat, karriere.at, Climatebase or Wellfound is a discovery lead, not proof that a complete job specification was evaluated. Discovery does not sign in to or crawl those platforms.
4. Draft deterministic search rules from Career Ops, show them to the user and require confirmation. Do not invent terms or silently treat the draft as complete.
5. Do not ask for credentials in chat. Use ignored local files or GitHub secrets.
6. Run tests and diagnostics before installing the private workflow. Ask before enabling it or sending a real email.
7. Never claim all jobs were found. Report the per-source coverage receipt and every partial, unconfigured or failed lane.
8. Send no empty recommendation email. Email unscored Smart overflow; a model score cannot hide a structured recommendation.
9. Hand selected URLs to Career Ops. Never duplicate its application pipeline, tailor material, edit its tracker or submit anything.

During setup, the agent is the guide. Announce `Stage N of 8`, explain the next action in plain language, run safe commands for the user, summarize the result, and ask only the next necessary question. Use the persisted setup progress to resume interrupted work. Do not dump the whole setup manual into chat.

The installer adds digest, alert-intake and compatibility-watch workflows. Upstream changes are reported, never auto-applied; use `modes/update.md` for a paused, backed-up and validated update.
