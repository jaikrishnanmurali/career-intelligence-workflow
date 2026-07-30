# Codex and Claude Code

Codex and Claude Code are optional interfaces for onboarding, running commands, and explaining results. The scheduled scanner does not invoke either product and does not call a model API.

## Shared design

The canonical workflow lives at:

```text
.agents/skills/career-intelligence/SKILL.md
```

Four mode files keep task instructions focused:

- `modes/onboard.md`
- `modes/scan.md`
- `modes/explain.md`
- `modes/integrate-career-ops.md`

The root `AGENTS.md` contains durable project rules. It is intentionally concise so privacy, freshness, test, and no-auto-apply boundaries are always present without loading every procedure.

## Codex

Codex reads repository `AGENTS.md` files and discovers repository skills under `.agents/skills`. Start Codex from the repository root:

```bash
codex
```

Invoke the skill explicitly:

```text
$career-intelligence Onboard my search profile.
$career-intelligence Run a smoke scan and explain the freshness labels.
$career-intelligence Install this as a Career Ops companion.
```

Natural-language requests that match the skill description can also activate it. OpenAI's current documentation for repository instructions and skills:

- <https://learn.chatgpt.com/docs/agent-configuration/agents-md.md>
- <https://learn.chatgpt.com/docs/build-skills.md>

## Claude Code

Claude Code reads `CLAUDE.md` and project skills under `.claude/skills`. Start it from the repository root:

```bash
claude
```

Invoke:

```text
/career-intelligence Onboard my search profile.
/career-intelligence Run a smoke scan and explain the results.
```

The Claude-specific skill is a thin wrapper around the canonical shared skill, preventing two instruction sets from drifting. Anthropic's current skill documentation is at <https://code.claude.com/docs/en/slash-commands>.

## What “zero-token” covers

Zero-token refers to the automated scanner implemented in `src/` and run by GitHub Actions. It performs matching, gates, ranking, deduplication, report generation, and email delivery with ordinary code.

A conversation with Codex or Claude Code may use the user's normal product allowance. That interaction is optional and is not executed by the scheduled workflow.

## Why there is one skill, not a multi-agent swarm

Discovery, filtering, and email delivery are deterministic software steps. Splitting them across model agents would add cost and make a recommendation harder to reproduce. One focused skill is enough to help a user configure and inspect the software while keeping the runtime decision path visible in code and tests.

## Safety

The skill must never:

- ask the user to paste an API key into chat;
- commit a real profile or `.env` file;
- enable a live schedule without confirmation;
- send an email without confirmation;
- call a recommendation “verified fresh” without exact timestamp evidence;
- submit an application or contact an employer.