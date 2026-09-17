> Historical hardening notes for APES v1.1.x. APES v1.2.0 supersedes the single-credential Gemini/provider-routing statements below. See `docs/HERMES_ROUTING.md` and `docs/releases/v1.2.0.md` for current behavior.

# Review notes for hardened APES v1

This revision was produced from the submitted `ai-engineering-pipeline.zip` after a full implementation audit.

## Blocking defects corrected

- Final quality gate previously defaulted missing AI outputs to PASS and could pass after failed/skipped upstream checks. Gate now verifies upstream job results and fails closed.
- Risk classifier previously used paths only despite policy claiming destructive diff detection. It now uses protected paths plus deterministic added/removed-line rules.
- Authorization/security paths are CRITICAL; sensitive authorization/tenant/financial logic removed from ordinary files escalates HIGH.
- Test files containing `delete` in the filename no longer become CRITICAL solely due to the filename.
- External AI review is preceded by a deterministic secret preflight; bounded context is scanned before transmission too.
- AI output counts/verdicts are no longer trusted. Findings are schema/line validated and severity/verdict are recomputed locally.
- PR/repository content is explicitly untrusted data to reduce prompt-injection risk.
- Silent 60,000-character truncation was removed. Complete diff chunks are reviewed or the review fails and asks for a smaller PR/configured limit.
- Inline comment failures now fail the required AI job instead of being silently logged.
- Mutable raw `main` script downloads were removed. Reusable workflow checks out the central APES repository at a configured stable ref.
- Job-level GitHub token permissions and `persist-credentials: false` were added.
- Project-specific `.apes.json` was introduced without allowing projects to remove the central sensitive-path baseline.
- Required validation scripts are explicit. Missing required scripts or unlocked installs fail instead of being silently skipped.
- Provider-neutral `AGENTS.md` template and Claude wrapper were added.
- Central APES standard, security policy, architecture/business/runbook/audit templates were added.

## Gemini change

The submitted multi-key Gemini free-tier rotation was replaced with a single authorized credential, bounded retry/backoff, and model fallback. APES does not rotate accounts/keys to circumvent quota limits.

## Verification performed

- Node syntax validation for all scripts/tests.
- JSON parsing for APES configuration/package files.
- YAML parsing for reusable/caller workflows.
- 56 Node regression tests covering risk classification, fail-closed gating, strict severity-count parsing, added/removed secret handling and outbound redaction, restricted fork/Dependabot AI skip, malformed review output, P0/P1/P2 behavior, LOW AI skip, oversized review coverage, path safety, and inline-comment API failure.

## Still requires real GitHub/project integration before production

- Push the central repository and create a reviewed release/tag (prefer a full commit SHA in production callers).
- Populate project architecture/business/security/runbook documents from each real codebase.
- Configure approved external providers and repository secrets.
- Configure branch rules: reusable quality-gate check, human approval, stale-approval dismissal, conversation resolution, and CODEOWNERS/required-workflow protections where available.
- Run the workflow on a sacrificial/lower-risk repository and confirm GitHub check names/permissions/provider behavior in the real account.
- Enable project-appropriate CodeQL/SAST where available; an example is included but intentionally not auto-enabled.
- Build staging/canary/rollback automation only after the target project's actual infrastructure is documented.

## v1.1.1 compatibility hardening

The project template supplied after the hardened v1 pass exposed a configuration-drift risk:
its `.apes.json` used keys from a different schema. Prior to v1.1.1, unknown keys could be
silently ignored because config loading merged only recognized fields.

v1.1.1 therefore adds strict configuration-shape validation. Unknown or wrongly shaped
`.apes.json` keys now fail loudly rather than creating a false sense that a security policy
is active. The bundled project template is aligned to the central schema, the reusable caller
explicitly grants the permissions required for inline PR comments, and stale documentation
about diff truncation/context behavior has been corrected.

## v1.1.1 follow-up hardening

- Added-secret material remains merge-blocking; potential credentials on removed or surrounding diff lines are redacted before any external AI transmission.
- Negative/malformed P0/P1 counts now fail closed.
- Fork-originated and Dependabot PRs have an explicit restricted mode: no external provider secrets, no AI inline-comment write path, deterministic/security checks still required, and human approval is delegated to branch protection/rulesets.
- Added a `pipeline_ref` guard that rejects mutable refs such as `main`; exact semver tags or full 40-character SHAs are accepted.
- Gemini defaults were independently checked against Google's current official model catalog rather than changed based on an unverified report.
