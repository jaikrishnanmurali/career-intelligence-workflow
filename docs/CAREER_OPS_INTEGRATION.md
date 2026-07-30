# Career Ops integration

Career Intelligence can run alone. Its Career Ops integration is for users who want the scanner to feed selected jobs into Career Ops' existing evaluation and CV-tailoring workflow.

This is a companion relationship, not a merged codebase. Career Intelligence owns discovery and freshness evidence. Career Ops owns its evaluation, tracker, and application materials.

## Why the projects stay separate

Making Career Ops a mandatory runtime dependency would reduce setup work at first, but it would tie every scanner release to another project's directory structure and update cycle. The companion layout gives Career Ops users a clean handoff while preserving a small standalone product for everyone else.

## Install Career Ops first

Follow the current instructions in the [Career Ops repository](https://github.com/santifer/career-ops). Its documented quick start currently begins with:

```bash
npx @santifer/career-ops init
```

Complete its own onboarding before adding this scanner.

## Clone the companion

From the Career Ops root:

```bash
mkdir -p extensions
git clone https://github.com/jaikrishnanmurali/career-intelligence-workflow.git extensions/career-intelligence-workflow
cd extensions/career-intelligence-workflow
npm install
npm run init
```

On Windows PowerShell, `New-Item -ItemType Directory -Force extensions` can replace `mkdir -p extensions`.

The expected layout is:

```text
career-ops/
├── AGENTS.md
├── modes/
├── .agents/
├── .claude/
└── extensions/
    └── career-intelligence-workflow/
        ├── AGENTS.md
        ├── config/
        ├── src/
        └── modes/
```

## Install the skill adapters

Run this from `extensions/career-intelligence-workflow`:

```bash
npm run integrate:career-ops -- --root ../..
```

The installer verifies the Career Ops root, calculates the relative extension path, and adds:

```text
career-ops/.agents/skills/career-intelligence/SKILL.md
career-ops/.claude/skills/career-intelligence/SKILL.md
```

It does not edit Career Ops' root `AGENTS.md`, modes, CV, tracker, or templates. Running it again is idempotent. If a different skill already occupies either destination, the installer stops instead of overwriting it. Use `--force` only after reviewing the existing file.

## Configure and test

Still inside the extension:

```bash
npm run doctor
npm test
npm run smoke
```

Configure Resend and scheduling in the extension's private deployment, not in the Career Ops upstream source. See [RESEND.md](RESEND.md) and [AUTOMATION.md](AUTOMATION.md).

## Use the handoff

In Codex:

```text
$career-intelligence Run a deep scan and summarize the recommendations.
```

In Claude Code:

```text
/career-intelligence Run a deep scan and summarize the recommendations.
```

After reviewing the shortlist, tell the agent which role you chose. The integration passes that job URL and its evidence summary to Career Ops. Career Ops then follows its own evaluation and CV-tailoring rules.

Career Intelligence must not:

- create or modify a tailored CV;
- add an application to the Career Ops tracker;
- fill or submit a form;
- contact an employer.

Those boundaries keep discovery auditable and preserve the user's final decision.

## Update

Update the extension from inside its directory:

```bash
git pull
npm install
npm test
npm run integrate:career-ops -- --root ../..
```

Review release changes before pulling into a live private deployment. The ignored `config/profile.yml`, `.env`, state, and reports remain local.

## Attribution and independence

Career Ops is an MIT-licensed open-source project created by Santiago Fernández de Valderrama. Career Intelligence Workflow is independently maintained by Jai Krishnan Murali and is not affiliated with or endorsed by the Career Ops maintainer. The integration copies only this project's namespaced adapter instructions; it does not redistribute Career Ops code.