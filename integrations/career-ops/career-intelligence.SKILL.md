---
name: career-intelligence
description: Set up and operate the installed Career Intelligence email and job-discovery companion. Use for recurring job digests, deterministic scans, Resend delivery, recommendation explanations, and handoff of selected jobs to Career Ops. Do not use it to submit applications.
---

# Career Intelligence adapter

The extension is installed at `{{EXTENSION_PATH}}` relative to this Career Ops root.

1. Follow this Career Ops workspace's root instructions and evidence rules first.
2. Read `{{EXTENSION_PATH}}/AGENTS.md`.
3. Read `{{EXTENSION_PATH}}/.agents/skills/career-intelligence/SKILL.md`.
4. Route the request through the matching file in `{{EXTENSION_PATH}}/modes/`.
5. Run extension commands from `{{EXTENSION_PATH}}` while keeping the Career Ops root available at `../..`.
6. Use Career Ops `config/profile.yml` and `cv.md` as source evidence. Store search-only additions under the extension.
7. When the user chooses a recommendation, give its URL and evidence summary to the existing Career Ops evaluation pipeline.
8. Never let this extension tailor a CV, edit the tracker, submit an application, or contact an employer.
9. Never expose the extension profile, email addresses, credentials, reports, or state.
