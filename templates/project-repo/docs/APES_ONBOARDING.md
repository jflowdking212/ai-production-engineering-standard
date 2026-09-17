# APES project onboarding checklist — v1.2.0

This template is not production-ready merely because it has been copied into a repository.
Complete these steps deliberately:

1. Confirm the repository is a supported Node/TypeScript project for APES v1.2.
2. Edit `.apes.json` to match real package scripts and project-sensitive paths. The template sets production dependency auditing to `required`; downgrade it only as an explicit, documented onboarding exception while remediation is underway.
3. Remember that once APES is established, each PR is evaluated against the base-branch policy. Changes to `.apes.json` take effect only after merge, which prevents a PR from weakening its own gate.
4. Populate `PROJECT_ARCHITECTURE.md`, `BUSINESS_RULES.md`, `SECURITY_POLICY.md`, and `PRODUCTION_RUNBOOK.md` from the actual implementation/infrastructure.
5. Decide whether external code transmission is permitted. If yes, explicitly add the approved topology to `review.allowedExternalProviders`:
   - OpenRouter topology: `openrouter` + optional `gemini` fallback;
   - direct topology: `openai` and/or `anthropic` + optional `gemini` fallback;
   - Gemini-only: `gemini`.
   Add only the corresponding GitHub secret(s). For multiple Gemini projects, prefer `GEMINI_API_KEYS_JSON`.
6. Replace `@YOUR_SECURITY_OWNER` in `CODEOWNERS.example`, rename it to CODEOWNERS, and adjust sensitive paths for the repository.
7. Publish/verify the central `v1.2.0` APES release. Prefer pinning the reusable workflow to the reviewed full commit SHA after rollout.
8. Configure branch protection/rulesets to require:
   - `call-apes-v1 / quality-gate`
   - at least one human approval
   - stale-approval dismissal on new commits
   - conversation resolution
   - protection of workflow/APES-policy changes where your GitHub plan supports it.
9. Open a test PR that exercises LOW and non-LOW behavior before relying on the gate.
10. Run an existing-project audit before claiming an inherited/legacy project is APES-clean.

If any required check is missing or cannot run, fix onboarding rather than weakening the gate.

### Fork and Dependabot pull requests

Fork-originated PRs and Dependabot PRs do not receive repository Actions secrets and normally receive a read-only `GITHUB_TOKEN`. APES therefore does **not** attempt external AI review or inline AI comments on those restricted PRs. Deterministic validation, risk classification, dependency/security checks, and secret preflight still run; the final machine gate may pass only if those controls succeed. A human approval remains mandatory through branch protection/rulesets before merge.

Do not solve this by switching the build to `pull_request_target` and executing the untrusted PR head with secrets. Keep untrusted-code execution on the ordinary `pull_request` path.
