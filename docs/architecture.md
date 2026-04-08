# SCOS Architecture

[Hub](hub.html) | [Overview](index.md) | [Manifest](manifest.md) | [Principles](principles.md) | [Runbook](recue-commands.md) | [Observations](observations.md) | [Alerts](alerts.md)

## Scope

SCOS is a multi-room Screeps operating system focused on reliable expansion, explicit role assignment, and operator-grade observability.

## Structural Layers

- Strategic config: `config.rooms.js`, `config.roles.js`
- Orchestration kernel: `main.js`
- Role execution layer: `role.*.js`
- Runtime diagnostics: `utils.logger.js`
- Documentation and operating memory: `docs/`

## Operational Topology

The system has migrated to a dynamic **Colony Registry** defined in `config.rooms.js`.
Instead of rigid `HOME` and `TARGET` constants, rooms are classified by type:
- `CORE`: Fully autonomous colonies with a Spawn and Controller. They calculate their own quotas dynamically based on their Room Control Level (RCL) via the Evolution Protocol.
- `REMOTE`: Outpost rooms dedicated to mining or claim/reserve operations, assigned to a specific `base` CORE room.

## Control Model

- Memory-driven assignment:
- `workRoom` for build/repair tasks
- `targetRoom` for mission routing
- `homeRoom` for logistics return paths
- Priority ladder in `main.js` enforces critical economy and mission quotas.

## Logging and Learning Loop

- Heartbeat logs provide state snapshots every 20 ticks.
- `docs/observations.md` captures non-urgent lessons and validated insights.
- `docs/alerts.md` captures urgent incidents with response and resolution.
- Documentation changes are treated as part of the delivery, not afterthought.

## Documentation Contract

- Every structural change must update:
- mission policy in `manifest.md`
- rationale in `principles.md` (if design changed)
- at least one entry in `observations.md` or `alerts.md`
