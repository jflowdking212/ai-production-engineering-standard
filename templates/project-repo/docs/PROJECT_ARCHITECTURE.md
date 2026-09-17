# Project Architecture — TEMPLATE, NOT FILLED IN

Do not hand-fill this generically. Point an agent at this actual repository
and have it inspect the real code before writing anything here — an invented
architecture doc is worse than no doc, because the AI reviewer will trust it.

Fill in from what actually exists in this repo:

## Frontend
<!-- framework, state management, routing -->

## Backend / API layer
<!-- framework, how endpoints are organized -->

## Database
<!-- engine, ORM, migration tool -->

## Authentication & Authorization
<!-- how auth works, session vs token, RBAC model if any -->

## Multi-tenant model
<!-- how tenant isolation is enforced - middleware, row-level, schema-per-tenant -->

## External services
<!-- payment processor, email, AI providers, storage, queues -->

## Deployment / infrastructure
<!-- where this actually runs - be specific, mark unknowns explicitly -->

## Critical production paths
<!-- the flows that must never silently break: auth, payment, data deletion, publishing -->
