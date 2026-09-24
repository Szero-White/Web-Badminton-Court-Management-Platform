# Architecture

## Runtime topology

```text
Browser
  |
  v
Nginx (React SPA + reverse proxy)
  |
  +--> /api/v1/* --> Go / Gin API
                       |       |
                       |       +--> Redis (distributed booking holds)
                       v
                    PostgreSQL
```

The public deployment exposes only Nginx. PostgreSQL, Redis, and the Go API remain on the internal Docker network.

## Backend boundaries

- `cmd/api`: composition root, lifecycle, graceful shutdown.
- `internal/server`: route registration and health/readiness endpoints.
- `internal/handler`: HTTP validation and response mapping.
- `internal/service`: business rules and transaction orchestration.
- `internal/repository`: database queries and row-level persistence.
- `internal/models`: domain persistence models split by concern.
- `internal/middleware`: JWT authorization, CORS, security headers, request IDs, body limits, auth rate limiting.
- `internal/timeutil`: canonical `Asia/Ho_Chi_Minh` business timezone.
- `pkg/response`: consistent API envelope.

## Frontend boundaries

- `src/routes`: application routes and role protection.
- `src/components`: reusable cross-feature UI.
- `src/features`: larger feature views extracted from page orchestration.
- `src/pages`: page state, effects, and feature orchestration.
- `src/services/api`: HTTP client plus API modules by domain.
- `src/utils`: date/time, money, and booking-grid transformations.
- `src/styles`: global CSS split into focused files.

## Concurrency model

Booking creation uses a layered defense:

1. Redis `SET NX` hold where Redis is available.
2. Database transaction checks active bookings.
3. A PostgreSQL partial unique index prevents more than one active booking for a time slot.
4. Expired pending holds are canceled by a background worker and opportunistically before booking creation.

This avoids relying on UI state for double-booking prevention.

## Data consistency

Deposit changes and refunds generate payment records instead of only mutating booking totals. This keeps dashboard revenue based on the payment ledger rather than on mutable booking state.
