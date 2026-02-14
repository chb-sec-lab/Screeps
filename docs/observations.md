# SCOS Observations Log

[Hub](../index.html) | [Overview](index.md) | [Manifest](manifest.md) | [Architecture](architecture.md) | [Alerts](alerts.md)

## Purpose

Capture non-urgent observations that improve system design, role policy, and operations quality.

## Entry Template

- Date (UTC): `YYYY-MM-DD`
- Context: short situation statement
- Observation: factual finding
- Impact: why it matters
- Action: what was changed or planned
- Evidence: log line, metric, or replay note

## Entries

- Date (UTC): `2026-02-14`
- Context: Multi-spawn rollout with `Spawn2` in `E57S56`
- Observation: `Spawn2` repeatedly returned `ERR_NOT_ENOUGH_ENERGY` for full-size bodies
- Impact: Defense and logistics reaction time degraded during invader pressure
- Action: Added per-spawn adaptive body fallback in orchestration
- Evidence: repeated `code=-6` lines in runtime logs

- Date (UTC): `2026-02-14`
- Context: Expansion room logistics scaling
- Observation: Need for dedicated salvage collection and infra upkeep in target room
- Impact: Lost dropped energy and delayed maintenance without towers in `E57S56`
- Action: Added `scavenger` role and `repairer` squad policy (`repairer@E57S56`)
- Evidence: assignment and queue indicators in heartbeat (`ASSIGN`, `QUEUE`)
