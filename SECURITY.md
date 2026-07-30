# Security and privacy

Do not commit:

- `.env` files;
- Resend or other API keys;
- personal email addresses;
- live search state;
- real recommendations or application history;
- private candidate profiles.

The repository ignores generated state, reports, previews, and environment
files. GitHub Actions secrets should be used for live email delivery.

If a secret is committed, removing the file is not sufficient because the value
remains in Git history. Revoke the secret first, then clean the history.

A real scheduled deployment should run from a private fork because it may commit
job URLs, ranking decisions, and search history.

