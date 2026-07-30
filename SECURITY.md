# Security and privacy

## Never commit

- `.env` files;
- Resend or other API keys;
- personal email addresses;
- `config/profile.yml` from a real user;
- live search state, source cursors, or reports;
- real recommendations or application history;
- CVs or private candidate evidence.

The repository ignores generated state, reports, previews, environment files, and the real profile. Examples must remain empty or fictional.

## Deployment

A real scheduled deployment should run from a private repository because it may commit job URLs, ranking decisions, and search history. Store email settings as GitHub Actions secrets, not workflow literals.

Use a Resend key with sending-only access and restrict it to the verified sending domain where supported.

## If a secret is exposed

Removing the latest file is not sufficient because the value can remain in Git history, logs, caches, or conversation transcripts.

1. Revoke or rotate the secret immediately.
2. Replace it in every deployment.
3. Verify the replacement works.
4. Clean Git history when applicable.
5. Review repository access and Actions logs.

Do not print a secret to diagnose a failure.

## Reporting a vulnerability

This is currently a portfolio-led project. Do not open a public issue containing an active credential, personal profile, private report, or exploitable security detail. Contact the maintainer privately through the contact method on the GitHub profile and include a minimal reproduction with all personal data removed.

See [docs/PRIVACY.md](docs/PRIVACY.md) for the full data boundary.