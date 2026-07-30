# Onboard a search profile

Use this mode when a user is setting up the project or changing search criteria.

## Gather the profile

Ask only for missing information. Collect:

1. Target role families and adjacent titles.
2. Responsibility signals that matter even when the title differs.
3. Hard title exclusions.
4. Preferred location groups in priority order and any home work-authorization group.
5. Languages the user cannot meet when a posting states them as mandatory.
6. Directly relevant years of experience and total years including adjacent work.
7. Whether individual-contributor roles should rank above manager-titled roles.
8. Freshness window, normally 12 hours.

Do not ask for an API key in chat. Resend setup happens separately.

## Configure

1. Run `npm run init`. It must not overwrite an existing profile or `.env`.
2. Edit only `config/profile.yml`, never `config/profile.example.yml`, for a real user.
3. Use plain YAML lists. Give each role family a stable lowercase id, a reader-facing label, a priority, title terms, and responsibility terms.
4. Put only hard language blockers in `exclude_when_hard_required`. A language preference is not a blocker.
5. Frame experience as `core_years` and `total_years_including_adjacent`. The scanner treats a requirement above those values as a caution, not a rejection.
6. Keep exact email addresses and credentials in `.env` locally or GitHub Actions secrets in a private deployment.

## Verify

Run:

```bash
npm run doctor
npm test
npm run smoke
```

Report which profile file loaded, whether the example profile is still active, and whether the smoke run sent an email. It should not send one.