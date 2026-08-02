# Complete setup

This guide installs Career Intelligence inside Career Ops and moves the complete workspace to a private GitHub repository. GitHub Actions then runs the scan while the user's computer is off.

## Before you start

You need Node.js 22 or newer, Git, a GitHub account and Codex CLI/Desktop or Claude Code. A Resend account is needed when email is enabled.

The ChatGPT and Claude websites cannot run these installation commands. PowerShell, macOS Terminal, Linux Terminal and the VS Code terminal can.

## 1. Install and onboard Career Ops

If Career Ops is not installed:

```powershell
npx @santifer/career-ops init
cd career-ops
codex
# or: claude
```

Complete its chat onboarding first. `config/profile.yml`, `cv.md` and `portals.yml` should contain the real career context.

People who already use Career Ops can keep their existing local agent, including agents this extension does not support. Codex and Claude Code are required only for this extension's guided setup and optional Smart cloud runner.

## 2. Install Career Intelligence

Run this from the Career Ops root:

```powershell
npx --yes github:jaikrishnanmurali/career-intelligence-workflow setup
```

The installer verifies Career Ops 1.24.x, creates `extensions/career-intelligence-workflow`, installs its dependencies and adds namespaced Codex and Claude Code instructions. It does not send email or enable a schedule.

Start Codex or Claude Code from the Career Ops root and say:

```text
Set up my zero-token 12-hour Discovery Digest.
```

## 3. Review the generated scan profile

The installer drafts deterministic role, location and language rules from Career Ops. It deliberately leaves `configured: false`.

The setup agent should show the user:

- each role family and its related title terms;
- responsibility terms that allow adjacent titles to qualify;
- preferred location groups and their order;
- mandatory languages that should block a role;
- senior titles and people-management signals to penalize or exclude;
- the direct feeds and ATS families that will run.

This review matters. Career Ops contains rich narrative context; a deterministic scanner needs explicit machine-readable terms. The extension config is a confirmed search projection, not a second CV. When Career Ops goals change, rerun the sync command and review the draft again.

After review, set `configured: true` in `extensions/career-intelligence-workflow/config/profile.yml`.

## 4. Validate without sending email

From `career-ops/extensions/career-intelligence-workflow`:

```powershell
npm run doctor -- --career-ops-root ../..
npm test
npm run smoke
```

Then run live structured discovery with email disabled:

```powershell
npm run scan:structured
```

This last command contacts the configured public feeds and ATS directories. It may take several minutes. Review `state/candidates.json`, `state/coverage-result.json` and `reports` before enabling delivery.

## 5. Configure Resend without sharing the key

For a personal test, Resend's test sender can normally deliver to the email address registered to the Resend account. A custom sender or other recipients require a verified domain. Read [Resend setup](RESEND.md) and confirm the current Resend rules in that account.

Never paste a key into an AI chat or save it in YAML.

## 6. Make one private repository canonical

From the Career Ops root, sign in through GitHub CLI:

```powershell
gh auth login --web
```

The command prints a browser sign-in flow. If it cannot open a browser automatically, open the displayed link and enter the one-time code.

If this folder is not already a repository:

```powershell
git init
git add .
git add -f config/profile.yml cv.md portals.yml
git add -f extensions/career-intelligence-workflow/config/profile.yml
git commit -m "Set up private Career Ops workspace"
gh repo create career-ops-private --private --source=. --remote=origin --push
```

If a private remote already exists, use it. Do not create a second active workspace. Confirm the result:

```powershell
gh repo view --json visibility
```

It must say `PRIVATE`.

## 7. Add email secrets

GitHub CLI prompts for each value without putting it in chat:

```powershell
gh secret set RESEND_API_KEY
gh secret set CAREER_DIGEST_FROM
gh secret set CAREER_DIGEST_TO
```

The recipient and sender are secrets because this is a private personal deployment.

## 8. Install and test the workflow

From the extension folder:

```powershell
npm run workflow:install -- --root ../..
cd ../..
git add .github/workflows/career-intelligence.yml
git commit -m "Enable private Career Intelligence digest"
git push
```

In GitHub, open Actions → Career Intelligence digest → Run workflow. Run `guard-only` first. Then run one deliberate `run` and inspect:

- number of jobs scanned;
- recommendations and freshness labels;
- each source's completed, partial or failed status;
- the reduced-coverage examples;
- whether a zero-result run correctly skipped email;
- the private `career-intelligence-state` branch.

## 9. Optional: enable Smart Digest

Do this only after Discovery and Resend are working.

Change `digest.mode` to `smart`, choose `codex` or `claude`, and add the corresponding provider secret:

```powershell
gh secret set OPENAI_API_KEY
# or
claude setup-token
gh secret set CLAUDE_CODE_OAUTH_TOKEN
```

Then enable the independent feature flag:

```powershell
gh variable set CAREER_OPS_AGENT_ENABLED --body true
```

Without that variable, the structured scanner still runs and the workflow falls back to Discovery Digest. A ChatGPT or Codex subscription does not itself provide API usage inside GitHub Actions. Set a provider-side spending limit before enabling Smart.

## Updating

This release validates Career Ops 1.24.x and its nine-column scan-history format. Update Career Ops and this extension deliberately, rerun the doctor and all tests, perform a no-email structured scan, and only then re-enable the schedule.
