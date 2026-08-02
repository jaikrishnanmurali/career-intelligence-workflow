# Security and privacy

## Never commit publicly

- a Career Ops profile or CV;
- the confirmed extension `config/profile.yml`;
- `.env`, Resend keys, or email addresses;
- live recommendation state, reports, or previews;
- application history or candidate evidence.

The installer and tests use fictional data. The profile importer excludes Career Ops contact data and CV content.

## Deployment

A recurring workflow must run from a private Career Ops repository. Store email values as GitHub Actions secrets. Use a Resend key with sending-only access and restrict it to the verified domain where supported. If platform-alert intake is enabled, use a separate full-access receiving key and keep the private receiving address out of committed configuration.

Career Intelligence does not persist raw inbound email, subjects, attachments or sender addresses. It stores normalized leads and hashed message identities. Resend still processes and stores the inbound message according to its service policies.

The bootstrap and delivery jobs need write permission only for the dedicated state branch. Codex and Claude Code jobs use read-only repository permissions, receive no persisted Git credentials or Resend key, and return bounded JSON for validation on a fresh runner.

## If a secret is exposed

1. Revoke or rotate it immediately.
2. Update every local and cloud deployment.
3. Test the replacement.
4. Inspect Git history, workflow logs, issues, and repository access.
5. Remove committed material from history when applicable.

Deleting the latest file is not enough when a secret remains in history or logs.

## Vulnerability reports

Do not open a public issue containing an active credential, private profile, CV, report, or exploitable detail. Contact the maintainer privately through the GitHub profile with a minimal reproduction using fictional data.
