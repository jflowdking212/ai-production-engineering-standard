# APES agent entry point — v1.2.0

Before coding, fixing, refactoring, or auditing this repository:

1. Read the local `AI_AGENT_INSTRUCTIONS.md` in full.
2. Read `.apes.json`.
3. Read task-relevant project context:
   - `docs/PROJECT_ARCHITECTURE.md`
   - `docs/BUSINESS_RULES.md`
   - `docs/SECURITY_POLICY.md`
   - `docs/PRODUCTION_RUNBOOK.md` when deployment/operations are involved.
4. For review/audit severity definitions, read `docs/AI_REVIEW_POLICY.md`.
5. Check `VERSION` to confirm the APES release vendored into this repository.

The local files are the project-pinned rules. Do not silently fetch a mutable
"latest" policy and substitute it for the vendored version. Upgrade APES only
through the deliberate procedure in `docs/UPGRADE.md`.
