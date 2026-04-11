# SCOS Operational Runbook

[Hub](hub.html) | [Startpage (HTML)](index.html) | [Overview](index.md) | [Manifest](manifest.md) | [Principles](principles.md) | [Architecture](architecture.md) | [Observations](observations.md) | [Alerts](alerts.md)

## Purpose

Quick live checks and recovery commands for operation.

## Room Constants

- HOME: `W7N8`
- TARGET: `W7N7`
- EXPANSION: `W6N8`
- MINING: `W8N8`

## Expected Mission Quotas

- `builder@E58S56` (home): `1`
- `repairer@E58S56` (home): `1`
- `builder@E57S56`: `1`
- `repairer@E57S56`: `2`
- `upgrader@E57S56`: `1`
- `hauler@E57S56`: `1` (local logistics)
- `upgrader` global fallback: `4`
- `builder@E58S55`: `2` (bootstrap)
- `claimer@E58S55`: `1` (claim)
- `remoteMiner@E57S55`: `0`
- `remoteMiner@E58S55`: `2`
- `hauler@E57S55`: `0`
- `scavenger`: `2`

## Scavenger Priority

- `1` deliver if loaded
- `2` scavenge (drops, ruins, tombs)
- `3` haul-assist from room buffers
- `4` distribute/rebalance local energy sinks

## Heartbeat Interpretation

The Heartbeat is now a multi-line HUD:
- `GLOBAL | Pop: 24/60 | CPU: 12.5 (Bucket: 10k) | ♻️ 2 recycling`
- `QUEUE | builder@W7N7:0/2 ➔ hauler@W7N7:0/1` shows spawn queue sequence.
- `[ROOM_NAME] (RCL X) | NRG: x/y | Spawns: IDLE | TTL: min X, avg Y`
- `└─ ROLE:HAVE/NEED`: Color coded (Green = OK, Yellow = Deficit, Red = Surplus).
- `🚨 DEFENSE| ALERT in [ROOM]`: Overrides default lines when hostiles are detected.

## Audit Signals

- Tactical audit (every 200 ticks):
- `AUDIT-T <tick> | ENERGY <sum> | HOSTILES <sum> | SPAWN <busy>/<total>`
- Strategic audit (every 3600 ticks):
- `--- STRATEGIC AUDIT <tick> ---` plus per-room health lines.

## Console Checks

- Role distribution:
- `_.countBy(Game.creeps, c => c.memory.role)`

- Repairers in target:
- `_.filter(Game.creeps, c => c.memory.role === 'repairer' && c.memory.workRoom === 'E57S56').length`

- Scavengers:
- `_.filter(Game.creeps, c => c.memory.role === 'scavenger').length`

- Expansion haulers:
- `_.filter(Game.creeps, c => c.memory.role === 'hauler' && c.memory.targetRoom === 'E57S55').length`

- Current hostiles in mission rooms:
- `_.map(['E58S56','E57S56','E57S55'], r => [r, Game.rooms[r] ? Game.rooms[r].find(FIND_HOSTILE_CREEPS).length : 'no vision'])`

- Latest tactical audit snapshot:
- `Memory.audit && Memory.audit.tactical ? Memory.audit.tactical[Memory.audit.tactical.length - 1] : null`

- Latest strategic audit snapshot:
- `Memory.audit && Memory.audit.strategic ? Memory.audit.strategic[Memory.audit.strategic.length - 1] : null`

## Common Recovery Actions

- Wrong mission room assignment:
- update role memory (`workRoom`, `targetRoom`, `homeRoom`) and allow queue to stabilize.

- Spawn starvation in target room:
- prioritize extension fill and keep local hauler throughput high.

- Decommissioning obsolete/stuck creeps:
- Single creep: `Game.creeps['name'].memory.recycle = true`
- Mass recycle by role (e.g. idle scavengers):
  `Object.values(Game.creeps).filter(c => c.memory.role === 'scavenger').forEach(c => c.memory.recycle = true);`
