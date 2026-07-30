# Explain a recommendation

Use this mode when the user asks why a role passed, failed, ranked highly, or disappeared.

1. Read the Career Ops profile for candidate context.
2. Read the extension profile for scan-specific rules.
3. Read the relevant recommendation or rejection record in `reports/latest.json`.
4. Trace the decision through role family, responsibility terms, location, freshness, hard-language rules, authorization wording, manager preference, experience caution, live-page verification, score, and saved-state deduplication.
5. Use only evidence present in the record or posting. Do not invent missing requirements.
6. If the result reveals a systematic error, propose a regression test before changing the rule.

End with one of: keep, review manually, or filtered by the configured rules. The user still decides whether Career Ops should evaluate the role.
