# Privacy model

A live deployment contains a real CV, profile, search history and email activity. It belongs in a private GitHub repository with narrow membership.

## Where data goes

| Data | GitHub private repository | OpenAI or Anthropic | Resend |
| --- | --- | --- | --- |
| Career Ops profile and CV | Yes | Smart Digest only | No |
| Portals, history and shortlist | Yes | Smart discovery as needed | No |
| Job descriptions | State may contain links and summaries | Smart Digest only | Fit summary and link in email |
| Recipient and sender | Secrets/state payload | No | Yes |
| API credentials | GitHub Actions secrets | Provider receives its own credential | Resend receives its own credential |

Discovery Digest does not send CV or job context to a model provider. It still stores Career Ops data in private GitHub and sends the final digest through Resend.

## Default branch versus state branch

The private default branch contains the files a fresh runner needs: Career Ops profile, CV, portals, the reviewed extension scan and delivery config, and the workflow.

`career-intelligence-state` contains an allowlisted runtime tree: scan history, shortlist/pipeline state, coverage receipts, prepared candidates, latest report, sent identities and exact email outbox.

Neither branch is encrypted. Anyone who can read the repository may be able to read the data. Git ignore is not a privacy boundary once files are deliberately committed to a private repository.

## Secrets

Use GitHub Actions secrets or an ignored local `.env`. Never:

- paste a key into Codex, Claude, an issue or a pull request;
- write a key into YAML;
- print a key in logs;
- force-add `.env`;
- reuse a broad provider key when a restricted project key is available.

If a credential appears in chat or source history, rotate it. Deleting the visible text is not sufficient.

## Smart Digest consent

Before enabling Smart Digest, the user should understand that GitHub Actions sends private Career Ops and job context to the selected model provider. The provider’s retention, training, regional processing and account policies apply.

The worker prompts restrict purpose and writes, but prompts are not a data-isolation mechanism. Repository privacy, provider settings, minimal credentials and narrow tool access remain necessary.

## Resend

Resend receives the exact message body, sender and recipient. The digest can include employers, titles, locations, URLs, recommendation reasons, cautions and coverage failures. It does not need the full CV.

The `resend.dev` test sender can send only to the account email. A verified domain is needed for normal sending, but the domain does not need to host a live website.

## Public project

The public repository must contain only code, instructions and fictional examples. Real reports, state, profiles, CVs, email addresses and credentials do not belong here.
