# System Manifest

[Hub](hub.html) | [Overview](index.md) | [Principles](principles.md) | [Architecture](architecture.md) | [Observations](observations.md) | [Alerts](alerts.md) | [Runbook](recue-commands.md)

## Purpose

System-level policy for architecture boundaries, mission priorities, and operational standards.

## Topology

Driven by the `registry` in `config.rooms.js`:
- CORE: `W7N8` (Primary Base)
- CORE: `W7N7` (Future Secondary Base, 2 Sources)
- REMOTE: `W6N8` (Expansion Mine, tied to W7N8)
- REMOTE: `W8N8` (Sector Mine, tied to W7N8)

## Operational Priorities

1. Economy continuity first (`harvester`, `hauler`).
2. Mission quota compliance by room assignment.
3. Threat-triggered defense before non-critical growth work.
4. Deterministic, observable behavior over ad-hoc optimization.

## Assignment Contract

- `builder` and `repairer`: `memory.workRoom`
- `upgrader`: `memory.targetRoom`
- `claimer`: `memory.targetRoom`, `memory.claimMode`
- `remoteMiner`: `memory.targetRoom`, `memory.homeRoom`
- `hauler` (remote mission): `memory.targetRoom`, `memory.homeRoom`
- `mineralMiner`: `memory.workRoom` (auto-assigned to rooms with active Extractors)
- Role modules remain generic and room-agnostic.

## Enforced Quotas

The system utilizes the **Evolution Protocol** (dynamic RCL-based evaluation per room) instead of rigid global constants:
- **Phase 1 (RCL 1-2 "Bootstrap"):** 3 Builders, 2 Upgraders, 0 Haulers/Scavs. Maximizes raw capacity scaling.
- **Phase 2 (RCL 3 "Basic Infra"):** 2 Builders, 2 Upgraders, 1 Repairer, 1 Hauler, 1 Scav. Introduces container logistics and tower upkeep.
- **Phase 3 (RCL 4+ "Empire"):** 1 Builder, 2 Upgraders, 1 Repairer, 2 Haulers, 2 Scavs. Fully enables multi-room remote assignments.

Remote Mining:
- Handled via explicit mapping in `main.js` (Target: 2 RMs per source).
- `mineralMiner`: Dynamic (1 per active Extractor in RCL 6+ rooms).
- `defender`: `0` baseline, escalates on live threat with cooldown.

## Observability Contract

- Heartbeat interval: every `20` ticks.
- Tactical audit interval: every `200` ticks (`Memory.audit.tactical`).
- Strategic audit interval: every `3600` ticks (`Memory.audit.strategic`).
- Required fields:
- `NRG`
- `POP`
- `ROOMS`
- `ASSIGN`
- `DEF`
- `Spawn`
- `QUEUE`

## Defense and Maintenance Policy

- Defense is spawned on demand when hostiles are detected in `HOME`, `TARGET`, or `EXPANSION`.
- Diplomacy: Known peaceful players can be whitelisted globally (`ALLIES` array) to allow safe passage through bunker-style ramparts. Currently empty for the new sector.
- Emergency Recovery: Builders unconditionally prioritize Construction Sites for `STRUCTURE_SPAWN` above all repairs (even emergency container/rampart hits) to guarantee cold-boot recovery from wipes.
- Defender demand remains active for a cooldown window after last detection to prevent spawn flapping.
- SCOS implements "Smart-Bunker" Point-Defense: Ramparts are only built directly over critical structures (Spawns, Towers, Storage, Terminals) rather than full perimeter walls. Towers prioritize the weakest rampart up to `50k` hits.
- Remote haulers use minimum pickup thresholds to avoid low-value room-to-room oscillation.
- Scavengers avoid withdraw/distribute loops unless the room has urgent sinks (spawn/extension/tower demand).
- Link networks automate energy transit from Sources directly to Controllers (priority) or Storage (fallback), bypassing haulers where possible.
- Obsolete or stuck creeps can be decommissioned by setting `memory.recycle = true`, routing them to the nearest spawn for energy reclamation.

## Documentation Governance

- Source docs: `docs/*.md`
- Published docs: `docs/*.html`
- Build command: `python3 scripts/build-docs.py`
- Version metadata: `docs/version.json`
- `version` must follow SemVer (`major.minor.patch`).
- `released_at_utc` must follow ISO 8601 UTC (`YYYY-MM-DDTHH:MM:SSZ`).

## Decision Logging

- `observations.md`: non-urgent learnings and improvements.
- `alerts.md`: incidents, mitigation, and verified resolution.
- Every meaningful production change requires at least one log entry.
