# Badminton Court Management Platform

> Production-oriented full-stack platform for badminton court booking and daily facility operations.  
> Nền tảng full-stack quản lý sân cầu lông, booking, check-in, doanh thu, đồ uống và vận hành tại quầy.

**Demo after one-command startup:** `http://localhost:8080`  
**LAN demo:** `http://<your-LAN-IP>:8080` (the launcher prints the exact address)  
**Temporary public HTTPS demo:** run `scripts/run-public.ps1 -Tunnel`; `cloudflared` prints the public URL.  
**Repository:** `https://github.com/Szero-White/Web-Badminton-Court-Management-Platform`

> A permanent public server/domain is not hard-coded in this repository because no production host was supplied. Update this line with the real HTTPS domain after deployment rather than publishing a fake demo URL.

## Demo accounts

The demo stack seeds these accounts when `DEMO_SEED_ENABLED=true`:

| Role | Email | Password | Main functions |
|---|---|---|---|
| Admin | `admin@badminton.demo` | `Admin@12345` | Dashboard, booking desk, courts, staff, beverages, revenue |
| Staff | `staff@badminton.demo` | `Staff@12345` | Booking operations, check-in, beverage counter, shift transactions |
| Customer | `customer@badminton.demo` | `Customer@12345` | Browse schedule, place booking holds, view/cancel personal bookings |

**Never enable demo seeding or reuse these passwords in a real commercial production environment.**

## Why this repository is structured this way

The project is intentionally organized like a maintainable business application instead of a single-file demo:

```text
.
├── backend/
│   ├── cmd/api/                 # Composition root and process lifecycle
│   ├── internal/
│   │   ├── config/              # Environment configuration
│   │   ├── db/                  # Connections, schema migration, demo seed
│   │   ├── handler/             # HTTP handlers
│   │   ├── middleware/          # Auth, security, rate limiting, CORS
│   │   ├── models/              # Domain persistence models
│   │   ├── repository/          # Data access
│   │   ├── server/              # Router + health/readiness
│   │   ├── service/             # Business logic
│   │   └── timeutil/            # Business timezone
│   ├── migrations/              # PostgreSQL baseline schema
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/          # Shared UI
│   │   ├── features/            # Feature-level views
│   │   ├── pages/               # Page orchestration
│   │   ├── routes/              # Route definitions / role guards
│   │   ├── services/api/        # API modules by domain
│   │   ├── styles/              # Focused CSS modules
│   │   └── utils/               # Shared booking/date/format helpers
│   ├── nginx.conf               # SPA + reverse proxy
│   └── Dockerfile
├── docs/                        # Architecture, API, deployment, audit
├── scripts/                     # Run/quality utilities
├── .github/workflows/ci.yml     # GitHub Actions CI
├── docker-compose.yml           # Demo/local full stack
└── docker-compose.prod.yml      # Production override/profile
```

## Main features

### Customer
- View court schedule by date.
- Register/login as customer.
- Place a temporary booking hold.
- View personal booking status; payment is confirmed only by trusted staff/admin or a future payment-gateway integration.
- View personal bookings and cancel subject to policy.

### Staff
- Create bookings for walk-in/monthly customers.
- Operate booking desk and check-in flow.
- Update customer/booking details and deposits.
- Sell/restock beverages.
- Record cash/transfer/refund/owner-withdrawal transactions.
- Review shift summary.

### Admin
- Booking desk and booking cancellation.
- Court setup, operating hours, price, active/maintenance state.
- Staff/admin account management.
- Beverage catalog, stock adjustment, audit history.
- Revenue/booking dashboard.

## Reliability and security highlights

- PostgreSQL is the production source of truth; SQLite is development fallback only.
- Redis distributed holds plus DB transaction checks and a unique partial index protect against double booking.
- Pending holds expire automatically.
- Payment/refund/deposit-adjustment records preserve accounting history.
- JWT access and refresh tokens have explicit token types and HS256 validation.
- Role-based authorization for customer/staff/admin routes.
- Configurable CORS, auth rate limiting, request body limit, request IDs and security headers.
- HTTP timeouts, graceful shutdown, readiness checks and PostgreSQL connection pooling.
- `Asia/Ho_Chi_Minh` is the canonical business timezone.

## Quick start — Docker

### Windows / PowerShell

```powershell
.\scripts\run-public.ps1
```

Then open:

```text
http://localhost:8080
```

The launcher persists local demo secrets in Git-ignored `.env.demo.local`, waits for `/ready`, and then prints the local/LAN URLs.

To expose a temporary public HTTPS demo after installing `cloudflared`:

```powershell
.\scripts\run-public.ps1 -Tunnel
```

### Docker Compose directly

```bash
docker compose up -d --build
```

Stop the stack:

```bash
docker compose down
```

Preserve database data by keeping the named volumes. Use `docker compose down -v` only when you intentionally want to remove demo data.

### Production Compose

Create your secure production environment from `.env.production.example`, then run:

```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Do not enable demo seeding in production. Put the public Nginx endpoint behind a real TLS/domain edge.

## Local development without Docker

Backend:

```bash
cd backend
cp .env.example .env
go run ./cmd/api
```

Frontend:

```bash
cd frontend
cp .env.example .env
npm ci
npm run dev
```

Development URLs: frontend `http://localhost:5173`, API `http://localhost:8080`.

## Quality checks

On Windows:

```powershell
.\scripts\quality-check.ps1
```

The script formats/tests/vets Go, installs/builds the frontend, and validates Docker Compose configuration.

GitHub Actions runs equivalent backend/frontend checks on pushes and pull requests to `main`.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API reference](docs/API.md)
- [Deployment guide](docs/DEPLOYMENT.md)
- [Professional product audit](docs/PROFESSIONAL_AUDIT.md)
- [Load testing](docs/LOAD_TESTING.md)
- [Commercial release checklist](docs/RELEASE_CHECKLIST.md)
- [Security policy](SECURITY.md)
- [Contributing](CONTRIBUTING.md)
- [Refactor changelog](CHANGELOG_REFACTOR.md)

## Production note

This refactor makes the repository a strong professional portfolio and small-business deployment baseline. “Enterprise-ready” should only be claimed after the target environment has passed automated integration/E2E tests, realistic load tests, backup/restore drills, observability setup, permanent TLS/domain configuration, and an operational release/rollback process. The exact remaining checklist is documented in `docs/PROFESSIONAL_AUDIT.md`.
