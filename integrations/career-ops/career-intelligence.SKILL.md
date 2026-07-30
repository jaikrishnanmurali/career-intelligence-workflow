---
name: career-intelligence
description: Run the installed Career Intelligence companion for deterministic job discovery, freshness evidence, Resend digests, and handoff of selected URLs into Career Ops. Do not use it to submit applications.
---

# Career Intelligence companion

The extension is installed at `{{EXTENSION_PATH}}` relative to this Career Ops root.

1. Read `{{EXTENSION_PATH}}/AGENTS.md`.
2. Read `{{EXTENSION_PATH}}/.agents/skills/career-intelligence/SKILL.md`.
3. Route setup, scan, and explanation requests through the matching mode under `{{EXTENSION_PATH}}/modes/`.
4. Run scanner commands from `{{EXTENSION_PATH}}`.
5. Keep its real profile, Resend credentials, reports, and state private.
6. When the user selects a recommendation, pass the job URL and evidence summary to Career Ops' existing evaluation pipeline.
7. Do not let Career Intelligence tailor a CV, edit the Career Ops tracker, submit an application, or contact an employer.
8. The scheduled scanner uses zero model API tokens. Any Codex or Claude conversation is an optional interface outside that runtime.