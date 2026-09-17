# APES v1.2.0 Hermes Integration Audit

Date: 2026-09-17
Baseline: APES v1.1.1

## Verdict

APES v1.2.0 integrates Hermes as the mandatory external-AI orchestration layer and implements the requested Gemini model-preserving multi-project credential pool. The local regression/security suite passes. Live provider/GitHub integration must still be verified with real repository secrets before production rollout.

## Routing behavior implemented

### Auto topology

1. If OpenRouter is explicitly approved and `OPENROUTER_API_KEY` is present, Hermes uses OpenRouter as the primary topology.
2. Direct OpenAI/Anthropic keys are not consumed in that topology unless `allowMixedPrimary=true` is deliberately configured.
3. If OpenRouter is absent, approved direct `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY` become the primary set.
4. If no primary provider credential is available and Gemini is approved/configured, Hermes enters Gemini immediately.
5. Gemini is appended as fallback when it is approved and has usable credentials.

### Capability behavior

- MEDIUM risk begins at `medium` capability.
- HIGH risk begins at `strong` capability.
- CRITICAL risk begins at `advanced` capability.
- Hermes tries same-capability routes before escalating.
- Malformed/invalid structured output cannot pass.
- A reviewer can return `needs_escalation=true`; Hermes discards that response and seeks a stronger validated route.
- Hermes never degrades below the deterministic minimum capability.

### Gemini credential rotation

The order is:

`selected model -> all healthy credential/projects -> next acceptable model`

Implemented behavior:

- 429: mark credential+model cooldown, rotate to another project credential on the same model.
- Retry-After: honored when present.
- 401: disable the credential for the run.
- 403: quarantine that credential+model pair without globally disabling the credential.
- 404: mark the model unavailable for the run.
- 5xx/network: bounded retry/backoff followed by short credential+model cooldown.
- completed PR chunks are not repeated when a later chunk rotates credentials.
- telemetry exposes only opaque credential ids, never API keys.
- duplicate credential material and account-identifying credential ids are rejected.

## Provider support

- OpenRouter
- OpenAI direct (Responses API)
- Anthropic direct (Messages API)
- Gemini direct with multi-project credential pool

Current reviewed default model catalog is stored in `scripts/lib.js` and documented in `docs/HERMES_ROUTING.md`. Repositories may override it through trusted base-branch `.apes.json` policy.

## GitHub secrets

The reusable workflow accepts:

- `OPENROUTER_API_KEY`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY` (single-key compatibility)
- `GEMINI_API_KEYS_JSON` (preferred multi-project pool)

Provider secrets are exposed only to the AI-review job; deterministic project-code execution jobs do not receive them.

## Security controls retained

- fail-closed final quality gate;
- trusted base-branch APES configuration;
- immutable-style central pipeline ref guard;
- secret scanning before external AI;
- redaction of removed/context-only historical credentials;
- bounded context and complete diff chunk coverage;
- prompt-injection boundary;
- local finding/path/line/severity validation;
- P0/P1 blocking;
- restricted fork/Dependabot deterministic-only path;
- provider allow-list independent of credential presence.

## Tests

Final local regression/security suite: **86/86 passing** before packaging.

Coverage includes:

- all previous v1.1.x risk/gate/security tests;
- OpenRouter-vs-direct auto topology;
- Gemini immediate activation when primary providers are absent;
- capability-aware starting tier;
- invalid-output escalation;
- explicit model escalation requests;
- direct same-tier provider fallback before Gemini;
- OpenRouter fallback to Gemini without accidentally consuming direct keys;
- provider cooldown memory across chunks;
- Gemini same-model credential rotation on 429;
- all-credential exhaustion before Gemini model fallback;
- invalid credential handling;
- model-specific 403 handling;
- duplicate/key-id safety;
- no API-key leakage in routing telemetry;
- direct OpenAI/Anthropic adapter contract;
- workflow secret isolation and v1.2.0 pin alignment.

JavaScript syntax, JSON parsing, and YAML parsing also pass.

## Deliberate limitation

Routing health/cooldown state is process-local. It persists across all chunks in one workflow run but not across separate GitHub runs or repositories.

A future Hermes service mode should add a persistent state adapter (for example Redis) keyed by provider/model/credential id. The current interfaces intentionally isolate orchestration and credential state so that persistence can be introduced without changing the APES review contract.

## Production activation checklist

Before relying on APES v1.2.0 on production repositories:

1. publish/review the central v1.2.0 commit and create an immutable release tag;
2. preferably pin production callers to the reviewed full commit SHA;
3. select the repository provider topology in `.apes.json`;
4. add only the corresponding encrypted GitHub secrets;
5. for Gemini multi-project rotation, store the pool in `GEMINI_API_KEYS_JSON` with opaque ids;
6. run controlled PRs exercising medium/strong/advanced routes and provider failure/fallback;
7. verify real GitHub inline comments and branch-protection status naming;
8. verify live OpenRouter/OpenAI/Anthropic/Gemini API request compatibility with the credentials/models actually enabled on the account;
9. only then promote v1.2.0 across additional production repositories.

## Not claimed

- No live provider API calls were performed in the local regression suite because no user credentials were used.
- No cross-run Redis/Hermes service persistence is claimed.
- No staging/canary/production deployment topology is fabricated by this release.
