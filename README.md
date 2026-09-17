# AI Production Engineering Standard (APES) v1.2.0

APES is a provider-neutral production engineering gate for Jay Bliss Tech repositories and other approved projects. It combines deterministic validation, risk classification, secret preflight, Hermes intelligent model routing, bounded AI review, fail-closed merge gating, and human branch-protection controls.

## v1.2.0: Hermes orchestration

All external AI review now routes through `scripts/hermes-orchestrator.js`.

Hermes does **not** automatically start with the largest model. The deterministic APES risk engine supplies a minimum capability (`medium`, `strong`, or `advanced`). Hermes then selects an approved provider/model route and locally validates the response. Lower-tier output that cannot satisfy the structured review contract is rejected and Hermes may escalate upward.

Supported provider topologies:

- OpenRouter primary + Gemini fallback;
- direct OpenAI/Anthropic primary + Gemini fallback;
- Gemini-only when no primary provider credential is configured;
- explicitly mixed primary providers when enabled by policy.

Gemini supports a multi-project credential pool. The invariant is **selected model -> rotate healthy Gemini project credentials -> next acceptable model**. A 429 on one project therefore does not immediately force a model downgrade.

See `docs/HERMES_ROUTING.md` for the complete routing contract.

## Security invariants retained from v1.1.x

- `quality-gate` fails closed when any required upstream machine check fails or is unexpectedly skipped.
- Risk classification uses changed paths and deterministic diff content.
- Secret scanning runs before any external LLM call.
- Established repositories are evaluated with `.apes.json` from the trusted base commit; a PR cannot weaken its own gate for the same PR.
- AI output is schema-validated and P0/P1/P2/P3 counts/verdicts are recomputed locally.
- Repository/PR content is untrusted data and cannot override the system review policy.
- Large diffs are completely chunk-reviewed or rejected; there is no silent prefix-only review.
- Relevant architecture/business/security context plus bounded changed-file/import context can be supplied.
- GitHub token permissions are job-scoped; only the AI-review job receives model-provider secrets.
- Added secrets block; removed/context-only credentials are redacted before external transmission.
- Fork and Dependabot PRs use the deterministic-only restricted path and require human merge controls.
- Mutable/ambiguous `pipeline_ref` values are rejected.

## Repository contents

- `AI_AGENT_INSTRUCTIONS.md` — canonical coding-agent operating rules.
- `docs/AI_PRODUCTION_ENGINEERING_STANDARD.md` — master APES lifecycle/controls.
- `docs/AI_REVIEW_POLICY.md` — risk/severity/reviewer contract.
- `docs/HERMES_ROUTING.md` — provider/model/credential routing contract.
- `docs/SECURITY_POLICY.md` — CI/AI trust and data-handling boundaries.
- `scripts/classify-risk.js` — deterministic risk classifier.
- `scripts/scan-secrets.js` — pre-provider secret preflight/redaction.
- `scripts/run-validation.js` — Node/TypeScript validation adapter.
- `scripts/hermes-orchestrator.js` — provider/model orchestration.
- `scripts/provider-clients.js` — OpenRouter/OpenAI/Anthropic direct adapters.
- `scripts/gemini-credential-pool.js` — model-preserving Gemini credential rotation.
- `scripts/call-review-gateway.js` — chunking/context/validated review integration.
- `scripts/enforce-gate.js` — fail-closed final machine gate.
- `.github/workflows/ai-review.yml` — reusable GitHub workflow.
- `.github/CODEOWNERS` — central security-sensitive ownership rules.
- `templates/project-repo/` — project integration starter.
- `docs/releases/` and `docs/audits/` — release and hardening history.
- `tests/` — deterministic regression tests.

## Provider configuration

External code transmission is opt-in per repository through `.apes.json` → `review.allowedExternalProviders`. A secret does not authorize a provider by itself.

### OpenRouter topology

Set:

```json
"allowedExternalProviders": ["openrouter", "gemini"]
```

and configure `OPENROUTER_API_KEY`. Gemini is optional fallback.

### Direct-provider topology

Set:

```json
"allowedExternalProviders": ["openai", "anthropic", "gemini"]
```

and configure `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY`. OpenRouter is not required.

### Gemini-only topology

Set:

```json
"allowedExternalProviders": ["gemini"]
```

and configure the Gemini credential pool. Hermes enters Gemini immediately without attempting unavailable providers.

### Gemini credential pool

Preferred secret:

`GEMINI_API_KEYS_JSON`

Example value:

```json
[
  {"id":"gemini-project-01","key":"..."},
  {"id":"gemini-project-02","key":"..."}
]
```

`GEMINI_API_KEY` remains supported as a single-credential compatibility path.

## One-time central setup

1. Central repository: `jflowdking212/ai-production-engineering-standard`.
2. Protect `main` and release tags.
3. After tests pass, create `v1.2.0` from the reviewed commit. For strongest immutability, pin production callers to that release commit's full SHA.
4. Do not move production tags silently; publish a new release and intentionally upgrade callers.

## Project onboarding

Copy `templates/project-repo/` into the target repository, then:

1. Populate the real architecture, business rules, security policy, and production runbook.
2. Adjust required package scripts and project-specific risk paths.
3. Choose the provider topology deliberately under `review.allowedExternalProviders` and `review.routing`.
4. Add only the secrets for providers that repository is approved to use.
5. Commit the thin caller workflow and PR template.
6. Configure branch protection/rulesets.

## Mandatory GitHub merge controls

Require:

- `call-apes-v1 / quality-gate`;
- at least one human approval;
- stale-approval dismissal;
- conversation resolution;
- CODEOWNERS on sensitive paths where practical;
- workflow/ruleset protection that prevents a PR from replacing the real caller with a fake equivalent status where your GitHub plan supports it.

## Current persistence boundary

Hermes health/cooldown state is shared across all review chunks in a single workflow run. Cross-run/shared-repository persistence is deliberately deferred to a future Hermes service/Redis integration; APES v1.2 does not pretend ephemeral GitHub runners provide durable quota state.

## Run tests

```bash
npm test
```
