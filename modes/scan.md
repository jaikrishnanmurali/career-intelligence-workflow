# Run or inspect a scan

Use this mode for a manual scan, smoke test, digest preview, or review of `reports/latest.json`.

## Before running

1. Run `npm run doctor`.
2. If the example profile is active, explain that results are demonstrations, not personal recommendations.
3. Use `npm run smoke` for a bounded test. It sends no email.
4. Use `npm run scan` for a full local dry run.
5. Use `npm run scan -- --send` only when the user explicitly wants a real email and Resend has been configured.

## Read the result

Separate recommendations by freshness evidence:

- `verified`: an exact source timestamp is inside the configured lookback.
- `likely`: the source exposes relative evidence such as “posted today”; exact age is unknown.
- `newly_discovered`: the URL was absent from saved state and lacks useful time evidence.

For every recommendation, report title, company, location, fit band, evidence grade, why it matched, cautions, and URL. Do not call a newly discovered role “posted in the last 12 hours.”

If there are no recommendations, report source coverage and rejection reasons. Zero results can be a valid outcome when the evidence gates are strict.

Never apply, message an employer, or change a Career Ops application tracker from this mode.