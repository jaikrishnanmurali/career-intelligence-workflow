# How Career Intelligence uses Career Ops

Career Ops is the required foundation. This extension adds unattended discovery and email delivery without recreating its candidate or application system.

## Source-of-truth split

Career Ops owns:

- identity and contact data;
- CV and evidence;
- target roles and career narrative;
- evaluation, tailoring, tracker, and application workflow.

Career Intelligence owns:

- scan-specific adjacent titles and responsibility terms;
- hard scan exclusions and language blockers;
- ordered search locations;
- experience and manager ranking cautions;
- freshness evidence, deduplication, report state, and Resend delivery.

## Import behavior

During installation, `scripts/import-career-ops-profile.mjs` reads Career Ops `config/profile.yml` and creates an extension draft.

It imports role names, archetype fit, city, country, and authorized locations. It does not copy the candidate's name, email, phone number, CV text, narrative, or proof points. The generated draft says `configured: false` until the setup conversation fills and confirms the missing scan rules.

The deterministic importer is intentionally conservative. It does not infer experience, unsupported languages, manager preference, or adjacent job titles from silence.

## Skill adapters

The installer adds namespaced adapters at:

```text
career-ops/.agents/skills/career-intelligence/SKILL.md
career-ops/.claude/skills/career-intelligence/SKILL.md
```

Each adapter points back to the extension. It does not modify Career Ops root instructions, modes, CV, tracker, or templates. A different existing adapter is never overwritten without an explicit reviewed force operation.

## Handoff

1. Career Intelligence discovers and emails recommendations.
2. The user chooses a role.
3. The agent passes its URL and freshness/fit evidence to Career Ops.
4. Career Ops evaluates the role and decides what later artifacts to prepare.
5. The user remains responsible for the final application.

Career Intelligence never creates a tailored CV, adds a tracker row, fills a form, clicks Apply, or contacts an employer.

## Why the scheduled scanner remains separate

Career Ops includes interactive scanning and local scheduling recipes. This extension keeps a separate bounded scanner because its job is unattended cloud delivery: broad rolling ATS coverage, exact-versus-weak freshness labels, saved email state, and a Resend digest. The scanner still starts from the Career Ops profile and returns selected jobs to the Career Ops pipeline.

This boundary keeps the email run deterministic and prevents a twice-daily schedule from spending model tokens on full evaluations.
