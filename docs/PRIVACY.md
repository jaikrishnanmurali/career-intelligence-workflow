# Privacy model

Career search data is personal even when it does not contain a legal identifier. Target titles, salary expectations, location constraints, language limits, work-authorization context, and browsing history can reveal a person's plans. This project separates public source code from private operating data.

## Data boundary

| Data | Public source repository | Private deployment |
| --- | --- | --- |
| Scanner code and tests | Yes | Yes |
| Fictional profile example | Yes | Yes |
| Real `config/profile.yml` | Never | Yes |
| Resend API key | Never | GitHub secret or ignored `.env` |
| Email addresses | Never | GitHub secret or ignored `.env` |
| Seen-job state | Empty example only | Yes |
| Recommendation report | Fictional example only | Yes |
| Application materials | Out of scope | Managed separately, optionally by Career Ops |

## Files ignored by default

The repository ignores:

```text
.env
config/profile.yml
state/state.json
reports/latest.json
reports/archive/
preview/
```

Git ignore is a guardrail, not encryption. Check `git status` and staged changes before every commit.

## GitHub Actions

A live scheduled workflow should run only in a private repository. GitHub Actions secrets hold the Resend key and email addresses. The workflow maps only the three values required for email delivery.

The scheduled workflow commits state and the latest report to the private repository so deduplication works across stateless runners. Anyone with read access to that repository can therefore see recommendation history. Keep repository access narrow.

## Email

The digest body contains job titles, companies, locations, match reasons, and cautions. Resend processes that message to deliver it. Do not include a full CV or sensitive personal narrative in the digest configuration.

## Agent tools

Codex or Claude Code can read files that their environment grants them access to. A local session may therefore see a private profile or report when helping the user. The scheduled GitHub workflow does not invoke either agent.

Do not paste an API key into an agent conversation. If that happens, rotate it.

## Secret incident response

If a credential is exposed:

1. Revoke or rotate it at the provider immediately.
2. Replace the local and GitHub secret values.
3. Check Git history and Actions logs.
4. Remove the committed value from history when applicable.
5. Run a test with the replacement key.

Deleting the latest file alone is not enough when the secret exists in prior Git history.

## Public examples

Examples must be empty or fictional. Tests may use fake domains and obvious placeholder keys. Do not convert a real report into a public fixture without removing URLs, employer names, locations, email addresses, profile data, and source state.