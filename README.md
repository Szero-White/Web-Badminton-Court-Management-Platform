# Badminton Court Management Platform

> Production-oriented full-stack platform for badminton court booking and daily facility operations.  
> Nền tảng full-stack quản lý sân cầu lông, booking, check-in, doanh thu, đồ uống và vận hành tại quầy.

**Local frontend:** `http://localhost:5173`  
**Local API:** `http://localhost:8080`  
**Docker demo:** `http://localhost:8080`  
**Repository:** `https://github.com/Szero-White/Web-Badminton-Court-Management-Platform`

## Demo accounts

Local demo setup can seed these accounts automatically:

| Role | Email | Password | Main functions |
|---|---|---|---|
| Admin | `admin@badminton.demo` | `Admin@12345` | Dashboard, booking desk, courts, staff, beverages, revenue |
| Staff | `staff@badminton.demo` | `Staff@12345` | Booking operations, check-in, beverage counter, shift transactions |
| Customer | `customer@badminton.demo` | `Customer@12345` | Browse schedule, place booking holds, view/cancel personal bookings |

> Demo credentials are for local/demo environments only. Never reuse them in production.

## Quick start — local development (recommended)

This is the recommended workflow for contributors and reviewers who want to run the project without Docker.

### Prerequisites

Install:

- **Go** 1.24+ (or a compatible newer release)
- **Node.js** 20+ and npm
- **PostgreSQL** 15+
- **PowerShell** 5.1+ on Windows
- **Redis** is optional locally. If unavailable, the backend falls back to in-memory booking locks because `REQUIRE_REDIS=false`.

Verify the main tools:

```powershell
go version
node --version
npm --version
```

### 1. Clone and enter the repository

```powershell
git clone https://github.com/Szero-White/Web-Badminton-Court-Management-Platform.git
cd Web-Badminton-Court-Management-Platform
```

### 2. Configure the local environment

Run the one-time setup script:

```powershell
powershell -ExecutionPolicy Bypass -File ".\scripts\setup-local.ps1"
```

The setup script:

- creates `backend/.env` from `backend/.env.example`;
- creates `frontend/.env` from `frontend/.env.example`;
- prompts for the local PostgreSQL password without printing it;
- configures PostgreSQL as the local database;
- creates the `badminton` database when `psql` is available;
- enables demo seed data for local development;
- keeps Redis optional.

Local `.env` files are Git-ignored and must never be committed.

If PostgreSQL is installed but `psql` is not on `PATH`, the script also searches common PostgreSQL installation directories under `C:\Program Files\PostgreSQL`.

### 3. Start backend + frontend

```powershell
powershell -ExecutionPolicy Bypass -File ".\scripts\run-local.ps1"
```

The local launcher starts:

- Go API on `http://localhost:8080`;
- React/Vite frontend on `http://localhost:5173`;
- the default browser after both services are ready.

It also prints the demo accounts in the terminal.

Stop the application with `Ctrl+C` in the Backend and Frontend terminal windows.

### Local health checks

```text
GET http://localhost:8080/health
GET http://localhost:8080/ready
```

`/health` verifies that the API process is alive. `/ready` verifies service readiness, including the database connection.

## Manual local startup

Use this only when you want to run each service yourself instead of using the helper scripts.

### Backend

Create the local environment file:

```powershell
Copy-Item .\backend\.env.example .\backend\.env
```

Edit `backend/.env` and configure at least:

```dotenv
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<your-local-postgres-password>
POSTGRES_DB=badminton
POSTGRES_SSLMODE=disable
ALLOW_SQLITE_FALLBACK=false
REQUIRE_REDIS=false
DEMO_SEED_ENABLED=true
```

Create the database:

```sql
CREATE DATABASE badminton;
```

Then start the API:

```powershell
cd backend
go run ./cmd/api
```

### Frontend

In another terminal:

```powershell
Copy-Item .\frontend\.env.example .\frontend\.env
cd frontend
npm ci
npm run dev
```

Open `http://localhost:5173`.

## Quick start — Docker

Docker is optional for local development, but it is the easiest way to run the full PostgreSQL + Redis + API + frontend stack in an isolated environment.

### Windows / PowerShell

```powershell
.\scripts\run-public.ps1
```

Then open:

```text
http://localhost:8080
```

The launcher persists local demo secrets in Git-ignored `.env.demo.local`, waits for `/ready`, and prints local/LAN URLs.

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

## Production Compose

Create a secure production environment from `.env.production.example`, then run:

```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Production requirements:

- use a strong random `JWT_SECRET`;
- use a strong PostgreSQL password;
- set `ALLOW_SQLITE_FALLBACK=false`;
- set `DEMO_SEED_ENABLED=false`;
- set `REQUIRE_REDIS=true`;
- set `CORS_ALLOWED_ORIGINS` to the real HTTPS origin;
- terminate TLS at a trusted reverse proxy/load balancer/managed ingress.

## Project structure

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
│   │   ├── styles/              # Focused CSS
│   │   └── utils/               # Shared booking/date/format helpers
│   ├── nginx.conf               # SPA + reverse proxy
│   └── Dockerfile
├── docs/
├── scripts/
│   ├── setup-local.ps1          # One-time local PostgreSQL/env setup
│   ├── run-local.ps1            # Start backend + frontend locally
│   ├── run-public.ps1           # Docker/demo launcher
│   └── quality-check.ps1        # Local CI-equivalent checks
├── .github/workflows/ci.yml
├── docker-compose.yml
└── docker-compose.prod.yml
```

## Main features

### Customer
- View court schedule by date.
- Register/login as customer.
- Place a temporary booking hold.
- View personal booking status.
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
- Court setup, operating hours, current/future pricing, active/maintenance state.
- Staff/admin account management.
- Beverage catalog, stock adjustment, audit history.
- Revenue/booking dashboard.

## Reliability and security highlights

- PostgreSQL is the production source of truth.
- Redis distributed holds plus DB transaction checks and a unique partial index protect against double booking.
- Pending holds expire automatically.
- Payment/refund/deposit-adjustment records preserve accounting history.
- Booking totals snapshot the price at reservation time; admin price changes affect only available current/future slots, never historical or already-booked prices.
- JWT access and refresh tokens have explicit token types and HS256 validation.
- Role-based authorization for customer/staff/admin routes.
- Configurable CORS, auth rate limiting, request body limits, request IDs and security headers.
- HTTP timeouts, graceful shutdown, readiness checks and PostgreSQL connection pooling.
- `Asia/Ho_Chi_Minh` is the canonical business timezone.

## Quality checks

On Windows:

```powershell
.\scripts\quality-check.ps1
```

The script:

- checks Go formatting without mutating source files;
- runs `go test ./...`;
- runs `go vet ./...`;
- builds the Go API into a temporary location;
- performs a clean frontend dependency install;
- builds the production frontend;
- validates Docker Compose syntax when Docker is available.

Production dependency audit:

```powershell
cd frontend
npm audit --omit=dev
```

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

This repository is designed as a professional portfolio and small-business deployment baseline. Production readiness still requires environment-specific integration/E2E testing, realistic load tests, backup/restore drills, observability, permanent TLS/domain configuration, and an operational release/rollback process. See `docs/PROFESSIONAL_AUDIT.md` for the remaining checklist.
