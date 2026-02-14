# SCOS Observations Log

[Hub](../index.html) | [Overview](index.md) | [Manifest](manifest.md) | [Architecture](architecture.md) | [Alerts](alerts.md)

## Purpose

Capture non-urgent observations that improve system design, role policy, and operations quality.

## Entry Template

- Date-Time (UTC): `YYYY-MM-DDTHH:MM:SSZ`
- Context: short situation statement
- Observation: factual finding
- Impact: why it matters
- Action: what was changed or planned
- Evidence: log line, metric, or replay note

## Entries

- Date-Time (UTC): `2026-02-14T10:20:00Z`
- Context: Multi-spawn rollout with `Spawn2` in `E57S56`
- Observation: `Spawn2` repeatedly returned `ERR_NOT_ENOUGH_ENERGY` for full-size bodies
- Impact: defense and logistics reaction time degraded during invader pressure
- Action: added per-spawn adaptive body fallback in orchestration
- Evidence: repeated `code=-6` lines in runtime logs

- Date-Time (UTC): `2026-02-14T10:35:00Z`
- Context: Expansion room logistics scaling
- Observation: dedicated salvage collection and infra upkeep were needed in target room
- Impact: dropped energy was lost and maintenance lagged without towers in `E57S56`
- Action: added `scavenger` role and `repairer` squad policy (`repairer@E57S56`)
- Evidence: assignment and queue indicators in heartbeat (`ASSIGN`, `QUEUE`)

- Date-Time (UTC): `2026-02-14T12:10:00Z`
- Context: Documentation and navigation reliability for GitHub Pages
- Observation: root site and docs pages were inconsistent for cross-navigation
- Impact: portfolio readability decreased and operator onboarding slowed down
- Action: added root hub `index.html` and standardized linked docs pages (`overview.html`, `manifest.html`, `principles.html`, `architecture.html`, `runbook.html`, `observations.html`, `alerts.html`)
- Evidence: all pages expose a shared navigation bar and reciprocal links

- Date-Time (UTC): `2026-02-14T13:40:00Z`
- Context: Scavenger runtime behavior under low salvage conditions
- Observation: scavengers could oscillate between rooms or stay loaded too long
- Impact: logistics efficiency dropped and movement thrashing became visible
- Action: stabilized scavenger with deterministic priority (`deliver > scavenge > haul-assist > distribute`) and salvage target locking
- Evidence: role state persisted in memory (`salvageRoom`, `salvageId`, `salvageType`) and unload-first behavior

- Date-Time (UTC): `2026-02-14T14:05:00Z`
- Context: Remote miner deposit routing
- Observation: miners did not consistently prefer nearest local sinks
- Impact: unnecessary travel and slower local room energy utilization
- Action: added adjacent-sink check and local-first deposit path before home overflow fallback
- Evidence: nearest sink selection now includes spawn/extension/container/storage/link in current room
