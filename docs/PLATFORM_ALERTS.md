# Connecting the eight platform-alert sources

This is a guided setup, not a list the user is expected to decipher alone. The agent should work through only the platforms selected by `config/sources.yml`, one at a time, and keep showing which stage it is running.

Platform interfaces change. Before guiding a live account, open the current official job-search or alert page and confirm the labels the user can actually see. Never ask for a platform password, recovery code, session cookie, or API key in chat.

## What this source adds

LinkedIn, Indeed, Glassdoor, Jobbsafari, IamExpat, karriere.at, Climatebase and Wellfound are broader discovery platforms. Their native alerts can reveal a job before it appears in an employer feed or in the rotating ATS shard.

An alert is not yet a recommendation. The intake pipeline extracts the platform, stable job identifier, link and limited visible metadata. It then tries to find the full public job specification on the employer site or ATS. Only a complete, live specification can move into automated fit evaluation. If resolution fails, the lead remains `manual_review`; it appears once in a separate manual-check section so the user can inspect it, and the digest must not claim that it was evaluated.

## The setup loop for each platform

For each selected platform, the agent should:

1. Read the platform query in `config/sources.yml` and translate it into the platform's supported filters. Preserve the approved role families, location order and hard-language rule.
2. Open the official job-search page. Let the user complete sign-in, MFA, CAPTCHA or consent screens. Do not automate around access controls.
3. Create a saved search or alert when the platform offers one. Prefer immediate alerts; otherwise choose the shortest free interval available.
4. Send alerts to the user's ordinary inbox when the platform requires the account email. Help the user create an inbox forwarding rule that sends only that platform's job-alert messages to `RESEND_RECEIVING_ADDRESS`.
5. Trigger a test when the platform supports it, or wait for the first genuine alert. Run the intake pipeline manually and verify that the coverage receipt names the correct platform and a canonical candidate identity.
6. Set that platform's `alert.enabled` and `alert.tested` fields to `true` only after the test succeeds. Keep its public search query enabled as a second discovery route.

Do not forward an entire mailbox. Use a narrow rule based on the platform's verified sender and job-alert subject pattern. Show the rule to the user before saving it.

## Platform notes

| Platform | Preferred alert identity | Resolution priority | Common handoff |
| --- | --- | --- | --- |
| LinkedIn | Numeric job ID | Employer careers page or ATS first | Sign-in, alert toggle and occasional CAPTCHA |
| Indeed | `jk` job key | Employer careers page or ATS first | Regional domain, sign-in and alert frequency |
| Glassdoor | Listing ID or canonical URL | Employer careers page or ATS first | Sign-in and changed listing URLs |
| Jobbsafari | Stable path or board ID | Public detail page, then employer | Location and category filters |
| IamExpat | Stable job path | Public detail page, then employer | Saved-search availability can vary |
| karriere.at | Numeric job ID | Public detail page, then employer | German interface and regional filters |
| Climatebase | Stable job path or ID | Public detail page, then employer | Climate category selection |
| Wellfound | Numeric job ID | Public detail page, then employer | Account profile and remote-location filters |

These notes describe identification and verification; they do not promise that a platform currently exposes an alert for every search type.

## When an alert route is unavailable

Keep the platform's bounded public web-search query enabled, set the alert reason to something specific such as `native alert unavailable` or `user deferred sign-in`, and leave `tested: false`. The source receipt must say `not_configured` or `disabled_by_user`. It must never say “completed with zero jobs.”

## Privacy boundary

Resend temporarily holds the received message as the mail provider. Career Intelligence retrieves it, extracts normalized job leads, hashes message identifiers for deduplication and saves no raw subject, body, attachment or sender address to GitHub state. A transient retrieval failure is retried on the next intake run instead of marking the message consumed. The user can disable intake without disabling the main Career Ops scan or digest.
