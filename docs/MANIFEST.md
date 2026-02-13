SYSTEM MANIFEST

Source of Truth for AI Collaboration

Project Context

- RCL: 5
- GCL: 1
- Home: `E58S56`
- Target: `E57S56`
- Expansion: `E57S55`

Mission Policy

- `E57S56` is development target with assigned builders and upgrader.
- `E57S55` is reserve-and-mine expansion (no claim ownership at GCL 1).
- Expansion claimer runs in `reserve` mode.

Code Ownership

- `main.js`: orchestration, census, spawn policy, heartbeat payload
- `role.*.js`: role-level execution
- `config.rooms.js`: room topology (`HOME`, `TARGET`, `EXPANSION`)
- `config.roles.js`: global role bodies and fallback totals
- `utils.logger.js`: formatted console diagnostics

Operational Rules

- Economy safety first: harvesters/haulers are protected at top spawn priority.
- Room missions are memory-assigned at spawn:
- Builders: `memory.workRoom`
- Upgraders: `memory.targetRoom`
- Claimers: `memory.targetRoom` + `memory.claimMode`
- Remote miners: `memory.targetRoom` + `memory.homeRoom`
- Keep role modules generic; do not hardcode single-room targets in role logic.

Current Quotas (enforced by spawn policy)

- Target room `E57S56`: builders `2`, upgraders `1`
- Expansion room `E57S55`: claimers `1` (reserve), remote miners `4`

Observability Standards

- Heartbeat interval: every 20 ticks
- Required sections:
- `NRG` energy/capacity
- `POP` role census
- `ROOMS` home/target/expansion IDs
- `ASSIGN` room-mission quotas and current counts
- `Spawn` state (`IDLE`/`BUSY`) and remaining time
- `QUEUE` deficit preview
