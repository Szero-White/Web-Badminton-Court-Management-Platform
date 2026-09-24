# Professional product audit

Date: 2026-09-24

## Refactor completed in this package

### Reliability and booking integrity
- Fixed PostgreSQL-incompatible SQLite-only date SQL in reporting/repricing paths.
- Added expiry handling for pending booking holds.
- Added database transactions and row locking to sensitive booking/payment updates.
- Prevented deposits from exceeding the outstanding amount.
- Recorded refunds and manual deposit adjustments in the payment ledger.
- Preserved a database-level unique active-slot constraint to prevent double booking under concurrency.
- Generated slots from each court's configured operating hours instead of a hard-coded 24-hour day.
- Partial court updates no longer reset `is_active` or `is_maintenance` when fields are omitted.
- Standardized business dates to `Asia/Ho_Chi_Minh`.

### Security and server behavior
- Restricted JWT parsing to HS256 and separated access/refresh token types.
- Raised account password minimum to 8 characters.
- Prevented customers from self-confirming deposits; only trusted staff/admin can confirm manual payments until a real payment gateway with signed webhooks is integrated.
- Added request IDs, security headers, request-body limit, configurable CORS, and authentication rate limiting.
- Added HTTP read/write/idle timeouts and graceful shutdown.
- Production mode refuses SQLite fallback and demo seeding.
- Added database pool tuning and Redis readiness behavior.

### Maintainability
- Split large backend model/repository/service/handler files by responsibility.
- Split API client modules by domain.
- Extracted route protection/navigation from `App.jsx`.
- Extracted booking-grid/date/money helpers shared by customer/staff/admin screens.
- Extracted large staff/admin booking views into feature components.
- Rebuilt the staff-management page into focused components and dedicated CSS.
- Split the 1,200+ line global stylesheet into focused style modules.
- Application source files are kept below 350 lines after splitting large handlers, pages, and stylesheets; generated lockfiles are excluded from this rule.
- Removed local database dumps, backup/runtime artifacts, one-off maintenance scripts, build logs, IDE config, and accidental root lockfile from the source package.

### Deployment and repository hygiene
- Added multi-stage Docker builds, non-root backend runtime, Nginx SPA/reverse-proxy config, health/readiness checks, and Redis/PostgreSQL persistence.
- Added one-command LAN demo and optional Cloudflare Tunnel script.
- Added CI, `.editorconfig`, Docker ignore files, stronger `.gitignore`, deployment/API/architecture docs, contribution and security policies.
- README demo credentials match the demo seed code.

## What is still required before selling as a commercial SaaS/product

This codebase is now structured as a professional portfolio/small-business deployment baseline, but no static refactor can honestly certify a system as “enterprise production ready” without runtime evidence. Before selling to real customers, complete these operational items:

1. **Automated test coverage:** service/repository integration tests against PostgreSQL and end-to-end tests for booking, payment, cancellation, check-in, and role authorization.
2. **Load test on target infrastructure:** define expected concurrent users/RPS, then measure p95 latency, error rate, DB pool saturation, and booking contention.
3. **Observability:** centralized structured logs, metrics, uptime monitoring, exception alerting, and audit retention.
4. **Backup/DR:** automated encrypted PostgreSQL backups, off-host retention, documented RPO/RTO, and restore drills.
5. **TLS/domain:** permanent HTTPS endpoint, HSTS at the TLS edge, secure DNS, and certificate renewal.
6. **Payment gateway:** if accepting online money, use a real provider with signed webhooks/idempotency instead of treating manual deposit records as a payment gateway.
7. **Privacy/legal controls:** data-retention policy, customer-data export/deletion process, terms/privacy notice, and access-log policy appropriate to the jurisdiction/business.
8. **Global rate limiting when scaled:** current auth limiter is per API process; use Redis/API gateway limits for multiple replicas.
9. **Migration discipline:** the SQL baseline mirrors current models, while startup still uses GORM AutoMigrate. For a long-lived commercial deployment, adopt an explicit versioned migration runner and stop schema mutation at application startup.
10. **Release process:** immutable image tags, image/dependency scanning, staging environment, rollback procedure, and production secrets from a secret manager.

## Verdict

The refactored package is suitable as a **professional portfolio demo and a strong small-business deployment baseline**. It is materially cleaner, safer, more maintainable, and more scalable than the original source. It should not be marketed as having passed enterprise production certification until the runtime tests and operational controls above are actually implemented and evidenced.
