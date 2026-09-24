# Commercial release checklist

Use this checklist before exposing the application to paying customers.

- [ ] Replace all demo secrets and disable `DEMO_SEED_ENABLED`.
- [ ] Configure a real HTTPS domain and TLS termination.
- [ ] Run `scripts/quality-check.ps1` and CI successfully.
- [ ] Run PostgreSQL/Redis backup and restore drill.
- [ ] Run authenticated booking-concurrency and load tests on target infrastructure.
- [ ] Configure uptime monitoring, central logs and alerting.
- [ ] Verify CORS only contains the real production origins.
- [ ] Verify database/Redis are not publicly exposed.
- [ ] Review privacy/retention requirements for customer data.
- [ ] Replace manual payment recording with a signed/idempotent payment gateway integration if online payments are enabled.
- [ ] Tag the release and document rollback steps.
