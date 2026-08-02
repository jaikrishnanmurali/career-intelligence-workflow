# Install or deploy the Career Ops companion

Career Ops in the validated 1.22.x–1.24.x range is required and must be onboarded first.

## Install

From the Career Ops root:

```bash
npx --yes github:jaikrishnanmurali/career-intelligence-workflow setup
```

The installer verifies the Career Ops scan contract, creates the namespaced extension, adds Codex and Claude Code adapters, drafts the search and source maps, installs dependencies and leaves email, platform-alert intake and scheduling disabled. It must not overwrite an existing extension.

If Career Ops is missing, explain the official quick start without assuming terminal knowledge:

```bash
npx @santifer/career-ops init
cd career-ops
codex
# or: claude
```

Finish Career Ops chat onboarding, then run this project’s setup command from that folder. The ChatGPT and Claude websites cannot perform the installation.

## Enable cloud delivery

1. Start with Discovery Digest and explain its Career Ops, supplemental, ATS and platform-alert lanes using `docs/DIGEST_MODES.md`.
2. Confirm the live repository is private and canonical.
3. Keep the Smart feature flag disabled. If the user later chooses Smart, explain provider cost and data sharing and obtain consent.
4. Configure separate Resend sending and receiving credentials through `gh secret set` or GitHub’s secret UI, never chat.
5. Guide selected platform alerts one at a time and require one verified intake test before marking each alert ready.
6. Ask before installing the digest, alert-intake and compatibility-watch workflows.
7. Run `guard-only`, manual intake, `structured-only`, then one deliberate real delivery.
8. Verify the `career-intelligence-state` branch contains only allowlisted runtime state.

The workflow uses Codex or Claude Code only as a bounded cloud runner. Existing Career Ops users can keep another agent for normal work.
