# Load testing

The backend is configured for concurrent production traffic with PostgreSQL pooling, Redis-backed booking locks, database transactions/row locks, a database-level active-slot uniqueness constraint, and HTTP timeouts. Capacity still depends on the deployment machine and database sizing, so it must be measured rather than guessed.

## Read-traffic baseline

Install k6, start the Docker stack, then run:

```bash
k6 run tests/load/read-traffic.k6.js
```

To test another host:

```bash
BASE_URL=https://demo.example.com k6 run tests/load/read-traffic.k6.js
```

The supplied baseline ramps to 100 concurrent virtual users and expects less than 1% failed requests and p95 latency below 750 ms. Adjust thresholds to the actual SLA.

## Booking-concurrency validation

Before commercial release, also run an authenticated scenario where multiple users attempt to book the same slot simultaneously. The acceptance criterion is exactly one active booking for that slot; every competing request must fail cleanly without duplicate rows or negative inventory/payment state.

Record p50/p95/p99 latency, error rate, PostgreSQL connection utilization, CPU/RAM, Redis latency, and database lock waits for the target server size.
