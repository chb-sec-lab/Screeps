# System Manifest

[Hub](hub.html) | [Overview](index.md) | [Principles](principles.md) | [Architecture](architecture.md) | [Observations](observations.md) | [Alerts](alerts.md) | [Runbook](recue-commands.md)

## Purpose

System-level policy for architecture boundaries, mission priorities, and operational standards.

## Topology

- Home room: `W7N8`
- Target room: `W7N7` (2 Sources)
- Expansion room: `W6N8` (1 Source)
- Mining room: `W8N8` (1 Source)

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

- `builder@E58S56` (home): `1`
- `repairer@E58S56` (home): `1`
- `builder@E57S56`: `1`
- `repairer@E57S56`: `2`
- `upgrader@E57S56`: `1`
- `hauler@E57S56`: `1`
- `remoteMiner@E57S56` (local extraction): `4`
- `builder@E58S55` (bootstrap): `2`
- `upgrader@E58S55`: `1`
- `hauler@E58S55`: `1`
- `claimer@E58S55` (claim): `1`
- `remoteMiner@E57S55`: `0`
- `remoteMiner@E58S55`: `2` (Room only has 1 source)
- `hauler@E57S55`: `0`
- `scavenger` (global): `2`
- `upgrader` (global fallback): `4`
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
- Ramparts are maintained by repairers with a hard minimum floor (`50k`) and optional soft reinforcement in home room.
- Remote haulers use minimum pickup thresholds to avoid low-value room-to-room oscillation.
- Scavengers avoid withdraw/distribute loops unless the room has urgent sinks (spawn/extension/tower demand).
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
