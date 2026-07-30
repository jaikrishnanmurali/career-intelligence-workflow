# Install or deploy the Career Ops companion

Career Ops is required and must be onboarded before this extension is installed.

## Install

From the Career Ops root, use the documented `npx` command. The installer must:

1. verify `package.json`, `AGENTS.md`, `modes/`, `config/profile.yml`, and `cv.md`;
2. create `extensions/career-intelligence-workflow` without overwriting an existing extension;
3. import an unconfirmed private discovery draft from Career Ops;
4. add namespaced Codex and Claude skill adapters without overwriting custom files;
5. install dependencies;
6. leave email and scheduling disabled.

## Enable cloud delivery

Only after onboarding, tests, and a no-email smoke scan pass:

1. Follow `docs/RESEND.md` without asking for the API key in chat.
2. Confirm the Career Ops repository is private.
3. Ask before running `npm run workflow:install -- --root ../..`.
4. Add the three documented GitHub Actions secrets.
5. Run the workflow manually once and review its report and email.
6. Keep the recurring schedule only after the manual run succeeds.

The extension recommends jobs. Career Ops evaluates selected URLs and handles later application work. Neither system submits an application automatically.
