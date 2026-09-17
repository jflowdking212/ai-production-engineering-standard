# Contributing to APES

APES protects other repositories, so changes to its enforcement behavior must be treated as security-sensitive.

1. Do not commit directly to protected release branches once branch protection is enabled.
2. Keep changes scoped and explain any effect on risk classification, provider routing, secret handling, review coverage, or merge gating.
3. Run `npm test` before requesting review.
4. Add or update regression tests for every enforcement change.
5. Do not add real provider credentials, account identifiers, customer data, or production secrets to fixtures, logs, examples, or documentation.
6. Do not move an existing production release tag. Publish a new version and upgrade callers intentionally.

A change that weakens a fail-closed control requires explicit human review and matching regression coverage.
