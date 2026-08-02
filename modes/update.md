# Safely update Career Ops and Career Intelligence

Run this mode from the canonical private Career Ops repository. Never update from a second copy.

1. Run the extension update check and show the installed and available versions.
2. Explain that scheduled workflows will be paused and that no scan or email will run during the update.
3. Inspect the worktree. Preserve unrelated user changes and stop if an update would overwrite them.
4. Ask for confirmation before changing files.
5. Pause the digest and wait for any `career-ops-state-writer` workflow to finish.
6. If a Career Intelligence update is available, update the extension first without overwriting `config/profile.yml`, `config/sources.yml`, `.env`, reports, or state. Validate that the new extension explicitly supports the currently installed Career Ops version and the proposed target version.
7. Run Career Ops `node update-system.mjs check`, show its result, then use `apply` only after confirmation and only when the updated extension supports the target. Career Ops owns its system-file backup and rollback. If the target is outside the extension range, leave Career Ops unchanged and explain that a compatible extension release is required first.
8. Run the Career Ops doctor and pipeline verifier, then the extension doctor and complete test suite.
9. Run one local no-email scan followed by the cloud `structured-only` validation.
10. Show any source-plan, schema, workflow, or configuration differences. Resume the digest only after every required check passes and the user confirms.

If any validation fails, leave the digest paused. Explain the exact failure and offer the Career Ops rollback plus restoration of the extension version. Never call a partial update complete.
