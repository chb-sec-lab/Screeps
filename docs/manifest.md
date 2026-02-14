# System Manifest

[Hub](../index.html) | [Startpage (HTML)](index.html) | [Overview](index.md) | [Principles](principles.md) | [Architecture](architecture.md) | [Observations](observations.md) | [Alerts](alerts.md) | [Runbook](recue-commands.md)

## Purpose

Source of truth for architecture, operating rules, and mission priorities.

## Project Context

- RCL: `5`
- GCL: `1`
- Home: `E58S56`
- Target: `E57S56`
- Expansion: `E57S55`

## Code Ownership

- `main.js`: kernel orchestration, census, spawn policy, heartbeat payload
- `role.*.js`: role behavior
- `config.rooms.js`: room topology (`HOME`, `TARGET`, `EXPANSION`)
- `config.roles.js`: bodies and global fallback counts
- `utils.logger.js`: console rendering for diagnostics

## Mission Policy

- `E57S56` is the development target with assigned builders, repairers, and upgrader.
- `E57S55` is reserve-and-mine expansion (no ownership claim at GCL 1).
- Expansion claimer runs in `reserve` mode.

## Operational Rules

- Economy safety first: `harvester` and `hauler` stay high priority.
- Roles are assigned at spawn via memory:
- `builder`: `memory.workRoom`
- `repairer`: `memory.workRoom`
- `upgrader`: `memory.targetRoom`
- `claimer`: `memory.targetRoom`, `memory.claimMode`
- `remoteMiner`: `memory.targetRoom`, `memory.homeRoom`
- `hauler` (remote mission): `memory.targetRoom`, `memory.homeRoom`
- Role modules stay generic; avoid hardcoded single-room behavior.

## Enforced Quotas

- `builder@E57S56`: `2`
- `repairer@E57S56`: `2`
- `upgrader@E57S56`: `1`
- `claimer@E57S55` (reserve): `1`
- `remoteMiner@E57S55`: `4`
- `hauler@E57S55`: `1`
- `scavenger` (global): `2`

## Observability Contract

- Heartbeat interval: every `20` ticks
- Required fields:
- `NRG`
- `POP`
- `ROOMS`
- `ASSIGN`
- `DEF`
- `Spawn`
- `QUEUE`

## Brief Log Mechanism (Enterprise)

- Every meaningful change gets one short entry in `observations.md` or `alerts.md`.
- `observations.md`: design lessons, behavior findings, non-urgent improvements.
- `alerts.md`: incidents, mitigations, and verified resolutions.
- Entry style stays compact: context, impact, action, evidence.
