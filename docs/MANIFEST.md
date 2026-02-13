# System Manifest

[Startseite (HTML)](index.html) | [Overview](index.md) | [Principles](PRINCIPLES.md) | [Runbook](Recue%20Commands)

## Purpose

Source of truth fuer Architektur, Betriebsregeln und Missionsprioritaeten.

## Project Context

- RCL: `5`
- GCL: `1`
- Home: `E58S56`
- Target: `E57S56`
- Expansion: `E57S55`

## Code Ownership

- `main.js`: Kernel-Orchestrierung, Census, Spawn-Policy, Heartbeat-Payload
- `role.*.js`: Rollenverhalten
- `config.rooms.js`: Raumtopologie (`HOME`, `TARGET`, `EXPANSION`)
- `config.roles.js`: Bodies und globale Fallback-Counts
- `utils.logger.js`: Console-Rendering fuer Diagnostik

## Mission Policy

- `E57S56` wird entwickelt (Builder + Upgrader Quoten).
- `E57S55` wird reserviert und wirtschaftlich ausgebeutet.
- Claimer fuer Expansion laeuft in `reserve`-Mode.
- Remote Hauler in Expansion sammelt Drops/Ruinen/Tombstones und liefert nach Home.

## Operational Rules

- Economy-Safety zuerst: `harvester` und `hauler` haben hohe Prioritaet.
- Rollen werden beim Spawn per Memory missioniert:
- `builder`: `memory.workRoom`
- `upgrader`: `memory.targetRoom`
- `claimer`: `memory.targetRoom`, `memory.claimMode`
- `remoteMiner`: `memory.targetRoom`, `memory.homeRoom`
- `hauler` (remote mission): `memory.targetRoom`, `memory.homeRoom`
- Rollenmodule bleiben generisch, keine harte Single-Room-Kodierung.

## Enforced Quotas

- `builder@E57S56`: `2`
- `upgrader@E57S56`: `1`
- `claimer@E57S55` (reserve): `1`
- `remoteMiner@E57S55`: `4`
- `hauler@E57S55`: `1`

## Observability Contract

- Intervall: Heartbeat alle `20` Ticks
- Pflichtfelder:
- `NRG`
- `POP`
- `ROOMS`
- `ASSIGN`
- `Spawn`
- `QUEUE`
