# Guided onboarding contract

This file defines the setup conversation for Codex and Claude Code. The agent owns the navigation: it checks the workspace, runs the safe commands it can run, explains each result, and asks the user only for decisions or sign-ins.

The first visible reply should be:

> I’ll guide you through eight short stages. I’ll explain what I’m checking before I run it, and I won’t enable a schedule or send an email without asking first. If we stop, we can continue from the last completed stage.

Then show the current stage and the next action. Do not print all eight stages as a wall of setup instructions unless the user asks for the full plan.

## How every stage should feel

Use this rhythm throughout setup:

1. **Name the stage.** Use `Stage N of 8 — <plain-language outcome>`.
2. **Explain the immediate action.** One or two sentences. Say whether it changes files, contacts the internet, sends an email, or costs model tokens.
3. **Do the work.** Run checks and safe local commands for the user. Do not make them copy commands the agent can run itself.
4. **Report what happened.** Separate a successful zero result from an error. Name partial and failed sources rather than calling them empty.
5. **Move forward or ask one question.** Ask only for the decision that is needed now.

Never ask for several credentials or preferences at once. Never ask the user to paste a secret into chat. When a browser sign-in is needed, open or provide the exact official link, explain the one-time code if there is one, and wait for the user to finish.

Record completed stages with `node extensions/career-intelligence-workflow/scripts/setup-progress.mjs complete <stage>` from the Career Ops root. Read progress with `npm run setup:status` from the extension folder. This file stores only stage names and timestamps in ignored local state; it stores no profile data or credentials.

## Stage 1 of 8 — Checking your setup

Confirm which surface the user is in, the current folder, and whether Node.js 22+, Git, GitHub CLI, Codex or Claude Code are available.

Say what is happening:

> I’m checking the tools and folder structure first. This is local, does not contact employers, and will not send an email.

Handle the result:

- **Codex CLI/Desktop or Claude Code:** continue in the current conversation.
- **ChatGPT or Claude website:** explain that the website can discuss the setup but cannot install or run it on the computer. Give one exact next step: open PowerShell or the VS Code terminal, enter the Career Ops folder, start `codex` or `claude`, and paste the starter prompt.
- **Wrong folder:** locate a likely Career Ops root without recursively scanning broad parent archives. Ask before changing folders when more than one candidate exists.
- **Missing Node, Git, GitHub CLI, Codex, or Claude:** explain which later stage needs it, offer the official installation route, and verify the installation before continuing. The user may keep another Career Ops agent; Codex or Claude Code is needed only for this guided extension and, if chosen, its Smart cloud worker.

Complete stage id: `environment`. Mark it complete only after the checks have passed or the user has reached a verified equivalent state.

## Stage 2 of 8 — Connecting Career Ops

Check for an onboarded Career Ops workspace in the validated 1.22.x–1.24.x range and the required profile, CV, portals, scan mode, scanner, and fingerprint files. Validate the nine-column history contract too; a version number alone is not enough.

If Career Ops is missing, explain that Career Intelligence is an email and scheduling companion, not a replacement for Career Ops. Ask whether the user wants help installing Career Ops. If yes, run the official initializer from their chosen parent folder, enter the new workspace, start its onboarding, and return here only after the profile and CV exist.

If Career Intelligence already exists, detect whether it is current, incomplete, or locally changed. Do not overwrite it. Offer to continue, repair a clearly interrupted staging folder after inspection, or plan an update that preserves user changes.

Explain updates here, before the user depends on the schedule:

> Career Ops and Career Intelligence can both change over time. A weekly compatibility check will tell you when an update is available, but it will not install one while you are asleep. When you approve an update, the agent pauses the digest, backs up the current state, applies one update at a time, validates the data contract, runs the tests and a no-email scan, and then asks before resuming.

If the Career Ops version or nine-column history schema is unsupported, stop before deployment. Explain the exact mismatch and give the supported update or compatibility path. Do not guess that a changed schema is safe.

Complete stage id: `career_ops`.

## Stage 3 of 8 — Building your search map

Generate the deterministic scan profile from Career Ops, then show it in small, readable groups:

- target role families, nearby titles, and responsibility terms;
- preferred locations in order;
- languages that block only when the listing explicitly makes them mandatory;
- seniority, manager-title, and people-management treatment;
- direct feeds, ATS families, and the limits of each discovery lane.

Next, generate `config/sources.yml` from the included regional source packs. Select platforms from the user's actual target locations rather than enabling every regional board. The default global pack contains LinkedIn, Indeed, Glassdoor, Climatebase and Wellfound; Sweden adds Jobbsafari, the Netherlands adds IamExpat, and Austria adds karriere.at.

Show every proposed platform in one of three honest states:

- **search ready** — a bounded public web-search query has been generated;
- **alert ready** — the user has created and tested a native platform alert that forwards into the private intake address;
- **not configured** — the platform is in scope but the route has not been proven yet.

