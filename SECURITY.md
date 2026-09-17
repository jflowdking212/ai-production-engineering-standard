# Security Policy

APES is a security-sensitive engineering gate. Please do not publish working exploit details, provider credentials, repository secrets, or private project data in a public issue.

## Reporting a vulnerability

For now, report a suspected APES security issue privately to the repository owner through a private channel associated with the GitHub account. Do not include live API keys, tokens, customer data, or production credentials in the report.

## Supported version

The current supported release line is `v1.2.x`. Production callers should pin APES to an exact reviewed release tag or, preferably, the full reviewed commit SHA.

## Scope

Security-sensitive areas include reusable workflows, secret scanning/redaction, trusted-base policy materialization, risk classification, Hermes routing, provider adapters, Gemini credential-pool handling, review-output validation, and fail-closed quality-gate enforcement.
