# SCOS Observations Log

[Hub](hub.html) | [Overview](index.md) | [Manifest](manifest.md) | [Architecture](architecture.md) | [Alerts](alerts.md)

## Purpose

Capture non-urgent observations that improve system design, role policy, and operations quality.

## Entry Template

- Date-Time (UTC): `YYYY-MM-DDTHH:MM:SSZ`
- Context: short situation statement
- Observation: factual finding
- Impact: why it matters
- Action: what was changed or planned
- Evidence: log line, metric, or replay note

## Entries

- Date-Time (UTC): `2026-02-14T10:20:00Z`
- Context: Multi-spawn rollout with `Spawn2` in `E57S56`
- Observation: `Spawn2` repeatedly returned `ERR_NOT_ENOUGH_ENERGY` for full-size bodies
- Impact: defense and logistics reaction time degraded during invader pressure
- Action: added per-spawn adaptive body fallback in orchestration
- Evidence: repeated `code=-6` lines in runtime logs

- Date-Time (UTC): `2026-02-14T10:35:00Z`
- Context: Expansion room logistics scaling
- Observation: dedicated salvage collection and infra upkeep were needed in target room
- Impact: dropped energy was lost and maintenance lagged without towers in `E57S56`
- Action: added `scavenger` role and `repairer` squad policy (`repairer@E57S56`)
- Evidence: assignment and queue indicators in heartbeat (`ASSIGN`, `QUEUE`)

- Date-Time (UTC): `2026-02-14T12:10:00Z`
- Context: Documentation and navigation reliability for GitHub Pages
- Observation: root site and docs pages were inconsistent for cross-navigation
- Impact: portfolio readability decreased and operator onboarding slowed down
- Action: added root hub `index.html` and standardized linked docs pages (`overview.html`, `manifest.html`, `principles.html`, `architecture.html`, `runbook.html`, `observations.html`, `alerts.html`)
- Evidence: all pages expose a shared navigation bar and reciprocal links

- Date-Time (UTC): `2026-02-14T13:40:00Z`
- Context: Scavenger runtime behavior under low salvage conditions
- Observation: scavengers could oscillate between rooms or stay loaded too long
- Impact: logistics efficiency dropped and movement thrashing became visible
- Action: stabilized scavenger with deterministic priority (`deliver > scavenge > haul-assist > distribute`) and salvage target locking
- Evidence: role state persisted in memory (`salvageRoom`, `salvageId`, `salvageType`) and unload-first behavior

- Date-Time (UTC): `2026-02-14T14:05:00Z`
- Context: Remote miner deposit routing
- Observation: miners did not consistently prefer nearest local sinks
- Impact: unnecessary travel and slower local room energy utilization
- Action: added adjacent-sink check and local-first deposit path before home overflow fallback
- Evidence: nearest sink selection now includes spawn/extension/container/storage/link in current room

- Date-Time (UTC): `2026-02-14T19:18:28Z`
- Context: Night-operation readiness and data-driven policy review
- Observation: colony remained energy-full and stable while no active hostiles were present, indicating baseline defender cost could be reduced
- Impact: permanent defense would waste energy and spawn bandwidth under clear-room conditions
- Action: switched to threat-triggered defender spawning across home/target/expansion, added cooldown window, introduced tactical/strategic audits, and added rampart floor maintenance
- Evidence: repeated heartbeats showed `NRG 1800/1800`, `DEF clear threat(H/T/E):0/0/0`, and `QUEUE clear` during observed interval

- Date-Time (UTC): `2026-02-14T23:07:37Z`
- Context: Post-combat runtime stabilization and controller progression optimization
- Observation: remote miners oscillated after intruder cleanup and upgraders spent excessive time harvesting from natural sources
- Impact: reduced mining throughput, avoidable movement cost, and slower controller upgrade velocity
- Action: stabilized remote miner danger logic (no stale no-vision panic parking), increased target-room upgrader quota to `2`, raised global upgrader fallback to `4`, and prioritized upgrader energy withdrawal from storage/container/link before harvest fallback
- Evidence: prior logs showed repeated movement thrashing, while new policy aligns `ASSIGN U@T` target and reduces long pathing to sources

