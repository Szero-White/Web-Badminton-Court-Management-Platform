# API reference

Base path: `/api/v1`. JSON responses use the project response envelope. Protected endpoints require `Authorization: Bearer <access-token>`.

## Public

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/register` | Create customer account |
| POST | `/auth/login` | Login |
| POST | `/auth/refresh` | Rotate access/refresh pair |
| GET | `/courts` | Active courts |
| GET | `/slots/available?day=YYYY-MM-DD` | Available slots |
| GET | `/slots/day?day=YYYY-MM-DD` | Day schedule |
| GET | `/beverages` | Active beverage catalog |

## Authenticated customer

| Method | Path | Purpose |
|---|---|---|
| POST | `/bookings/pending` | Hold a slot |
| GET | `/bookings/me` | Customer bookings |
| POST | `/bookings/:booking_id/cancel` | Cancel booking |

## Staff (staff or admin role where configured)

| Method | Path | Purpose |
|---|---|---|
| GET | `/staff/slots/day?day=YYYY-MM-DD` | Detailed day schedule for operations |
| POST | `/staff/checkin` | Find/check in booking |
| POST | `/staff/bookings/create` | Create booking for customer |
| POST | `/bookings/:booking_id/deposit` | Confirm deposit/payment (staff/admin only) |
| PUT | `/staff/bookings/:booking_id` | Update booking |
| GET | `/staff/beverages` | Beverage inventory |
| POST | `/staff/beverages/sell` | Record beverage sale |
| POST | `/staff/beverages/restock` | Restock beverage |
| POST | `/staff/transactions` | Record shift transaction |
| POST | `/staff/transactions/refund` | Record refund |
| GET | `/staff/shift-summary` | Shift totals |
| GET | `/staff/transactions` | Shift transactions |

## Admin

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/slots/day?day=YYYY-MM-DD` | Detailed day schedule for admin booking desk |
| GET/POST | `/admin/staff` | List/create internal accounts |
| PUT/DELETE | `/admin/staff/:id` | Update/delete internal account |
| GET/POST | `/admin/bookings` | List/create bookings |
| PUT/DELETE | `/admin/bookings/:booking_id` | Update/cancel booking |
| GET/POST | `/admin/beverages` | List/create beverages |
| PUT/DELETE | `/admin/beverages/:beverage_id` | Update/deactivate beverage |
| POST | `/admin/beverages/:beverage_id/adjust-stock` | Adjust stock |
| GET | `/admin/beverages/:beverage_id/history` | Inventory audit history |
| GET/POST | `/admin/courts` | List/create courts |
| PUT | `/admin/courts/:court_id` | Update court |
| GET | `/admin/dashboard/summary` | Revenue/booking dashboard |

Operational endpoints: `GET /health` (process liveness) and `GET /ready` (database plus required Redis readiness).
