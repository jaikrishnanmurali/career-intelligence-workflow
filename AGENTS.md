# Career Intelligence Workflow

## Purpose

This repository finds and recommends recent job opportunities. Its scheduled runtime is deterministic and makes no model API calls. Codex and Claude Code are optional interfaces for setup, explanation, and maintenance; they are not part of the scheduled decision path.

## Read before acting

Route Career Intelligence requests through `.agents/skills/career-intelligence/SKILL.md`. Read the matching file in `modes/` before onboarding, scanning, explaining a result, or integrating with Career Ops.

## Product boundaries

- Discover, normalize, verify, rank, deduplicate, and email job recommendations.
- Never submit an application, fill a form, click Apply, or message an employer.
- Never claim an exact posting age without exact timestamp evidence.
- Keep `verified`, `likely`, and `newly_discovered` freshness labels distinct.
- Treat experience requirements as cautions and ranking signals, not automatic rejections.
- Keep source failures isolated so one provider does not stop the scan.
- When installed inside Career Ops, hand a user-selected job URL to Career Ops for evaluation and CV tailoring. Do not duplicate that system here.

## Privacy

- Never commit `config/profile.yml`, `.env`, API keys, email addresses, live reports, previews, or scan state.
- Examples must be fictional or empty.
- A scheduled deployment belongs in a private repository even when this source repository is public.
- Never print secret values during setup, diagnostics, tests, or CI.

## Development

- Node.js 22 or newer is required.
- Keep scheduled matching deterministic and explainable.
- Do not add a model SDK or model call to `src/`.
- Add or update tests when ranking, freshness, privacy, or integration behavior changes.
- Run `npm test`, `npm run doctor`, and a bounded `npm run smoke` before release.
- Preserve the public/private boundary described in `docs/PRIVACY.md`.

## Attribution

Created by Jai Krishnan Murali from a private Career Ops workflow developed for his own job search, then redesigned as a reusable open-source system with Codex assistance.