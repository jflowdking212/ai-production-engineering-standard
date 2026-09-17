# AI Production Engineering Standard (APES) v1.2.0

## Purpose

APES defines a provider-neutral engineering gate for new and existing repositories. It combines deterministic validation, risk classification, security controls, AI reasoning, human review, and deployment discipline. AI review is an additional control, not a substitute for tests, scanners, architecture knowledge, or human ownership.

## Lifecycle

1. **Specification gate** — understand requirement, affected systems, critical paths, compatibility, tests, and rollback before non-trivial coding.
2. **Implementation** — make the smallest architecture-consistent change; preserve unrelated behavior.
3. **Local validation** — execute repository-native required checks.
4. **Deterministic risk classification** — classify changed paths/content before any model call.
5. **Secret/security preflight** — prevent credentials from entering external model requests.
6. **Hermes AI review** — choose the minimum required capability, route through an approved provider/model topology, validate output, and cover the complete diff with bounded relevant context.
7. **Machine quality gate** — fail closed on broken/missing required controls and P0/P1.
8. **Human merge controls** — approvals/CODEOWNERS/rulesets; no silent P0/P1 override.
9. **Staging/canary/production** — project-specific deployment controls based on real infrastructure, never fabricated from a generic template.
10. **Monitoring/rollback** — observable rollout with a tested rollback/forward-fix strategy.

## Mandatory project artifacts

Every APES-enabled repository should maintain:

- `.apes.json`
- `AGENTS.md` plus tool-specific wrappers such as `CLAUDE.md`
- `docs/PROJECT_ARCHITECTURE.md`
- `docs/BUSINESS_RULES.md`
- `docs/SECURITY_POLICY.md`
- `docs/PRODUCTION_RUNBOOK.md`
- `docs/AI_ENGINEERING_AUDIT.md` for legacy/existing-project audits
- `.github/workflows/ai-review.yml`
- `.github/pull_request_template.md`
- CODEOWNERS/ruleset configuration appropriate to the repository

## Existing-project audit mode

Audit mode is read-only. It produces findings grouped CRITICAL/HIGH/MEDIUM/LOW with evidence and production impact. It must not opportunistically fix discovered issues. Findings are triaged into an approved remediation plan, then implemented through normal PR gates.

## Security-sensitive categories

Changes touching authentication, authorization, tenant isolation, billing/payments, webhooks, destructive data operations, schema migrations, secrets, CI/CD controls, and production infrastructure demand heightened scrutiny. Project `.apes.json` extends the central defaults to match actual paths.

## Deterministic checks

Required checks are explicit repository contracts. A missing required script is a failure, not a skip. APES v1 ships a Node/TypeScript adapter; another stack must have an adapter before its gate can claim support.

## AI review requirements

- risk is deterministic, not model-selected;
- repository/PR text is untrusted data;
- secret scanning precedes external transmission;
- external providers are explicitly approved per repository;
- model output is locally schema-validated and severity counts are recomputed;
- complete diff coverage is mandatory within configured limits;
- required inline comments must post successfully;
- provider/network/malformed-output failures block required AI reviews;
- every external model call goes through Hermes;
- Gemini preserves the selected model while rotating healthy credential/projects before model fallback;
- lower-capability responses that fail the review contract may escalate upward, never silently pass.

## Hermes orchestration standard

Hermes is the provider-neutral intelligence layer between APES review policy and model APIs. It receives the deterministic minimum capability and resolves the configured topology from trusted base-branch policy plus available credentials.

Supported topologies are OpenRouter primary + Gemini fallback, direct OpenAI/Anthropic + Gemini fallback, and Gemini-only. In `auto` mode, OpenRouter supersedes direct keys unless mixed-primary mode is deliberately enabled.

Provider adapters are implementation details behind Hermes. Business/review logic must not call OpenAI, Anthropic, OpenRouter, or Gemini directly. See `docs/HERMES_ROUTING.md`.

## Merge controls

`quality-gate` is necessary but not sufficient. Branch protection/rulesets should also require human approval, stale-approval dismissal, conversation resolution, and protection of workflow/config/CODEOWNERS changes. Use GitHub required-workflow/ruleset features where available so a PR cannot replace the caller workflow with a fake same-name status.

## Deployment standard

APES does not invent deployment automation. Before enabling staging/canary/production workflows, document the real platform, deployment command, migration order, health signals, rollback mechanism, secrets source, observability, and traffic-control capability. Only then automate.

A production rollout should prefer: staging → smoke checks → bounded canary → health/latency/error/business-metric observation → progressive/full rollout → post-deploy monitoring. Automatic rollback may be used only for well-defined reversible conditions. AI-generated hotfixes must never auto-deploy.
