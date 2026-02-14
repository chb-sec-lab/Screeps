# SCOS Observations Log

[Hub](hub.html) | [Overview](index.md) | [Manifest](manifest.md) | [Architecture](architecture.md) | [Alerts](alerts.md)

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

- Date-Time (UTC): `2026-02-14T19:18:28Z`
- Context: Night-operation readiness and data-driven policy review
- Observation: colony remained energy-full and stable while no active hostiles were present, indicating baseline defender cost could be reduced
- Impact: permanent defense would waste energy and spawn bandwidth under clear-room conditions
- Action: switched to threat-triggered defender spawning across home/target/expansion, added cooldown window, introduced tactical/strategic audits, and added rampart floor maintenance
- Evidence: repeated heartbeats showed `NRG 1800/1800`, `DEF clear threat(H/T/E):0/0/0`, and `QUEUE clear` during observed interval

- Date-Time (UTC): `2026-02-14T23:07:37Z`
- Context: Post-combat runtime stabilization and controller progression optimization
- Observation: remote miners oscillated after intruder cleanup and upgraders spent excessive time harvesting from natural sources
- Impact: reduced mining throughput, avoidable movement cost, and slower controller upgrade velocity
- Action: stabilized remote miner danger logic (no stale no-vision panic parking), increased target-room upgrader quota to `2`, raised global upgrader fallback to `4`, and prioritized upgrader energy withdrawal from storage/container/link before harvest fallback
- Evidence: prior logs showed repeated movement thrashing, while new policy aligns `ASSIGN U@T` target and reduces long pathing to sources

- Date-Time (UTC): `2026-02-14T23:29:47Z`
- Context: Final night-hardening pass for role stability and room coverage
- Observation: home room could lose builder/repairer coverage, scavengers could self-loop container energy, and one remote hauler could shuttle low-value loads between rooms
- Impact: maintenance risk in home room and wasted pathing/CPU in logistics roles
- Action: enforced `builder@HOME:1` and `repairer@HOME:1` with pinned `workRoom`, added scavenger urgent-sink gating, added remote-hauler minimum pickup thresholds, and migrated stale hauler memory (`homeRoom`) to home constant
- Evidence: spawn assignment now reports `B@H` and `RP@H` targets, and role loops use explicit anti-oscillation checks
