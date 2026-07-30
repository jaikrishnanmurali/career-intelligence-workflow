# Integrate with Career Ops

Use this mode when Career Intelligence is being installed inside an existing Career Ops repository.

## Layout

The supported layout is:

```text
career-ops/
  AGENTS.md
  modes/
  extensions/
    career-intelligence-workflow/
```

Career Intelligence must remain its own repository under `extensions/`. Do not copy its scanner source into Career Ops and do not replace Career Ops files.

## Install

From the Career Intelligence directory:

```bash
npm install
npm run init
npm run integrate:career-ops -- --root ../..
```

The installer adds namespaced `career-intelligence` skills for Codex and Claude Code. It refuses to overwrite a different existing skill unless the user reviews it and explicitly adds `--force`.

## Handoff boundary

1. Career Intelligence runs discovery and produces recommendations.
2. The user selects a role.
3. Hand only that role's URL and evidence summary to Career Ops.
4. Career Ops performs its own evaluation and any CV tailoring.
5. Neither system submits the application.

Run `npm run doctor`, `npm test`, and `npm run smoke` inside the extension after installation.