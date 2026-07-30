# Privacy model

Career Intelligence runs inside a Career Ops workspace, where the CV and profile are already personal. A live deployment therefore belongs in a private repository with narrow access.

## Data boundary

| Data | Public project | Private Career Ops deployment |
| --- | --- | --- |
| Extension code and tests | Yes | Yes |
| Fictional profile fixture | Yes | Yes |
| Career Ops profile and CV | Never | Yes |
| Confirmed extension profile | Never | Yes |
| Resend key and email addresses | Never | GitHub secrets or ignored `.env` |
| Recommendation state and report | Empty fixture only | Yes |

## Import minimization

The deterministic importer copies role names, archetype fit, and location foundations into an unconfirmed extension draft. It does not copy name, email, phone, CV text, narrative, or proof points. Tests enforce this boundary.

## Ignored extension files

```text
.env
config/profile.yml
preview/
state/state.json
reports/latest.json
reports/archive/
```

Git ignore is a guardrail, not encryption. The confirmed profile and generated state must be force-added only to a private Career Ops repository for cloud scheduling. Never force-add `.env`.

## GitHub Actions

The workflow maps three secrets and commits the extension's state and latest report. Anyone with read access to the private repository can see the recommendation history, Career Ops profile, and CV. Keep repository membership narrow.

## Email

Resend receives the digest body, recipient address, and sender address. The digest contains job titles, employers, locations, links, fit reasons, and cautions. It does not need the user's CV or career narrative.

## Agent access

Codex or Claude may read Career Ops and extension files while onboarding or explaining a result. The scheduled workflow does not invoke either agent.

Never paste credentials into agent chat. If a key has been exposed, rotate it immediately even if it was later deleted from the conversation or repository.