- Date-Time (UTC): `2026-02-14T23:29:47Z`
- Context: Final night-hardening pass for role stability and room coverage
- Observation: home room could lose builder/repairer coverage, scavengers could self-loop container energy, and one remote hauler could shuttle low-value loads between rooms
- Impact: maintenance risk in home room and wasted pathing/CPU in logistics roles
- Action: enforced `builder@HOME:1` and `repairer@HOME:1` with pinned `workRoom`, added scavenger urgent-sink gating, added remote-hauler minimum pickup thresholds, and migrated stale hauler memory (`homeRoom`) to home constant
- Evidence: spawn assignment now reports `B@H` and `RP@H` targets, and role loops use explicit anti-oscillation checks

- Date-Time (UTC): `2026-02-15T09:20:00Z`
- Context: CPU optimization at the 20-core limit
- Observation: High frequency of `findClosestByPath` in builder roles and multi-pass loops in `main.js` were the primary CPU consumers
- Impact: Script execution frequently throttled, delaying reaction to threats
- Action: Replaced pathing searches with range searches for non-essential tasks and merged census/execution passes into a single loop
- Evidence: CPU usage decreased by approximately 30%, restoring headroom for further expansion

- Date-Time (UTC): `2026-02-15T10:30:00Z`
- Context: Colony milestone and multi-room stability
- Observation: Colony reached GCL 3 with Home room hitting RCL 7 and Target hitting RCL 6. New mining room E58S55 integrated successfully.
- Impact: Access to advanced structures (Level 2 Spawns, Links, specialized labs) and significantly increased energy throughput.
- Action: Updated global versioning and roadmap to reflect shift into advanced infrastructure phase.
- Evidence: Controller levels confirmed in Game UI; heartbeat reports stable energy surplus in E58S56.

- Date-Time (UTC): `2026-02-15T12:00:00Z`
- Context: E57S56 maintenance instability and missing MINING miners
- Observation: Tower in E57S56 was idle because main.js hardcoded tower logic only for the HOME room. Also, remote miners for E58S55 were listed in the manifest but omitted from the main.js spawn queue.
- Impact: Target room infrastructure degraded without tower support. E58S55 energy sources remained unharvested.
- Action: Integrated structure.tower.js globally into main.js for all tracked rooms. Added missing miningRemoteMiners quota to main.js and updated utils.logger.js.
- Evidence: Target room towers now actively repair; RM@M appears in HEARTBEAT assignments.

- Date-Time (UTC): `2026-02-15T12:30:00Z`
- Context: Logistics inefficiency in target room `E57S56`
- Observation: Containers in `E57S56` were being filled but never emptied, while worker creeps (builders, upgraders) were inefficiently harvesting from sources. The room lacked a dedicated local logistics role.
- Impact: Degraded energy throughput and worker efficiency in the target room. Stored energy was wasted.
- Action: Generalized the `hauler` role to operate in any `workRoom`. Spawned a dedicated local hauler for `E57S56` to manage internal logistics, moving energy from containers to spawns, extensions, and towers.
- Evidence: New `H@T:1/1` assignment in heartbeat logs. Containers in `E57S56` are now actively used as buffers.

- Date-Time (UTC): `2026-02-15T14:00:00Z`
- Context: Major infrastructure rollout in `E58S56` and `E57S56` (second tower, storage, roads, extra extensions) and Harvester inefficiency.
- Observation: Harvesters in `E57S56` were clustering on the left source and ignoring the right source. `role.harvester.js` was missing memory-based target locking, defaulting to the closest active source.
- Impact: Significant loss of potential energy throughput in the target room despite the new advanced infrastructure.
- Action: Updated `main.js` source assignments to be multi-room aware, and fixed `role.harvester.js` to strictly respect `creep.memory.targetSourceId`.
- Evidence: Harvesters are now distributed evenly across both energy sources in `E57S56`.

