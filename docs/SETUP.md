# Complete setup

This guide takes a new user from the public template to a private, tested scanner. No Codex or Claude subscription is required to run scheduled scans.

## What you need

- A GitHub account.
- Node.js 22 or newer for local setup and testing.
- Internet access to the configured public job sources.
- A Resend account only if you want email delivery.

The scanner itself has no model dependency.

## 1. Create a private deployment

Open the public repository and select **Use this template**, then **Create a new repository**. Choose **Private** visibility. GitHub's template feature creates a new repository without linking its commit history to the template.

Template: <https://github.com/jaikrishnanmurali/career-intelligence-workflow/generate>

Clone your new private repository and enter it:

```bash
git clone https://github.com/YOUR-NAME/YOUR-PRIVATE-REPOSITORY.git
cd YOUR-PRIVATE-REPOSITORY
```

If you only want to examine the public example, you can clone the public source directly. Do not put a real profile or live schedule in that public clone.

## 2. Install and initialize

```bash
npm install
npm run init
```

Initialization creates two ignored files:

- `config/profile.yml`, copied from the fictional example;
- `.env`, copied from the empty environment template.

Existing files are preserved. The command never overwrites them.

## 3. Edit the search profile

Open `config/profile.yml` in any text editor. YAML uses indentation, so keep the existing two-space structure and do not use tabs.

### Role families

Each family has:

- `id`: a stable lowercase identifier;
- `label`: the name shown in reports;
- `priority`: a relative weight, normally between 1 and 5;
- `terms`: title phrases that identify the family;
- `responsibility_terms`: description signals used to confirm adjacent titles.

Use specific phrases such as `partner enablement` or `lifecycle marketing`. Avoid single generic words such as `business` because they create false positives.

### Title exclusions

`title_excludes` is for roles that should never enter the shortlist. Use it for unrelated technical or senior-leadership titles. Do not put `manager` here if some manager-titled individual-contributor roles may still be relevant; the manager preference can down-rank them instead.

### Experience

Set:

```yaml
experience:
  core_years: 5
  total_years_including_adjacent: 7
  behavior: caution
```

The scanner does not reject a role merely because its text requests more years. Requirements within core experience get no caution. Requirements above core but within total experience receive a small caution. Requirements above total experience become a stronger stretch signal.

### Locations

Create groups in priority order and give each a score. Terms can include countries, cities, regional labels, and remote-work phrases. `home_group_id` identifies the group where work-authorization wording should be interpreted as local rather than relocation.

Keep country terms specific. A generic `remote` term can match roles that are not employable from your country, so the live-page caution still asks the user to confirm eligibility.

### Languages

List only languages that should block a role when the posting makes them mandatory:

```yaml
languages:
  exclude_when_hard_required:
    - german
    - french
```

A posting that calls a language “helpful,” “preferred,” or “nice to have” is not rejected by the general language rule.

### Runtime budget

The `runtime` section controls source breadth and live-page verification. The defaults suit a twice-daily GitHub Actions run. Lower `ats_boards_per_source` and `max_page_verifications` for quick local tests.

## 4. Validate

```bash
npm run doctor
npm test
npm run smoke
```

Expected behavior:

- `doctor` reports `config/profile.yml`, not the example file;
- tests complete without a failure;
- the smoke scan is bounded and says that no email was sent.

A smoke scan can return zero recommendations. That is valid when no role survives the configured evidence gates.

## 5. Add email

Follow [RESEND.md](RESEND.md). Keep the API key out of the profile and Git history.

For a local email test:

```bash
npm run doctor -- --email
npm run scan -- --send
```

The second command performs a real scan and sends the resulting digest. Run it only when you intend to send an email.

## 6. Enable cloud scheduling

Follow [AUTOMATION.md](AUTOMATION.md). A computer does not need to stay online when GitHub Actions runs the private deployment.

## 7. Optional agent setup

Codex and Claude Code discover the project instructions and skills from the repository. Start either CLI in the repository root after completing `npm install`:

```bash
codex
# or
claude
```

Ask to onboard Career Intelligence, run a smoke scan, explain a recommendation, or install the Career Ops companion. See [AGENT_INTEGRATIONS.md](AGENT_INTEGRATIONS.md).

## Updating later

Review upstream changes before pulling them into a private deployment. Keep your ignored `config/profile.yml` and `.env`; ordinary pulls do not replace them. Run `npm install`, `npm test`, and `npm run doctor` after an update.