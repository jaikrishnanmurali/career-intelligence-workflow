# Run or inspect a digest scan

Use this mode for a no-email smoke scan, a full preview, a requested email, or inspection of `reports/latest.json`.

1. Run `npm run doctor -- --career-ops-root ../..`.
2. If the profile is unconfirmed, stop and return to onboarding.
3. Use `npm run smoke` for a bounded live check. It never sends email.
4. Use `npm run scan` for a full local preview.
5. Use `npm run scan -- --send` only after the user explicitly requests a real email and `npm run doctor -- --email --career-ops-root ../..` passes.

Report title, company, location, fit band, freshness evidence, match reasons, cautions, and URL for each recommendation. Keep these labels exact:

- `verified`: an exact timestamp is inside the lookback window;
- `likely`: relative evidence such as "posted today" is current but not exact;
- `newly_discovered`: the live URL is new to saved state but its posting age is unknown.

If nothing passes, report source coverage and rejection reasons. Never apply, contact an employer, tailor a CV, or change the Career Ops tracker.

When the user selects a role, pass its URL and evidence summary to the Career Ops evaluation pipeline.
