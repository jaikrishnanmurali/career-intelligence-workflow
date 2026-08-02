# The first prompt

Paste this into Codex or Claude Code. You can also paste it into a ChatGPT or Claude website chat; the website should explain the handoff to a local terminal because it cannot install files on your computer.

```text
Help me set up Career Intelligence Workflow from
https://github.com/jaikrishnanmurali/career-intelligence-workflow.

Read the repository's AGENTS.md and docs/ONBOARDING.md from the linked source or local checkout. Follow the guided eight-stage onboarding flow exactly. Work one stage at a time, tell me in plain language what you are checking before you run it, and run safe commands for me when you can. Do not give me the whole setup manual at once.

Check whether I already have Career Ops and whether I am in the correct folder. If Career Ops is missing, explain why it is required and ask whether I want you to help install and onboard it. If Career Ops exists but this extension is not cloned, use its one-command `npx` installer from the Career Ops root; do not ask me to clone repositories or merge folders manually. If this chat cannot run local commands, give me one exact next step for continuing in Codex or Claude Code.

Build the search and source plan from my completed Career Ops profile. Explain the official Career Ops scan, supplemental sources, and the eight optional platform-alert sources separately. If I choose platform alerts, guide me through each account, forwarding rule and test one at a time; do not call a source configured until its receipt proves the path works.

Do not ask me to paste credentials into chat. Do not enable a schedule, spend model tokens, or send the first email without explaining what will happen and asking me first. Install a safe compatibility check, but never auto-update my live Career Ops workspace. Save non-sensitive setup progress so we can resume if the conversation stops. Start with Stage 1 only.
```

Shorter requests such as “Set up my 12-hour Career Intelligence digest” should route to the same guided flow after the extension is installed.