- Date-Time (UTC): `2026-02-15T15:30:00Z`
- Context: Idling remote miners and haulers in `E57S55` during Invader Core presence.
- Observation: An Invader Core reserves the room controller, physically preventing creeps from harvesting sources (`ERR_NOT_OWNER`). The creeps were not just idle; their actions were blocked by game rules.
- Impact: Massive energy/CPU waste as creeps stood paralyzed.
- Action: Shifted strategy from reserving to actively claiming the 3rd room (`E58S55`) utilizing GCL 3. Spawning 2 pioneer builders (`B@M`) to bootstrap the new room while ignoring the blocked room.
- Evidence: Creeps in `E57S55` threw invisible harvest errors; claimer successfully switched to `claimController`.

- Date-Time (UTC): `2026-02-15T15:45:00Z`
- Context: Retrospective on `E57S55` Invader Core attrition.
- Observation: Invader Cores repeatedly spawned (10+ destroyed cores counted) because the room was only reserved. Game mechanics prevent regular Invader Cores from spawning in fully claimed rooms.
- Impact: Prolonged resource drain and blocked remote mining (`ERR_NOT_OWNER`). A premature shift to `claim` (utilizing GCL 3) would have prevented the spawns entirely.
- Action: Strategic rule established: If a vital expansion room is under heavy Invader Core attrition and GCL is available, prioritize `claim` over `reserve` to permanently suppress Invader spawns.
- Evidence: Visual confirmation of 10+ core ruins in `E57S55`.

- Date-Time (UTC): `2026-02-15T16:00:00Z`
- Context: Remaining miner/hauler pair paralyzed in `E57S55`.
- Observation: Maintaining a quota of 1 for the reserved room caused creeps to spawn, travel, and silently fail at `harvest()` due to `ERR_NOT_OWNER`.
- Impact: Deadlocked creeps wasting CPU and spawn energy.
- Action: Set `E57S55` quotas (`EXPANSION_MINER_QUOTA` and `EXPANSION_HAULER_QUOTA`) to 0 in `main.js`. Added explicit `ERR_NOT_OWNER` check in `role.remoteMiner.js` to flee room and emit '⛔ Core!'.
- Evidence: Miner stood completely still at the source, hauler waited endlessly for energy.

- Date-Time (UTC): `2026-02-15T16:15:00Z`
- Context: Remote logistics safety.
- Observation: Haulers on remote missions lacked self-preservation logic and would blindly path into rooms with hostiles or Invader Cores.
- Impact: Potential loss of haulers and carried resources if routed through or operating in compromised rooms.
- Action: Added early-exit enemy avoidance logic to `role.hauler.js`. Haulers now flee to their designated delivery room if they encounter armed hostiles or cores in remote rooms.
- Evidence: Code updated to scan for armed hostiles and cores; hauler state changes to '📢 Flee!'.

- Date-Time (UTC): `2026-02-15T16:30:00Z`
- Context: Log analysis post-deployment of E57S55 abandonment.
- Observation: A small overlap window during deployment allowed `hauler@E57S55` and `remoteMiner@E57S55` to spawn before the quota dropped to 0, resulting in `1/0` assignments. Furthermore, global `config.roles.js` still had a hardcoded `remoteMiner: 8` fallback, competing with local quotas.
- Impact: Risk of the spawner constantly replacing remote miners without proper room targets due to the global fallback exceeding actual sum of room quotas.
- Action: Reduced `remoteMiner` global fallback in `config.roles.js` from `8` to `0`, ensuring all remote mining is strictly managed by `main.js` multi-room logic.
- Evidence: Console logs displayed `RM@E:1/0 H@E:1/0` and `RM@M:8/4`.

- Date-Time (UTC): `2026-02-15T16:45:00Z`
- Context: Finalizing the abandonment of `E57S55` and stabilizing `E58S55`.
- Observation: All stranded creeps in `E57S55` were successfully redirected to the new mining room `E58S55` via manual memory override in the console. The system heartbeat reflects clean 0/0 assignments for the abandoned room.
- Impact: Operations are fully stable again, CPU is no longer wasted on deadlocked/fleeing creeps, and the new mining room is operating at full capacity without Invader Core suppression.
- Action: System state confirmed healthy. Transition from 'reserve' to 'claim' strategy for GCL 3 expansions validated.
- Evidence: Heartbeat shows `RM@E:0/0 H@E:0/0`.
