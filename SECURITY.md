# Security policy

Do not publish credentials, production `.env` files, database dumps, access tokens, or customer data in Issues or commits.

For a security vulnerability, use **GitHub → Security → Advisories → New draft security advisory** so the report can be discussed privately before disclosure.

Before a real production deployment:

- replace all example secrets with long random values;
- disable demo data (`DEMO_SEED_ENABLED=false`);
- terminate TLS with a trusted certificate;
- keep PostgreSQL and Redis on a private network;
- configure automated encrypted backups and restore drills;
- centralize application/proxy logs and alerts;
- run dependency and container image scans in CI/CD.
