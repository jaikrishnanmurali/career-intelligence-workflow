# Set up the job digest

Use this mode after the extension installer has imported an unconfirmed draft from Career Ops.

## Read the foundation

1. Confirm the current workspace is Career Ops and the extension is under `extensions/career-intelligence-workflow`.
2. Read the Career Ops root `AGENTS.md`, `config/profile.yml`, and `cv.md`.
3. Read the extension's `config/profile.yml`. It should say `configured: false` until review is complete.
4. Do not copy personal contact details, full CV text, narrative, or proof points into the extension profile.

## Ask only for missing scan rules

Translate ordinary answers into configuration. Ask in short rounds, covering only details Career Ops does not already establish:

1. Adjacent role titles and responsibility signals the scan should search.
2. Hard title exclusions and whether manager-titled roles should rank lower.
3. Directly relevant experience and total experience including adjacent work.
4. Location order, remote scope, and hard location exclusions.
5. Languages that should block a role only when the posting makes them mandatory.
6. Whether the default 12-hour lookback and twice-daily digest are acceptable, including the IANA timezone and delivery hours. Explain that each slot uses an initial attempt plus retries 20 and 40 minutes later.

Do not ask for a Resend API key in chat.

## Confirm before writing

Show a plain-language summary of role families, exclusions, experience framing, location order, hard-language blockers, freshness behavior, and schedule. State that untimestamped roles may appear once as `newly_discovered`, never as provably recent.

After the user confirms:

1. Update only the extension's `config/profile.yml`.
2. Set `configured: true`.
3. Run `npm run doctor -- --career-ops-root ../..`.
4. Run `npm test`.
5. Run `npm run smoke`; it must send no email.
6. Summarize source coverage and recommendations or rejection reasons.

Only after those checks pass, offer the separate Resend and private GitHub Actions steps. Ask again before sending a test email or installing the workflow.
