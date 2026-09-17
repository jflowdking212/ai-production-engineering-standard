# APES Pipeline Security Policy

## Trust boundaries

- Pull-request code and metadata are untrusted.
- Deterministic validation may execute PR code but receives no model-provider secrets and uses checkout with `persist-credentials: false`.
- AI-review jobs receive provider credentials but do not execute project code.
- Repository content cannot instruct the reviewer or change the central system prompt.

## Trusted policy source

For an established repository, `.apes.json` is materialized from the pull request's **base commit**, not from the PR head. A PR therefore cannot weaken its own required tests, provider policy, dependency-audit mode, or review limits and have those weaker settings govern the same PR. A first-time onboarding PR may bootstrap from its head config only when no APES config exists on the base branch; do not rely on APES branch protection until that bootstrap config is merged.

## Secrets

Potential secrets introduced on added lines block the gate. Before any external AI call, the complete outbound diff and PR metadata are sanitized so credentials appearing only in removed/surrounding lines are redacted rather than transmitted. Bounded project context is independently scanned and is refused when it contains a potential secret. Enable the hosting platform's native secret scanning as an additional control; the APES regex scanner is a preflight, not a complete credential-detection product.

Never place production credentials in `.apes.json`, prompts, tests, fixtures, logs, comments, or repository documentation.

## Provider data handling

A repository must explicitly list approved external providers in `.apes.json`. Hermes may route only among that allow-list; the mere presence of OpenRouter, OpenAI, Anthropic, or Gemini credentials does not authorize code transmission. Before enabling external review for client/proprietary repositories, confirm contractual/data-residency/privacy requirements. If external transmission is prohibited, use an approved private reviewer implementation instead of weakening the gate.

Gemini credential-pool telemetry uses opaque project ids and must never log API keys or account identities. Multiple credentials are provided through GitHub encrypted secrets, not repository configuration.

## Token permissions

Use job-level GitHub token permissions. Project-code execution jobs receive `contents: read` only. The AI-review job receives `pull-requests: write` solely to post required inline comments. The caller workflow must permit these permissions; a central reusable workflow cannot elevate permissions denied by the caller/repository.

## Supply-chain controls

Pin project callers to a stable APES release tag. Do not consume central scripts from mutable `main`. Protect APES releases and review changes to `.github/workflows/**`, `.apes.json`, CODEOWNERS, and deployment controls as CRITICAL.

For stronger supply-chain assurance, pin third-party GitHub Actions to reviewed commit SHAs and use dependency update automation.

## Human controls

Require approvals and dismiss stale approvals. Sensitive paths should have CODEOWNERS. Workflow/ruleset changes require independent human review. Do not treat an AI PASS as authorization to merge a sensitive change.

## GitHub Actions reference pinning

For production repositories, GitHub recommends a full-length commit SHA as the strongest immutable reference for actions/reusable workflows. Release tags are convenient during rollout, but should be treated as immutable and upgraded intentionally. Third-party actions in this template use major-version tags for portability; harden them to reviewed SHAs when the target repository's update process is established.
