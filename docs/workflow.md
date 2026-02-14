# SCOS Workflow

## Purpose

Define a predictable development and delivery process for game code, documentation, and operational logs.

## Environment

- IDE: VSCodium on Linux
- Repository: Git
- Runtime target: Screeps local script directory via `deploy.sh`

## Task Model

- `Deploy Screeps` (default build task): copies `.js` game files to the Screeps runtime directory.
- `Docs: Build`: generates `docs/*.html` from `docs/*.md` using `python3 scripts/build-docs.py`.
- `Deploy + Docs`: sequential task for both runtime deploy and docs generation.

## Daily Loop

1. Implement or adjust game logic in `.js` files.
2. Run `Ctrl+Shift+B` to deploy runtime code.
3. Observe runtime logs and behavior.
4. If documentation changed, run `Docs: Build`.
5. Commit source + generated artifacts together.

## Documentation Pipeline

- Source of truth: `docs/*.md`
- Generated site pages: `docs/*.html`
- Metadata source: `docs/version.json`
- Metadata requirements:
- `version` in SemVer format (`major.minor.patch`)
- `released_at_utc` in ISO 8601 UTC (`YYYY-MM-DDTHH:MM:SSZ`)
- `Date-Time (UTC)` fields in logs must use ISO 8601 UTC format.

## Logging Policy

- Non-urgent findings go to `docs/observations.md`.
- Incidents go to `docs/alerts.md`.
- Entries must include factual context, impact, action, and evidence.
- Runtime telemetry layers:
- Heartbeat every `20` ticks
- Tactical audit every `200` ticks
- Strategic audit every `3600` ticks

## Quality Gates

- Do not commit broken docs generation.
- Do not commit invalid timestamp formats.
- Keep role policies and quotas aligned between `manifest.md` and runtime behavior.
- Keep `Memory.audit` retention bounded to avoid memory bloat.
- Prefer deterministic anti-oscillation guards for logistics roles (scavenger/hauler/remoteMiner).
