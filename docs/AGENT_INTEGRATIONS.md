# Codex and Claude inside Career Ops

Start the agent from the Career Ops root, not from the extension directory. This ensures Career Ops remains the governing workflow and the extension can reuse its profile, CV, and evidence rules.

## Installed adapters

The installer creates:

```text
.agents/skills/career-intelligence/SKILL.md
.claude/skills/career-intelligence/SKILL.md
```

Both adapters point to the canonical extension skill under `extensions/career-intelligence-workflow/.agents/skills/`. The adapter is namespaced and does not replace the Career Ops router.

## Codex

From the Career Ops root:

```bash
codex
```

Example requests:

```text
Use $career-intelligence to set up my 12-hour job digest.
Run the Career Intelligence no-email smoke scan.
Explain why this recommendation was labelled newly discovered.
Hand this selected URL to the Career Ops evaluation pipeline.
```

If explicit skill invocation is unavailable, ask for the same task in plain language.

## Claude Code

From the Career Ops root:

```bash
claude
```

Example:

```text
/career-intelligence Set up my 12-hour job digest.
```

## Agent boundary

Codex or Claude may read Career Ops files during onboarding and explanation. They may write the extension profile only after showing the interpreted rules and receiving confirmation.

The agent must not ask for an API key in chat, send email without confirmation, install a workflow without confirmation, tailor a CV through the extension, edit the Career Ops tracker, or submit an application.

## Zero-token boundary

Agent onboarding uses the user's normal Codex or Claude allowance. The scheduled scanner is different: it runs ordinary Node.js code in GitHub Actions and uses zero model API tokens.
