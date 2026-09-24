# Contributing

1. Create a focused branch from `main`.
2. Keep handlers thin; business rules belong in `internal/service`, persistence in `internal/repository`.
3. Keep React pages focused on state/orchestration; reusable UI belongs under `components` or `features`, shared transformations under `utils`.
4. Do not commit `.env`, database files, logs, build output, `node_modules`, or generated archives.
5. Run `scripts/quality-check.ps1` before opening a pull request.
6. Use descriptive commits, for example `fix(booking): prevent expired holds from blocking slots`.
7. Update README/docs whenever an endpoint, environment variable, demo account, or deployment flow changes.
