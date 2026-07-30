# Career Intelligence Workflow

## Purpose

This repository is an email and always-on discovery companion for Career Ops. Career Ops owns the candidate profile, CV, application evaluation, tailoring, tracker, and later-stage workflow. This extension imports that foundation, adds a deterministic job scan, and sends a private recommendation digest through Resend.

## Foundation rule

- Career Ops is required. Do not present or configure this project as a standalone career system.
- The supported layout is `career-ops/extensions/career-intelligence-workflow/`.
- Start Codex or Claude from the Career Ops root. Read the root Career Ops instructions before this extension's mode files.
- Treat Career Ops `config/profile.yml` and `cv.md` as the candidate source of truth. Store only search-specific additions in this extension's private `config/profile.yml`.

## Product boundary

- Discover, normalize, verify, rank, deduplicate, and email job recommendations.
- Keep `verified`, `likely`, and `newly_discovered` freshness evidence distinct.
- Never submit an application, fill a form, message an employer, tailor a CV, or modify the Career Ops tracker.
- When the user selects a recommendation, hand its URL and evidence summary to Career Ops.
- The scheduled runtime must remain deterministic and make no model API calls.

## Privacy and consent

- Never commit `.env`, credentials, email addresses, a real extension profile, live reports, previews, or scan state to the public source repository.
- A live Career Ops deployment and its workflow must be private.
- Never ask for an API key in chat, print a secret, send a real email, or install a recurring workflow without explicit confirmation.
- Public examples and tests must be fictional.

## Development

- Node.js 22 or newer is required by this extension.
- Keep model SDKs and model calls out of `src/`.
- Add tests for installer, profile import, freshness, ranking, privacy, and email changes.
- Run `npm test`, `npm run doctor`, and a bounded `npm run smoke` before release.

## Attribution

Created by Jai Krishnan Murali from a private Career Ops workflow developed for his own job search, then redesigned as a reusable open-source system with Codex assistance.
