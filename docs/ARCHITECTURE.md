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

## Court pricing consistency

Court pricing follows an explicit snapshot policy:

1. `courts.base_price` is the current commercial price configured by an administrator.
2. Available current/future `time_slots.price` values are synchronized from the current court price and peak-hour policy.
3. Creating a booking copies the slot price into `bookings.total_price`. That booking total is the immutable commercial snapshot for the reservation.
4. Administrator price changes reprice only available slots from the current time forward. Past slots and slots protected by active bookings are never rewritten.
5. If a future booking is canceled or a pending hold expires, the released slot is synchronized to the current court price before it is shown/booked again.

This separates mutable future pricing from historical accounting data and prevents a later price update from changing the value of an existing booking.

## Booking role boundary

Court scheduling follows a clear role boundary:

1. Customer-facing schedule pages are read-only. They expose availability, price, public booking state, and customer category only; private customer name, phone, and booking code are not returned by the public day-schedule view.
2. Staff and Admin use the same booking-desk interaction pattern and shared schedule-cell presentation. They can create bookings for walk-in or monthly customers and can open booked cells for operational actions.
3. Customer accounts cannot create booking holds or cancel bookings through mutation endpoints. Booking creation/cancellation is performed by Staff/Admin.
4. The public schedule may distinguish walk-in vs monthly occupancy for visual planning without exposing personally identifiable booking data.


## Shift accounting and reporting

Operational accounting is date-scoped and ledger-based:

1. Every staff transaction records both the operating shift and a canonical `business_date` in the Asia/Ho_Chi_Minh timezone.
2. Booking payments also record the actor, role, shift, and business date so court revenue can be reconciled with counter revenue.
3. Shift closing queries by `staff_id + shift + business_date`; the same named shift on another day is never mixed into the current close.
4. Shift summaries combine booking collections and beverage/counter transactions while preserving the underlying ledgers separately.
5. Admin reporting accepts an explicit date range and aggregates booking collections, beverage sales, refunds, stock-in costs, owner withdrawals, outstanding booking balances, occupancy, and per-court booked value.
6. Historical booking prices remain snapshot values; reporting does not reprice bookings from the current pricing rules.

## Booking reschedule transaction

Staff and Admin share the same booking edit workflow. Rescheduling is not implemented as independent per-slot updates. `BookingService.UpdateBookingGroup` locks the active booking group and selected target slots, validates continuity/conflicts, recalculates current prices, reconciles the group payment allocation, and commits the schedule/customer/payment/display changes in one database transaction. This prevents partial moves and keeps the schedule grid, pricing engine, payment ledger, and audit trail consistent.
