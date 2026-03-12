# Architecture Hardening Plan — Fat Cat Shop

> **Status: PROPOSED** — Sequenced roadmap for security, scalability, and resiliency improvements after the current security-hardening pass.

## Intent

This document turns the current architecture concerns into a tangible implementation roadmap. The goal is to preserve the existing storefront and admin experience while reducing operational risk, tightening security boundaries, and preparing the codebase for higher write concurrency and broader production use.

Fat Cat Shop is already a production-leaning single-node commerce application with solid foundations: Next.js 16 App Router, SQLite with Drizzle, custom admin auth, checkout flows, analytics, uploads, recommendation codes, and a capable admin panel. The next step is not feature breadth, but hardening the existing architecture in the places where business risk is concentrated.

Priority is driven by risk to order correctness, operator control, and deployability:
1. Checkout correctness and transactional integrity
2. Auth/session hardening and shared rate limiting
3. Upload and analytics data-safety controls
4. Background job resilience and observability
5. Database scalability path and test coverage

---

## Current-State Assessment

### Strengths
- Clear route separation between storefront, admin, and API layers
- Centralized schema and relational modeling in `src/lib/db/schema.ts`
- Good security baseline already present: CSRF origin checks, auth-required admin APIs, input validation, and rate limiting
- Single-node SQLite deployment keeps the system simple and operationally lightweight
- Shared helpers for settings, auth, analytics, email, and theme logic make future refactors feasible

### Main risks
- Checkout in `src/app/api/checkout/route.ts` performs many dependent writes without one transaction boundary
- Session state is encoded in signed cookies, which limits revocation and auditability
- Rate limiting in `src/lib/rate-limit.ts` is process-local and will not scale across multiple app instances
- Upload handling in `src/app/api/upload/route.ts` trusts MIME type and original extension too much
- Analytics collection in `src/app/api/track/route.ts` has no explicit retention or rollup lifecycle
- Email side effects are fire-and-forget, with no retry or operational visibility
- The repo has no automated test framework despite growing business-critical logic

---

## Wave 1 — Order Integrity and Immediate Safety

### Objective
Reduce the highest business-risk failure mode: partial or inconsistent checkout execution. Tighten immediate attack surfaces in uploads and establish a baseline for operational visibility.

### Why it matters
Checkout is the most important write path in the system. Any inconsistency there can create broken orders, incorrect stock, invalid discount usage, or customer-visible failures. Uploads and logs are lower-frequency paths, but both affect security posture and incident response quality.

### Target design

#### 1. Transactional checkout service
- Center this work on `src/app/api/checkout/route.ts`.
- Extract checkout orchestration into a dedicated service boundary, such as `src/lib/checkout/` or equivalent internal module.
- Execute the following operations inside one database transaction:
  - customer lookup and create/update
  - customer address write
  - order creation
  - order line item inserts
  - order status history insert
  - discount code usage insert and counter increment
  - recommendation code usage insert
  - recommendation code creation for the purchaser
  - product or variant stock decrement
- Treat guarded updates as success-sensitive operations:
  - stock decrement must verify affected-row count
  - discount consumption must verify the code is still valid at commit time
  - any failure must abort the transaction and return a safe checkout error
- Preserve the current public API contract for phase 1:
  - no intended request-body change
  - no intended response-shape break for successful COD checkout

#### 2. Follow-on idempotency design
- Document idempotency as the next checkout enhancement after transactionality.
- Target behavior:
  - duplicate submit requests from the same client should not create duplicate orders
  - use an idempotency key or server-issued checkout token
- This does not need to ship in the first checkout rewrite, but the service boundary should make it easy to add.

#### 3. Upload hardening
- Focus on `src/app/api/upload/route.ts`.
- Replace trust in client-declared MIME types with content validation where feasible.
- Normalize generated file extensions from validated file type rather than the original filename.
- Disable SVG uploads by default unless sanitization is explicitly implemented and documented.
- Align error messages with the actual allowed file types and limits.
- Keep upload size policy explicit and centrally defined.

#### 4. Structured logging baseline
- Add structured logging around:
  - checkout start/success/failure
  - stock conflict failures
  - upload rejection/failure
  - admin auth failures
- Introduce a request or correlation ID carried through API handlers for traceability.
- Avoid logging customer secrets, session tokens, or full payment-related payloads.

