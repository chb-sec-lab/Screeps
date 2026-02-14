# SCOS Architecture

[Hub](../index.html) | [Overview](index.md) | [Manifest](manifest.md) | [Principles](principles.md) | [Runbook](recue-commands.md) | [Observations](observations.md) | [Alerts](alerts.md)

## Scope

SCOS is a multi-room Screeps operating system focused on reliable expansion, explicit role assignment, and operator-grade observability.

## Structural Layers

- Strategic config: `config.rooms.js`, `config.roles.js`
- Orchestration kernel: `main.js`
- Role execution layer: `role.*.js`
- Runtime diagnostics: `utils.logger.js`
- Documentation and operating memory: `docs/`

## Operational Topology

- Home room: `E58S56`
- Target room: `E57S56`
- Expansion room: `E57S55`

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
