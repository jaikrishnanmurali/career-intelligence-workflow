# Start here (new to this? read this first)

Welcome. This page explains what Career Intelligence is, why you might want it, and the simplest way to get it running — without reading the whole README.

## What it is

Career Intelligence is a **private job-search radar**. While your computer is off, it reads job boards and company career pages on a schedule, throws away the ones that don't fit you, and **emails you a short digest of the new matches** twice a day (morning and evening).

It is the always-on, email layer for [Career Ops](https://github.com/santifer/career-ops). It runs for free in GitHub Actions and sends email through Resend.

## What it does, and does not, do

- ✅ Discovers jobs from public feeds and employer hiring systems.
- ✅ Filters them by your roles, locations, languages and work authorization.
- ✅ Emails you only the new ones that fit — and tells you honestly what it could and couldn't check.
- ❌ It does **not** apply for you.
- ❌ It does **not** contact employers, tailor your CV, or change your tracker.
- ❌ It does **not** sign into LinkedIn, Indeed or Glassdoor for you (it can use job-alert emails from those sites as *leads* — optional).

## How it works (three steps)

1. **You set it up once.** Your CV, target roles, preferred locations, languages, and an email address.
2. **It scans on a schedule.** Twice a day it checks the sources, removes jobs it already sent you, and keeps only fresh fits.
3. **You get an email.** New matching roles arrive in your inbox. A window with no matches stays silent by default (you can switch on a short "nothing new, but I ran" confirmation email).

## What you need (only two accounts to start)

You do **not** need a paid AI plan or a custom email domain to start. You need:

- [ ] **A GitHub account** — sign up at [github.com/signup](https://github.com/signup) (free). It runs the schedule and holds your private workspace.
- [ ] **A Resend account** — sign up at [resend.com/signup](https://resend.com/signup) (free tier exists). It sends your digest. You'll create an API key at [resend.com/api-keys](https://resend.com/api-keys).
- [ ] **Your CV** and a few minutes to answer questions about your roles, locations and languages.

That's the minimum. Everything below is **optional and can be added later**:

- **Eight platform job alerts** (LinkedIn, Indeed, Glassdoor, Jobbsafari, IamExpat, karriere.at, Climatebase, Wellfound) — each one you connect adds coverage, one at a time. Skip them all to begin.
- **Smart Digest** — an optional paid upgrade using Codex or Claude Code for deeper search and full-description judgment. Off by default.

## Pick how you want to get set up

| You are… | Best route | What the computer does for you |
|---|---|---|
| **Not a developer, just want it working** | [Guided Browser Setup](https://codespaces.new/jaikrishnanmurali/career-intelligence-workflow?quickstart=1&devcontainer_path=.devcontainer%2Fdevcontainer.json) (recommended) | Opens a private Codespace; a web page walks you through eight short stages and does the technical work behind the page. You do two sign-ins and paste one key. |
| **Want an AI to talk me through it** | Paste the [guide prompt](FIRST_PROMPT.md) into ChatGPT or Claude | The chat **coaches** you one question at a time and points you to the Browser Setup above. (A website chat can't click buttons for you — it guides, you click.) |
| **Already use Codex or Claude Code** | Install from the Career Ops root (see the [README](../README.md#i-already-use-codex-or-claude-code)) | The agent runs the setup for you, handing you only the actual sign-in steps. |

> **Tip:** if you ask an AI for help, paste the [guide prompt](FIRST_PROMPT.md) — **not** the README. A README makes it summarize; the prompt makes it guide you.

## After setup

You'll get your first digest at your chosen morning or evening time. A normal digest lists recommended, possible, and other new roles with a one-line "why," plus an honest note on which sources completed, failed, or weren't configured. You review each role and decide whether to pursue it through Career Ops.

Next steps when you're ready:

- Understand what it can and can't find: [Digest modes](DIGEST_MODES.md)
- Connect the eight platform alerts later: [Platform alerts](PLATFORM_ALERTS.md)
- Privacy and where your data goes: [Privacy](PRIVACY.md)

Questions or something confusing? The [guide prompt](FIRST_PROMPT.md) works for general questions too — paste it into your chat and ask.
