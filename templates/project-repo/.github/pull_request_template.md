## Requirement
<!-- one sentence: what this PR does and why -->

## Affected systems
<!-- modules/services touched, including indirect dependencies -->

## Risk notes
<!-- CI assigns the authoritative tier. Note any sensitive areas you believe are involved. -->

## Architecture / DB / API impact
- Architecture:
- Database (migration? backward compatible?):
- API (new/changed endpoints, contract changes):

## Security impact
<!-- auth/authz, tenant isolation, secrets, validation, payment/webhook handling, destructive operations -->

## Tenant isolation impact
<!-- explain how cross-tenant read/write remains impossible, or state not applicable -->

## Tests and validation
<!-- tests added + actual local typecheck/lint/test/build results -->

## Rollback plan
<!-- how to revert or forward-fix safely if production fails -->

## Definition of Done
- [ ] Required local validation passed
- [ ] Regression coverage added for bug fixes where practical
- [ ] No unrelated changes bundled into this PR
- [ ] Security/tenant/payment implications documented where applicable
- [ ] APES `quality-gate` passes
- [ ] Required human approval(s) obtained under branch protection/rulesets

## APES-control changes
<!-- If this PR changes .apes.json, workflows, CODEOWNERS, or APES policy files, explain why. These are security-control changes and should receive independent review. -->