### Affected subsystems
- `src/app/api/checkout/route.ts`
- `src/app/api/upload/route.ts`
- `src/lib/db/index.ts`
- `src/lib/db/schema.ts`
- `src/lib/email.ts`
- shared logging utility to be introduced in `src/lib/`

### Acceptance criteria
- A failed checkout write in any downstream step cannot leave behind a partial order.
- Stock decrement conflicts cause the full checkout to fail cleanly.
- Discount usage is committed only when the order is committed.
- Upload handler rejects disallowed or malformed file content consistently.
- Request logs can tie a checkout failure to a specific request ID.

### Risks and rollout notes
- Transactional refactors can surface hidden assumptions in existing helper code.
- Checkout changes should be guarded with integration tests before release.
- SVG removal may affect admin workflows if operators currently rely on SVG favicon uploads; if so, document the temporary compatibility decision explicitly.

---

## Wave 2 — Operator Control and Shared Resilience

### Objective
Move critical controls from process-local behavior to shared, revocable, and observable infrastructure.

### Why it matters
The current auth and throttling approach is acceptable for a single process, but it limits incident response and future scaling. This wave gives operators the ability to revoke sessions, reason about login activity, and enforce limits consistently across instances.

### Target design

#### 1. Server-stored sessions
- Migrate away from self-contained signed session cookies in `src/lib/auth.ts`.
- Introduce a `sessions` table with fields for:
  - `id`
  - `userId`
  - `tokenHash`
  - `createdAt`
  - `expiresAt`
  - `revokedAt` or revoked flag
  - optional `ipAddress`
  - optional `userAgent`
  - optional `lastSeenAt`
- Keep existing login/logout/me endpoints in place.
- Change cookie behavior:
  - store an opaque session token in the cookie
  - validate token server-side against the sessions table
  - allow server-driven logout and revocation
- Preserve current admin behavior where possible while improving auditability and control.

#### 2. Shared rate limiting
- Replace the in-memory `Map` in `src/lib/rate-limit.ts` with a shared backing store.
- Preferred design:
  - Redis-backed rate limiting for production deployments that can support one extra service
- Transitional fallback:
  - SQLite-backed rate limiting only for minimal self-hosted environments
- Preserve current rate-limit behavior on:
  - login
  - checkout
  - customer lookup
- Add enough abstraction so handlers do not care whether the backing store is Redis or SQLite.

#### 3. Background job boundary
- Introduce a lightweight async job boundary for outbound email and similar side effects.
- Preferred starting point for this repo:
  - DB-backed jobs table with simple polling worker if remaining single-node/self-hosted
- Required design points:
  - retry count and backoff policy
  - terminal failure state
  - payload shape versioning or event type field
  - admin/operator visibility into failed jobs
- Move email sending out of the request success path once checkout has committed.

### Affected subsystems
- `src/lib/auth.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/logout/route.ts`
- `src/app/api/auth/me/route.ts`
- `src/lib/rate-limit.ts`
- `src/lib/email.ts`
- `src/app/api/checkout/route.ts`
- new session and jobs schema in `src/lib/db/schema.ts`

### Acceptance criteria
- Admin sessions can be revoked server-side without waiting for cookie expiry.
- Login/logout/me continue to work without route-path changes.
- Rate limits apply consistently across multiple app processes using the same backing store.
- Checkout no longer sends emails directly from the request path.
- Failed email sends are retried and end in a visible failure state if retries are exhausted.

### Risks and rollout notes
- Session migration needs a cutover plan so existing admin logins fail safely rather than unpredictably.
- Redis should be optional at the deployment level, not mandatory for local development.
- Job workers need careful startup/shutdown behavior in Docker and standalone deployments.

---

## Wave 3 — Data Lifecycle, Scale Readiness, and Delivery Confidence

### Objective
Make the system sustainable over time by controlling data growth, improving observability, defining database migration readiness, and introducing automated tests and CI.

### Why it matters
By this stage the app will be safer in the short term, but still limited by missing lifecycle controls and delivery safeguards. This wave improves the ability to operate the system continuously and change it confidently.

### Target design

#### 1. Analytics retention and privacy policy
- Focus on `src/app/api/track/route.ts` and the analytics tables in `src/lib/db/schema.ts`.
- Add strict limits for analytics metadata:
  - allow-list metadata keys per event where practical
  - cap serialized metadata size
  - reject or trim oversized payloads consistently
