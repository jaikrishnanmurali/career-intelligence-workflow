---
name: career-intelligence
description: Set up and operate the Career Ops scheduling and email companion. Use for Smart or Discovery Digest setup, coverage checks, Resend delivery and handoff of selected jobs. Do not use it to submit applications.
---

# Career Intelligence adapter

The extension is installed at `{{EXTENSION_PATH}}` relative to this Career Ops root.

1. Follow this Career Ops workspace’s root instructions and evidence rules first.
2. Read `{{EXTENSION_PATH}}/AGENTS.md` and its canonical Career Intelligence skill.
3. Route the request through the matching file in `{{EXTENSION_PATH}}/modes/`.
4. Keep Career Ops profile, CV, portals, evidence and application workflow canonical. Treat the extension search profile as a reviewed deterministic projection of those goals.
5. Show derived title terms, responsibilities, locations, unsupported languages and seniority rules before marking the extension config confirmed.
6. Default to zero-token Discovery Digest and keep `CAREER_OPS_AGENT_ENABLED=false` until the structured scanner and Resend path are validated.
7. Explain that Discovery searches public feeds and rolling ATS boards but excludes LinkedIn-only, broad-search-only and browser-only results, with concrete examples.
8. When the user chooses a job, give its URL and evidence summary to the normal Career Ops evaluation flow.
9. Never tailor a CV, edit the tracker, submit an application, contact an employer or expose credentials, reports or state through this extension.
