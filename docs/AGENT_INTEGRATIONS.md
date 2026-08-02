# Codex and Claude Code

Career Ops supports more agents than this extension. Existing users can keep their chosen agent for normal Career Ops work. Career Intelligence currently supports Codex and Claude Code for guided setup and the optional Smart cloud runner.

## Setup agent

Run Codex or Claude Code from the Career Ops root. The setup agent should:

- verify Career Ops onboarding;
- draft deterministic scan rules from Career Ops;
- show those role, location, language and seniority rules for confirmation;
- generate and review regional source packs, then guide selected platform alerts one at a time;
- run the doctor, tests and a no-email scan;
- guide GitHub browser sign-in and private-repository creation;
- collect secrets through `gh`, never through chat;
- leave Smart disabled unless the user explicitly accepts cost and privacy.

The ChatGPT and Claude websites cannot run the installer or configure the repository.

## Discovery Digest

Discovery invokes neither provider action. It runs the official Career Ops structured scanner, supplemental public feeds, rolling ATS endpoints and any configured Resend alert intake, and therefore consumes zero model tokens. It does not sign in to LinkedIn, run adaptive broad search-engine queries or operate dynamic browser pages. An unresolved alert is shown as a manual-check lead, not scored as a recommendation.

## Smart scheduled workers

Smart uses one of:

- `openai/codex-action`;
- `anthropics/claude-code-action`.

The discovery worker receives a bounded Career Ops search plan, normalized alert leads and the structured source receipt. The evaluation worker receives only the prepared candidate batch. Neither worker receives a Resend key or persisted Git credentials. Neither may submit an application, tailor a CV, edit the tracker or spawn subagents.

A clean runner validates the returned JSON before applying it. Email is handled by another clean runner.

## Authentication and cost

Codex in GitHub Actions uses `OPENAI_API_KEY`. A ChatGPT or Codex subscription is not an API balance for GitHub Actions.

Claude Code uses the supported cloud credential stored as `CLAUDE_CODE_OAUTH_TOKEN`.

Provider authentication and action versions can change. Check current official provider documentation when setting up or rotating credentials, restrict the key and set provider-side spending limits.
