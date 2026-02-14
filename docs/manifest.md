# System Manifest

[Hub](hub.html) | [Overview](index.md) | [Principles](principles.md) | [Architecture](architecture.md) | [Observations](observations.md) | [Alerts](alerts.md) | [Runbook](recue-commands.md)

## Purpose

System-level policy for architecture boundaries, mission priorities, and operational standards.

## Topology

- Home room: `E58S56`
- Target room: `E57S56`
- Expansion room: `E57S55`

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
- Role modules remain generic and room-agnostic.

## Enforced Quotas

- `builder@E57S56`: `2`
- `repairer@E57S56`: `2`
- `upgrader@E57S56`: `1`
- `claimer@E57S55` (reserve): `1`
- `remoteMiner@E57S55`: `4`
- `hauler@E57S55`: `1`
- `scavenger` (global): `2`
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
- Defender demand remains active for a cooldown window after last detection to prevent spawn flapping.
- Ramparts are maintained by repairers with a hard minimum floor (`10k`) and optional soft reinforcement in home room.

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
