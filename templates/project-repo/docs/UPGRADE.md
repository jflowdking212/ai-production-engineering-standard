# Upgrading APES in this repository

APES upgrades are deliberate security-control changes.

1. Review the target central APES release notes and diff.
2. Update the vendored project files from that release, including `AI_AGENT_INSTRUCTIONS.md`, `docs/AI_REVIEW_POLICY.md`, and template changes.
3. Update `VERSION`.
4. Update `.github/workflows/ai-review.yml` so both the reusable-workflow ref and `pipeline_ref` point to the same reviewed release (or preferably its exact commit SHA).
5. Reconcile `.apes.json` against the new release schema. Do not carry forward deprecated/unknown keys. For APES v1.2+, review Hermes routing mode, approved providers, model catalog overrides, and Gemini pool settings explicitly.
6. Run the central APES regression suite and the project's own required checks.
7. Merge the upgrade as a dedicated security-control PR with human review.

Do not point production repositories at mutable `main` or an unreviewed `latest` ref.

Mutable refs such as `main`, `master`, `latest`, and moving major tags are rejected by the reusable workflow's ref guard. Use an exact `vX.Y.Z` release tag or a reviewed 40-character commit SHA.
