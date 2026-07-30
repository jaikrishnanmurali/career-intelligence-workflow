# Explain a recommendation

Use this mode when the user asks why a role passed, failed, ranked highly, or disappeared between scans.

1. Read `config/profile.yml` when it exists; otherwise read the example profile and state that limitation.
2. Read the relevant record in `reports/latest.json` and, when needed, its compact rejection entry.
3. Trace the decision through role family, location group, freshness evidence, hard-language gate, authorization gate, manager preference, experience caution, live-page verification, score, and saved-state deduplication.
4. Quote or paraphrase only evidence that exists in the record or fetched posting. Do not invent a missing requirement.
5. Explain deterministic rules in plain language. If a rule produced a false positive or false negative, propose a test case before changing it.
6. Never describe the agent's explanation as part of the zero-token scheduled runtime.

End with one of: keep, review manually, or filtered by the configured rules. The user still decides whether to apply.