- Define retention and rollup behavior:
  - raw analytics events retained for a finite period
  - older events aggregated into summary tables
  - long-term dashboards use rollups where possible
- Clarify long-term storage posture for:
  - referrer
  - user agent
  - visitor identifier
  - event metadata

#### 2. Observability maturity
- Build on wave 1 logging and add:
  - health/readiness endpoints
  - metrics counters for checkout failures, stock conflicts, login failures, rate-limit denials, upload rejections, and job failures
  - consistent event naming across logs and metrics
- Keep interfaces operational rather than user-facing.

#### 3. Database scalability path
- Keep SQLite as the supported current database for single-node deployments.
- Define concrete exit criteria for evaluating Postgres, such as:
  - sustained concurrent write pressure
  - lock contention affecting checkout/admin writes
  - operational need for multiple app instances with shared workload
  - analytics write volume materially impacting core commerce paths
- Ensure new data-access code remains portable:
  - keep Drizzle schema portable
  - minimize SQLite-specific SQL in new code unless isolated behind helper modules
  - document any unavoidable engine-specific behavior

#### 4. Automated testing and CI baseline
- Introduce a test framework and baseline CI pipeline.
- Prioritize test coverage for the highest-risk flows:
  - checkout transaction success and rollback
  - stock conflict handling
  - discount and recommendation code limits
  - auth login/session validation/logout
  - admin mutation authorization
  - upload validation behavior
- Add at least:
  - one end-to-end storefront purchase path
  - one end-to-end admin order-management path
- Include lint plus automated tests in CI before future hardening waves are declared complete.

### Affected subsystems
- `src/app/api/track/route.ts`
- `src/lib/analytics.ts`
- `src/lib/analytics-queries.ts`
- `src/lib/db/schema.ts`
- deployment/configuration docs
- CI configuration to be introduced at the repo root

### Acceptance criteria
- Analytics data has an explicit retention and aggregation policy implemented in code or scheduled jobs.
- Operators can observe service health and core failure counters without reading raw app logs.
- The codebase has a documented threshold for when to move beyond SQLite.
- CI runs automated checks for the business-critical paths above.

### Risks and rollout notes
- Analytics retention changes may affect historical dashboard fidelity if not introduced with rollups first.
- Health and metrics interfaces should avoid leaking internal details publicly.
- Test setup will require decisions on local DB isolation and seed strategy; keep that work aligned with the transactional checkout refactor.

---

## Public API and Interface Impact

### No intended breaking changes in early waves
- Storefront and admin route structure should remain unchanged.
- Checkout request and response contracts should remain stable during the initial transaction refactor.
- Login/logout/me route paths should not change during session-store migration.

### Expected behavioral tightening
- Upload validation will likely reject some files currently accepted by MIME type alone.
- Analytics collection will continue to accept the same event shape, but metadata enforcement will become stricter.
- Session cookies will move from signed payloads to opaque tokens backed by server state.

---

## Implementation Notes and Defaults

### Preferred infrastructure defaults
- Redis is the recommended shared store for rate limiting if the deployment environment can support one additional service.
- If infrastructure must remain minimal, SQLite-backed rate limiting and DB-backed jobs are acceptable transitional solutions and should be labeled as such in implementation docs.

### Architectural defaults
- Preserve existing storefront and admin behavior unless a security control requires stricter validation.
- Favor internal service boundaries over route-level complexity.
- Keep changes incremental by wave; do not combine all hardening efforts into one delivery.

---

## Validation Plan

The following scenarios should be used to validate future implementation work from this roadmap:

- Checkout partial-failure simulation rolls back all writes
- Concurrent stock decrement conflicts fail safely without partial orders
- Session revocation invalidates active admin cookies
- Shared rate limiting works across multiple processes
- Malicious or edge-case uploads are rejected consistently
- Analytics retention and rollup jobs preserve dashboard utility
- Email retry handling records and surfaces exhausted failures
- CI executes integration and end-to-end smoke tests successfully

---

## Recommended execution order

1. Wave 1 — transactional checkout, upload hardening, structured logging
2. Wave 2 — server-side sessions, shared rate limiting, job queue
3. Wave 3 — analytics retention, observability maturity, database scaling path, automated tests

This ordering keeps the first investment focused on correctness and risk containment, then moves into operator control, then into longer-horizon scale and delivery maturity.
