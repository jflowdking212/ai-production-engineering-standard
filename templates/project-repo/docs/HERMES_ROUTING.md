# Hermes Intelligent Provider & Model Routing — APES v1.2

Hermes is the only orchestration layer used by APES for external AI review. Provider adapters do not decide task capability and application code must not bypass Hermes to call a model directly.

## Routing objective

Hermes minimizes unnecessary model cost/latency without dropping below the capability required by the deterministic APES risk engine.

The order is:

1. determine the minimum capability (`medium`, `strong`, `advanced`);
2. resolve the configured provider topology from repository policy and available credentials;
3. select a model in that capability tier;
4. validate the returned structured review locally;
5. if the response is malformed/insufficient, try another same-tier candidate, then escalate upward;
6. never silently accept a model response that fails the APES schema/line validation.

For Gemini specifically the order is stricter:

**model -> credential/project pool -> next model**

A 429 on one credential does not immediately downgrade the model. Hermes rotates to another healthy credential/project and retries the same model first.

## Provider topology modes

`review.routing.mode` accepts:

- `auto` — recommended. If an approved OpenRouter credential exists, OpenRouter is the primary topology and direct OpenAI/Anthropic keys are not required. If OpenRouter is absent, approved direct OpenAI/Anthropic credentials become the primary set. If neither primary topology is usable and Gemini is approved/configured, Gemini activates immediately.
- `openrouter` — only OpenRouter is used as a primary provider. Gemini may remain an approved fallback.
- `direct` — approved OpenAI and/or Anthropic direct APIs are used as primary providers. Gemini may remain an approved fallback.
- `gemini` — Gemini only.

`allowMixedPrimary` is `false` by default. In `auto` mode this means that when OpenRouter is configured, direct OpenAI/Anthropic credentials are not also consumed. Set it to `true` only when you deliberately want OpenRouter and direct providers in the same primary set.

## Capability-aware provider preference

Provider preference is defined per capability, not globally. The default policy is:

- `medium`: prefer OpenAI direct when direct mode is active, then Anthropic;
- `strong`: prefer Anthropic, then OpenAI;
- `advanced`: prefer Anthropic, then OpenAI.

OpenRouter mode uses the configured OpenRouter model list directly. Gemini stays a fallback unless `mode=gemini` or no primary credential is available.

The model catalog is policy data and should be reviewed when providers change model names, availability, pricing, or deprecation status.

## Default model catalog

APES v1.2 ships with these reviewed defaults:

- OpenRouter medium: `openai/gpt-5.6-luna`
- OpenRouter strong: `anthropic/claude-sonnet-5`, then `openai/gpt-5.6-terra`
- OpenRouter advanced: `anthropic/claude-opus-5`, then `openai/gpt-5.6-sol`
- OpenAI direct: `gpt-5.6-luna` / `gpt-5.6-terra` / `gpt-5.6-sol`
- Anthropic direct: `claude-sonnet-5` / `claude-sonnet-5` / `claude-opus-5`
- Gemini medium: `gemini-3.5-flash-lite`, then `gemini-3.6-flash`
- Gemini strong: `gemini-3.8-flash`, then `gemini-3.6-flash`
- Gemini advanced: `gemini-2.5-pro`, then `gemini-3.8-flash`

Repositories may override model lists in `.apes.json`, but provider transmission must still be explicitly approved through `review.allowedExternalProviders`.

## Credential configuration

Supported GitHub secrets:

- `OPENROUTER_API_KEY`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY` — backward-compatible single Gemini credential
- `GEMINI_API_KEYS_JSON` — preferred Gemini multi-project credential pool

Example Gemini pool secret value:

```json
[
  {"id":"gemini-project-01","key":"<secret>"},
  {"id":"gemini-project-02","key":"<secret>"},
  {"id":"gemini-project-03","key":"<secret>"}
]
```

The `id` is an opaque operational identifier. Never place account email addresses, API keys, or other sensitive identity material in logs or ids.

Every pool credential must belong to a project/account the operator is authorized to use. APES does not create accounts, manufacture quota, or treat repeated keys from one project as independent capacity; it only routes among the credentials supplied by the operator and honors provider rate-limit responses.

## Gemini credential-pool state

Within a Hermes process, state is tracked per credential and model:

```text
credential/project     model              state
------------------------------------------------------
gemini-project-01      gemini-3.8-flash   healthy
gemini-project-02      gemini-3.8-flash   cooldown
gemini-project-01      gemini-3.6-flash   healthy
```

Important consequences:

- a 429 on `project-02 + model-A` does not automatically disable `project-02 + model-B`;
- a 401/403 disables the credential for the current run because the credential itself is unusable;
- a 404 marks the model unavailable for the current run;
- 5xx/network failures receive bounded retry/backoff, then a short cooldown;
- `Retry-After` is honored when present on a 429;
- keys are never emitted in telemetry.

## Chunk continuation

APES reviews a PR in bounded complete chunks. The Hermes/Gemini pool instance is shared across those chunks for the life of the GitHub job.

If chunks 1 and 2 have already completed and chunk 3 receives a 429, Hermes rotates the credential and retries **chunk 3**. It does not repeat completed chunks 1 and 2.

## Response-quality escalation

Provider success is not sufficient. The response must also pass APES's local review validator:

- valid JSON object;
- findings array present;
- valid diff path and LEFT/RIGHT line;
- supported P0–P3 severity;
- bounded natural-language comment.

If a lower-capability response is malformed or insufficient, Hermes tries the remaining same-capability candidates and can escalate to the next capability. The reviewer may also explicitly return `needs_escalation: true`; Hermes discards that response and seeks a stronger validated route. This allows inexpensive models to handle routine work without making their output authoritative when they fail the contract.

For non-Gemini providers, Hermes also remembers short-lived rate-limit/network health inside the workflow process so later PR chunks do not repeatedly hit a candidate that just failed. Gemini maintains richer credential+model health through its pool.

## Privacy and trust boundary

Hermes may only use providers listed in the trusted base-branch `.apes.json`. The existence of a secret alone does not authorize code transmission.

Secrets introduced by the PR are blocked before any external provider call. Secrets that exist only in removed/surrounding diff context are redacted before transmission. Project context containing a detected secret is refused.

## Current persistence boundary

APES v1.2 maintains provider/credential health in memory for one GitHub workflow run. That is sufficient for correct model-preserving rotation across all chunks of one PR review.

It does **not yet persist quota/cooldown state across separate GitHub workflow runs**. A later Hermes service mode can persist provider/model/credential health centrally (for example in Redis) so multiple repositories share routing intelligence. The v1.2 module boundaries are designed so that persistence can be added without changing the review policy or provider interface.