Do not say a platform is covered merely because its name appears in a query. Do not merge the generated queries into Career Ops `portals.yml` until the user approves them. The merge is idempotent and must preserve existing portal entries.

Do not ask the user to repeat their CV. Do not turn narrative experience into unsupported keywords or a fixed years-of-experience claim. Ask one focused question where the source profile is genuinely ambiguous. Keep `configured: false` until the user approves the displayed search map.

Explain what approval means: it confirms a machine-readable search projection, not a rewritten career identity.

Complete stage id: `search_profile`.

## Stage 4 of 8 — Testing the discovery pipeline

Run the doctor, automated tests, smoke check, and live structured scan with email disabled. Tell the user before the live scan:

> I’m running the official Career Ops structured scanner first, followed by the supplemental public feeds and rolling ATS boards. This can take a few minutes. No email will be sent, no application will be made, and these two passes use no model tokens.

Summarize candidates and the coverage receipt. Use language such as:

> The pipeline completed. Seven sources completed, one was partial, and Workday failed. A failed source means coverage is incomplete; it does not mean that source had no jobs.

A scan that finds zero matching jobs can still be successful. Explain no-result and failed-source outcomes separately. Confirm that the receipt contains the Career Ops core, each supplemental lane, and each selected platform-alert lane. A platform that is still `not configured` makes coverage incomplete; it must not be presented as a zero-result source.

Complete stage id: `local_validation`.

## Stage 5 of 8 — Creating the private cloud workspace

Explain that GitHub Actions keeps the search running while the computer is off. The private GitHub repository becomes the canonical Career Ops workspace; the user should work from a local clone of that repository. Do not create two active copies and promise that they will stay synchronized.

Use GitHub CLI for sign-in, repository creation, remote setup, and visibility checks. Prefer browser sign-in. Before committing, show what will be included and confirm that ignored secrets, reports, and runtime state are excluded. Preserve unrelated local changes.

Stop if the repository is public. Offer to make it private or create a new private repository; do not push personal career data to a public remote. If a remote already exists, inspect it and reuse it when appropriate instead of creating another repository.

Complete stage id: `github`.

## Stage 6 of 8 — Connecting email delivery and platform alerts

Explain the two separate Resend jobs:

1. Resend sends the finished digest.
2. If the user enables platform-alert intake, Resend also gives those alerts a receiving address. The scheduled intake reads new messages, extracts only job links and minimal provenance, and does not save raw email bodies in GitHub state.

Neither route requires a live website. For a personal digest, the `resend.dev` test sender can send only to the email address associated with the Resend account. A Resend-managed receiving domain can accept alert mail without a custom domain. A custom sending or receiving domain is optional. Verify the current rules against Resend's official documentation during setup because provider limits can change.

Create two keys with different scopes:

- `RESEND_API_KEY`: sending access only, used by the clean delivery job;
- `RESEND_RECEIVING_API_KEY`: full access, used only by the separate intake job.

Collect those keys plus `CAREER_DIGEST_FROM`, `CAREER_DIGEST_TO`, and `RESEND_RECEIVING_ADDRESS` through `gh secret set` prompts. Never ask for their values in chat, write them to YAML, or echo them. Validate the configuration without sending first. A live receiving check is safe after consent; a test email requires a separate explicit confirmation.

Then guide the eight platforms one at a time using `docs/PLATFORM_ALERTS.md`. For each selected platform:

1. explain the search being created;
2. open the official sign-in or job-search page when the current agent can control a browser, otherwise give the exact page and wait;
3. use the reviewed role and location terms, not invented keywords;
4. create or confirm the platform's native alert where available;
5. arrange forwarding to the private receiving address without exposing it in public files;
6. send or wait for one test alert;
7. mark `alert.tested: true` only after the intake receipt recognizes the expected platform.

If a platform has no usable native alert, keep its bounded search-index lane enabled and label the alert route unavailable. If login, CAPTCHA, MFA, consent, rate limiting, or a changed interface blocks the agent, hand that single interaction to the user and resume verification afterward. Never store platform passwords or browser cookies in the repository.

If the user is not ready for email, record that delivery is deferred and continue through safe workflow validation. Do not silently substitute an address.

Complete stage id: `resend`.

## Stage 7 of 8 — Installing the 12-hour schedule and cloud pipelines

Install the workflows only after the private repository and reviewed search map are ready. Explain the three separate pipelines in user terms:

- **Alert intake:** every three hours, reads new forwarded platform alerts and saves only normalized leads.
- **Job discovery and digest:** runs the official Career Ops scan, the supplemental scanner and, if enabled, the bounded Smart stages. It delivers at the user's local morning and evening windows.
- **Compatibility watch:** checks weekly for Career Ops or extension updates and opens one private GitHub issue; it never applies an update automatically.

All state-writing workflows share one lock so they cannot overwrite one another. Explain the three-attempt delivery windows: retries protect one morning or evening slot; once a slot is delivered or closes with no recommendations, later attempts stop. A stable delivery key prevents duplicate email for that slot.

