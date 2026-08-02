# Set up the scheduled digest

Use this mode from the root of an onboarded Career Ops 1.24.x workspace.

## Read first

1. Career Ops `AGENTS.md`, `config/profile.yml`, `cv.md`, `portals.yml` and `modes/scan.md`.
2. Extension `docs/DIGEST_MODES.md`, `docs/PRIVACY.md` and `config/profile.yml`.
3. Never ask for an API key in chat.

## Start with Discovery Digest

Explain that Discovery uses zero model tokens and searches configured public feeds plus rolling Greenhouse, Lever, Ashby and Workday boards. Give concrete limits: a LinkedIn-only result, an Indeed result with no employer-feed copy, a dynamic “Load more” page or an ATS company outside this run's shard may be missed.

Smart Digest is an optional upgrade after Discovery and Resend are proven. It uses a billed Codex or Claude Code cloud worker for Career Ops browser/search gaps and full-description evaluation.

## Confirm the deterministic scan profile

The installer has drafted search rules from Career Ops. Show them in short groups and ask the user to correct:

1. Role families, related titles and responsibility terms.
2. Location groups and priority order.
3. Languages that should block only when explicitly mandatory.
4. Senior titles, manager-title treatment and people-management signals.
5. Enabled direct feeds, ATS families and operating limits.

Do not ask the user to retype their CV or career story. Do not add unsupported experience. Keep `configured: false` until the user approves the displayed rules.

## Validate and deploy

Run the doctor, tests, smoke check and a live no-email structured scan. Explain source failures and zero results separately. Then guide GitHub browser sign-in, verify the repository is private and collect Resend values through `gh secret set`.

Install the workflow only after confirmation. Run `guard-only`, then one deliberate `run`.

If the user later chooses Smart, obtain explicit cloud privacy and cost consent, add only the selected provider credential and set `CAREER_OPS_AGENT_ENABLED=true`.
