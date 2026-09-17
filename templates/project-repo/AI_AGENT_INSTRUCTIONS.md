# AI Agent Instructions — v1.2.0 (project-pinned)

These are the canonical APES operating rules for coding agents in this
repository. They apply to Claude, Codex, Gemini, and other agents on every task.

## 0. Specification gate

Before any non-trivial change, state:

- the business requirement in one sentence;
- affected modules/services and indirect dependencies;
- whether the change touches auth/authz, tenant isolation, payments/billing,
  webhooks, destructive data operations, migrations, secrets, or CI/deployment controls;
- database/query impact and backward compatibility;
- existing behavior that must not break;
- intended validation and rollback strategy.

If these cannot be answered confidently, inspect the existing implementation
first. Do not guess from filenames or task wording.

## Risk-tier authority

The coding agent may flag risk concerns while working, but it does not assign
the authoritative PR tier. CI computes CRITICAL/HIGH/MEDIUM/LOW deterministically
from changed paths and diff content. If your assessment disagrees with CI,
state that explicitly for human review.

## 1. Non-negotiables

1. Never modify production data/infrastructure directly from a coding session.
2. Preserve existing architecture unless a deviation is explicitly justified.
3. Preserve unrelated behavior unless the requirement changes it.
4. Never perform destructive data/functionality changes without explicit authorization.
5. Treat auth/authz, tenant isolation, billing/payments, webhooks, migrations,
   secrets, CI controls, and destructive operations as sensitive.
6. Prefer backward-compatible migrations; document when that is impossible.
7. Never expose secrets/tokens/credentials in code, tests, logs, comments,
   prompts, fixtures, or documentation.
8. Keep logic changes scoped; do not bundle unrelated cleanup/style refactors.
9. Add regression coverage for bug fixes where practical.
10. New/changed endpoints must consider authentication, authorization, input
    validation, error handling, abuse/rate limits where relevant, and tenant scoping.
11. Database work must consider injection, N+1 behavior, indexes for new hot
    filters/sorts, transaction boundaries, races, and partial writes.
12. External calls must handle timeouts, safe retries, idempotency/duplicate
    delivery, malformed responses, and partial failure.
13. Every data-access change must explicitly verify cross-tenant isolation,
    including background jobs without request-scoped auth context.
14. Never silently bypass a failing APES check. Fix the defect or escalate the blocker.
15. `.apes.json` changes are reviewed under the already-trusted base-branch policy and take effect only after merge. Treat `.apes.json`, `.github/workflows/**`, CODEOWNERS, and APES policy files
    as security-control changes. Do not weaken them casually or hide such changes
    inside feature work.

## 2. Before declaring implementation complete

Run the repository's configured validation commands using the actual supported
package manager for this APES release (npm, pnpm, or Yarn). `.apes.json` is the
CI contract; a missing required check is not success.

Return a Definition of Done containing:

```text
Requirement: <one line>
Files changed: <list>
Preliminary risk: <LOW|MEDIUM|HIGH|CRITICAL> (CI classifier is authoritative)
Architecture impact: <none | description>
Database impact: <none | migration and compatibility>
API impact: <none | description>
Security impact: <none | description>
Multi-tenant impact: <confirmed isolated | needs review>
Tests added: <list>
Local checks: <actual commands/results>
Known limitations: <list or none>
```

## 3. Existing-project audit mode

When asked to audit rather than implement:

- do not modify application code;
- report findings only;
- group findings as CRITICAL/HIGH/MEDIUM/LOW;
- include file/location, issue, evidence, production impact, and remediation direction;
- state coverage/limitations;
- do not opportunistically fix unrelated discoveries.

The human owner selects what enters the remediation sprint; fixes then go
through normal APES PR gates.

## Hermes routing rule

Any external AI call made by APES must go through the Hermes orchestration layer. Do not add direct provider calls to review/business logic. Provider adapters belong behind Hermes so capability selection, approved-provider policy, fallback, Gemini credential rotation, response validation, and telemetry remain centralized.
