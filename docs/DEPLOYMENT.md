# Deployment guide

## Local development without Docker

For Windows contributors/reviewers, use the repository helper scripts.

### Requirements

- Go
- Node.js + npm
- PostgreSQL
- PowerShell
- Redis optional for local development

### One-time setup

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File ".\scripts\setup-local.ps1"
```

The script creates Git-ignored `backend/.env` and `frontend/.env`, prompts securely for the local PostgreSQL password, configures the application for PostgreSQL, creates the `badminton` database when `psql` is available, and enables demo seed data.

### Start both services

```powershell
powershell -ExecutionPolicy Bypass -File ".\scripts\run-local.ps1"
```

Endpoints:

- Frontend: `http://localhost:5173`
- API: `http://localhost:8080`
- Health: `http://localhost:8080/health`
- Readiness: `http://localhost:8080/ready`

Local demo accounts:

- Admin: `admin@badminton.demo / Admin@12345`
- Staff: `staff@badminton.demo / Staff@12345`
- Customer: `customer@badminton.demo / Customer@12345`

Never commit local `.env` files.

## Local / portfolio Docker demo

Requirements: Docker Desktop or Docker Engine with Compose v2.

```powershell
.\scripts\run-public.ps1
```

The command builds the React frontend, Go API, PostgreSQL, and Redis, then exposes one URL through Nginx. Default: `http://localhost:8080`. The script creates Git-ignored `.env.demo.local` once, reuses generated local secrets on later runs, waits for `/ready`, and prints a LAN URL when it can resolve a local IPv4 address.

For a temporary public HTTPS URL (useful for a recruiter demo), install `cloudflared` separately and run:

```powershell
.\scripts\run-public.ps1 -Tunnel
```

The terminal prints the temporary Cloudflare URL. This is not a substitute for a permanent domain/TLS setup.

## Production

1. Copy `.env.production.example` to a secure deployment environment; do **not** commit the resulting secret file.
2. Replace `JWT_SECRET` and `POSTGRES_PASSWORD` with random secrets.
3. Set `CORS_ALLOWED_ORIGINS` to the real HTTPS origin.
4. Keep `DEMO_SEED_ENABLED=false`, `ALLOW_SQLITE_FALLBACK=false`, and `REQUIRE_REDIS=true`.
5. Put the public Nginx endpoint behind TLS (reverse proxy/load balancer or a managed ingress).
6. Run at least one backup and restore test before go-live.

Example Compose command:

```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

The default production tuning supports moderate small-business concurrency: PostgreSQL pooling, Redis booking locks, Nginx static caching, request/server timeouts, and a database uniqueness constraint for booking safety. Capacity must still be validated with realistic load tests on the target server.

## Horizontal scaling

The API is mostly stateless because authentication uses JWT and booking holds use Redis. Multiple API replicas can therefore share PostgreSQL and Redis. Before scaling beyond one API instance, move the in-process authentication rate limiter to Redis or an API gateway so limits remain global.

## Backups

Use scheduled `pg_dump` backups stored outside the application host, encrypted at rest, with retention appropriate to the business. A backup is not considered valid until restoration has been tested.

## Health checks

- `/health`: API process is alive.
- `/ready`: database is reachable and Redis is reachable when `REQUIRE_REDIS=true`.

Use `/ready` for load-balancer/container readiness decisions.
