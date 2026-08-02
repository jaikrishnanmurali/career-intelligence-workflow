# Set up Discovery Digest in your browser

Browser Setup is for someone who has a laptop or desktop browser but does not use VS Code, Codex or Claude Code. It creates the zero-model-token Discovery Digest. It does not unlock Career Ops' AI evaluation or Smart Digest.

## What you need

- a free personal GitHub account;
- a CV in PDF, DOCX, TXT or Markdown format;
- a free Resend account when you are ready to test email;
- about 20 minutes for the first setup.

You do not need a paid Claude plan, an AI API key, a live website or a custom domain. GitHub Codespaces and Actions and Resend still have account quotas. The setup does not promise that every deployment will remain within those quotas indefinitely.

If you have only a phone, wait until you can use a laptop or desktop browser. The setup page is responsive, but GitHub sign-in and recovery are not yet supported as a mobile-only journey.

## Start

[Open Career Intelligence Browser Setup](https://codespaces.new/jaikrishnanmurali/career-intelligence-workflow?quickstart=1&devcontainer_path=.devcontainer%2Fdevcontainer.json)

GitHub opens a private cloud development environment and then opens the setup page. The page uses eight stages and shows only the decision needed now. You do not need to open files or use the terminal underneath it.

## What the eight stages do

1. **Starting point** confirms that this is the free Discovery route and explains what it cannot do.
2. **Career profile** extracts CV text inside the user's private Codespace and collects the minimum facts Career Ops needs. Discovery Setup does not send the CV to OpenAI or Anthropic.
3. **Search map** asks for real role families, nearby titles, responsibilities, locations and language blockers.
4. **Coverage** distinguishes structured sources from browser-only gaps with concrete examples.
5. **Private workspace** installs the pinned supported Career Ops release, adds this extension and publishes only after GitHub reports the destination as private.
6. **Email** passes a new sending-only Resend key directly to GitHub Secrets. The key is not written to a file or chat.
7. **Cloud checks** runs a guard-only test and then a live structured scan with email disabled. The page watches both runs and does not unlock activation until they pass.
8. **First digest** enables the schedule only after those checks and asks separately before the first run that could send email.

The schedule starts disabled through the private repository variable `CAREER_DIGEST_ENABLED=false`. Manual safety checks still work. Stage 8 changes that variable to `true` only after the user presses the activation button.

## What is installed

The generated private repository contains:

- Career Ops at the version pinned and validated by this release;
- generated root and extension lockfiles required by the clean GitHub Actions install;
- the confirmed Career Ops profile and CV;
- the Career Intelligence structured search profile;
- the digest, alert-intake and compatibility-watch workflows;
- no model-provider credential;
- no Resend credential in a tracked file.

Career Ops is still the foundation. Browser Setup automates its documented manual profile path for Discovery users; it does not reproduce Career Ops' AI onboarding, evaluation, tailoring or application workflow. Connect a supported coding agent later if you want those features.

## The free-mode limit

Discovery searches supported public feeds, the official Career Ops structured scanner, and rotating employer ATS boards. Configured platform alerts can add leads from LinkedIn, Indeed, Glassdoor, Jobbsafari, IamExpat, karriere.at, Climatebase and Wellfound.

It does not sign into those platforms or operate a browsing agent. For example:

- a LinkedIn alert that resolves to a complete employer job page can be considered;
- a LinkedIn-only role that never triggers an alert may be missed;
- an Indeed listing may still be found through the employer's Greenhouse board;
- a JavaScript-only careers page may be missed;
- an ATS company outside the current rotating shard is not checked in that run.

The email and coverage receipt name incomplete lanes. A failed source is not reported as a successful source with zero jobs.

## Resume or recover

- Reopen the same Codespace to continue a prepared but unpublished setup.
- After publishing, the private repository is the canonical workspace. The temporary Codespace can be deleted.
- If setup fails before publication, use the reset control only after confirming that the generated workspace contains nothing you need.
- If GitHub authentication expires, use the browser device link and one-time code shown by the setup page.
- If email fails, create a replacement Resend key, update the private secret and revoke the old key. Never paste the replacement into an AI chat.

## Upgrade later

Smart Digest is intentionally absent from Browser Setup. A later guided upgrade can connect Codex or Claude Code, explain what private context will be sent to the provider, show the expected cost, require a spending limit and run one deliberate test. Discovery continues working if Smart remains off or its worker fails.
