# Claude Code project guidance

Read and follow `AGENTS.md` before changing or running this project.

The project skill is available at `.claude/skills/career-intelligence/SKILL.md` and can be invoked with `/career-intelligence`. The skill routes setup, scans, explanations, and Career Ops integration to the matching files in `modes/`.

The scheduled scanner must remain deterministic and must not call Claude or any other model API. Claude Code is an optional setup and maintenance interface only.