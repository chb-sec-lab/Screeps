# SCOS Operational Runbook

[Hub](../index.html) | [Startpage (HTML)](index.html) | [Overview](index.md) | [Manifest](manifest.md) | [Principles](principles.md) | [Architecture](architecture.md) | [Observations](observations.md) | [Alerts](alerts.md)

## Purpose

Quick live checks and recovery commands for operation.

## Room Constants

- HOME: `E58S56`
- TARGET: `E57S56`
- EXPANSION: `E57S55`

## Expected Mission Quotas

- `builder@E57S56`: `2`
- `repairer@E57S56`: `2`
- `upgrader@E57S56`: `1`
- `claimer@E57S55`: `1` (reserve)
- `remoteMiner@E57S55`: `4`
- `hauler@E57S55`: `1`
- `scavenger`: `2`

## Heartbeat Interpretation

- `ASSIGN B@T:x/2 RP@T:y/2 U@T:z/1 C@E:a/1 RM@E:b/4 H@E:c/1`
- `Spawn:BUSY n/m`: spawn capacity currently occupied.
- `QUEUE ...`: current deficit chain by priority.

## Console Checks

- Role distribution:
- `_.countBy(Game.creeps, c => c.memory.role)`

- Repairers in target:
- `_.filter(Game.creeps, c => c.memory.role === 'repairer' && c.memory.workRoom === 'E57S56').length`

- Scavengers:
- `_.filter(Game.creeps, c => c.memory.role === 'scavenger').length`

- Expansion haulers:
- `_.filter(Game.creeps, c => c.memory.role === 'hauler' && c.memory.targetRoom === 'E57S55').length`

## Common Recovery Actions

- Wrong mission room assignment:
- update role memory (`workRoom`, `targetRoom`, `homeRoom`) and allow queue to stabilize.

- Spawn starvation in target room:
- prioritize extension fill and keep local hauler throughput high.
