# Refactor changelog — 2026-09-24

- Reorganized backend into focused model, repository, service, handler, middleware, server, and time utility files.
- Fixed booking hold expiry, accounting consistency, court partial updates, operating-hour slot generation, and PostgreSQL query portability.
- Hardened JWT validation, CORS, request limits, auth rate limiting, DB pooling, Redis behavior, timeouts, and graceful shutdown.
- Modularized frontend routing, navigation, API services, shared booking/date utilities, large booking views, and staff management UI.
- Split global CSS into focused files and standardized visible navigation language to Vietnamese.
- Replaced stale schema migration with a current PostgreSQL baseline.
- Added Docker/Nginx deployment, LAN/public-demo launcher, CI, repository policies, and professional documentation.
- Fixed a package-level `normalizePhone` redeclaration that would block Go compilation after the split.
- Restricted manual deposit confirmation to staff/admin; customers can view/cancel their own bookings but cannot self-mark a payment as successful.
- Added a customer booking-management panel and protected customer-only ownership checks for booking actions.
- Protected the current admin account and the last administrator from destructive staff-management operations.
- Removed unused promotion/membership models and stale one-off maintenance/runtime files.
- Split remaining oversized stylesheets; application source files now stay below 350 lines.
- Made the public launcher persist local demo secrets across restarts and wait for readiness before exposing the app.
- Fixed the PowerShell quality script so `gofmt`, test, vet, build, frontend build, and Compose validation run correctly.