GitHub cron runs in UTC. Generate both daylight-saving and standard-time triggers from the user's configured timezone, then use an exact local-time gate so the duplicate seasonal entries do not produce extra scans.

Run `guard-only` first. It checks the cloud wiring without scanning or emailing. Then run the alert intake manually with a fictional or known test alert. Finally run `structured-only`: it runs the official Career Ops and supplemental zero-token scanners and saves their coverage receipt, but deliberately does not prepare or send an email.

If GitHub Actions is disabled, the workflow is missing, permissions are insufficient, or authentication has expired, identify that exact condition and guide the corresponding GitHub screen or sign-in. Do not call silence a successful no-jobs run.

Complete stage id: `cloud_workflow`.

## Stage 8 of 8 — Sending the first digest

Before the first `run`, summarize what will happen: a live scan, state update, and an email only if there are new non-blocked recommendations. Ask for explicit confirmation because this action can send an email.

After the run, report:

- whether the scan completed;
- how many recommendations were found;
- which sources completed, were partial, or failed;
- whether an email was accepted, skipped because there were no recommendations, or left prepared for retry;
- the next scheduled window.

If delivery fails after the payload is prepared, preserve the outbox and let the next attempt resume delivery without rescanning. Do not tell the user to force another full scan.

Complete stage id: `first_run`.

## Optional upgrade — Smart Digest

Offer Smart Digest only after the structured pipeline and delivery path work. Explain the difference with examples:

- Discovery Digest runs the official Career Ops structured scan, supplemental public feeds, rolling ATS boards, and any verified platform alerts. An alert is only a lead: if the full employer or ATS specification cannot be resolved, the role goes to manual review and is not recommended as if it had been evaluated. Discovery can still miss a LinkedIn-only result that never appears in an alert, an Indeed listing with no employer copy, a JavaScript “Load more” page, or an employer outside the current ATS shard.
- Smart Digest adds one bounded Codex or Claude Code worker to resolve alert leads, search Career Ops browser and broad-web gaps, and evaluate a bounded set of complete job descriptions. It improves coverage and fit judgment, but still cannot guarantee that every job on the internet was found.

Before enabling Smart, state that private Career Ops and job context will be sent to the selected provider, that provider API usage can cost money, and that a ChatGPT/Codex or Claude subscription may not cover GitHub Actions API usage. Ask for explicit privacy and cost consent. Then:

1. help the user choose Codex or Claude Code;
2. guide provider authentication without exposing the credential;
3. ask the user to set a provider-side spending limit;
4. change `digest.mode` to `smart` and enable `CAREER_OPS_AGENT_ENABLED` only after those checks;
5. explain the bounded turn and time limits before the first Smart run;
6. run one deliberate test and report structured, Smart, partial, failed, and unscored-overflow results separately.

If the Smart worker fails or the feature flag is off, the structured scanner must still run. Say that the digest used reduced Discovery coverage for that run.

## Resume, repair, and stop paths

- **Interrupted conversation:** read setup progress and filesystem state, confirm the next incomplete stage, and continue there. Never restart blindly.
- **Dirty workspace:** preserve user changes, explain any overlap, and avoid bulk replacement.
- **Existing workflow:** compare it with the template before editing. Preserve schedules and customizations unless they break a safety guarantee.
- **No email received:** distinguish no recommendations, Resend rejection, prepared retry, missing secret, and workflow failure using the saved state and GitHub run.
- **Coverage drop:** show the affected sources and catch-up status. Never convert unavailable into zero.
- **Alert stopped arriving:** distinguish a platform alert that did not fire, mail forwarding failure, Resend receiving failure, an unrecognized link, and a specification that could not be resolved. The last case is `manual_review`, not a recommendation.
- **Upstream update available:** do not auto-merge. Pause, back up, run the guided update mode, validate the schema and workflows, then ask before resuming.
- **Changed job goals:** regenerate the search map, show the differences, and require confirmation before scheduling the new rules.
- **Vacation or budget pause:** guide pause, snooze, or resume and show the next eligible slot.
- **Hired outcome:** pause automatically when the supported Career Ops outcome is recorded, then offer export and clean teardown. Never delete a repository or history without explicit confirmation.
- **Unsupported agent:** let the user keep it for ordinary Career Ops work. Explain that this release supports Codex and Claude Code for the guided installer and Smart runner.
- **Coach or multi-candidate use:** explain that v1 supports one person per private deployment because profile, state, privacy, and cost isolation are not implemented for shared deployments.

## Completion message

Finish with a short operational summary, not a generic congratulations message:

> Your private 12-hour digest is active. The next window is [time]. Discovery Digest is using [sources/coverage summary]. Email is configured for [masked recipient]. Smart Digest is [off/on]. If a run is silent, ask “Show my Career Intelligence status” and I’ll distinguish no jobs from a failed run.

Do not expose full email addresses, secret values, private repository URLs, CV content, or job-search history in that summary.
