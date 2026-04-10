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

- Date-Time (UTC): `2026-02-15T18:00:00Z`
- Context: Milestones in E58S55 (MINING) room.
- Observation: Room successfully progressed to RCL 2 with Spawn3 built, containers placed, and 5 extensions under construction.
- Impact: E58S55 is now transitioning from a pure remote mining outpost to a fully functional base.
- Action: Added `MINING_UPGRADER_QUOTA: 1` and `MINING_HAULER_QUOTA: 1` to orchestrator to fully leverage the new local infrastructure and push RCL further.
- Evidence: Code updated to spawn local haulers and upgraders in MINING room.

- Date-Time (UTC): `2026-02-15T18:15:00Z`
- Context: E57S55 (EXPANSION) continuous Invader Core disruptions.
- Observation: The target room was heavily disrupted by Invader Cores and claimers. Defenders took too long to traverse, and builders/haulers were getting stuck at borders trying to fulfill stale memory tasks.
- Impact: Wasted CPU and idle creeps hanging around room borders unable to operate safely.
- Action: Completely abandoned E57S55 by commenting it out of `config.rooms.js` registry. E58S55 is now the exclusive focus for expansion.
- Evidence: Builder `pickBestWorkRoom` no longer evaluates E57S55.

- Date-Time (UTC): `2026-02-15T18:30:00Z`
- Context: Complete energy starvation in E57S56 (TARGET) despite presence of local creeps.
- Observation: The 6 base harvesters were correctly locking to sources in the HOME room (where they spawned), leaving E57S56 completely unmined. Haulers in E57S56 had no stored energy to transport.
- Impact: Storage and extensions remained empty. Upgraders and builders had to harvest manually, drastically reducing efficiency.
- Action: Introduced a dedicated `TARGET_MINER_QUOTA: 4` utilizing the `remoteMiner` role but with `homeRoom` and `targetRoom` both set to E57S56, instructing them to mine and deposit locally.
- Evidence: Heartbeat now tracks `RM@T:4` and haulers have energy to move.

- Date-Time (UTC): `2026-02-15T19:00:00Z`
- Context: Evaluation of claiming `E57S55` to permanently stop Invader Cores.
- Observation: The colony is currently at Global Control Level (GCL) 3, meaning the maximum number of claimed rooms is 3 (`E58S56`, `E57S56`, and newly established `E58S55`).
- Impact: `E57S55` cannot be claimed to suppress Invader Cores. It can only be reserved, which allows Cores to continuously respawn and harass operations.
- Action: Officially abandoned `E57S55` as an expansion target and re-routed all logic and constants to `E58S55`.
- Evidence: Game mechanics dictate Invader Cores spawn in unowned/reserved rooms to disrupt remote mining.

- Date-Time (UTC): `2026-02-15T19:30:00Z`
- Context: Pathfinding across multi-room topology containing hostiles.
- Observation: Standard `creep.moveTo()` blindly takes the shortest route, which dragged creeps through the heavily hostile `E57S55` when traveling diagonally between `E57S56` and `E58S55`.
- Impact: Flee mechanics clashed with shortest-path logic, creating infinite room-border oscillation.
- Action: Added strict transit corridors in the kernel (`main.js`) to force routing through the safe `HOME` room (`E58S56`) and a forced EVAC state for any creep stepping into `E57S55`.
- Evidence: Creeps displayed "📢 Flee!" directly followed by stepping back onto the exit tile continuously.

- Date-Time (UTC): `2026-02-15T20:00:00Z`
- Context: Replacing hardcoded "Safe Corridors" with dynamic PathFinder routing.
- Observation: Hardcoding specific room-to-room detours in `main.js` is unscalable and brittle as the colony expands.
- Impact: Prevents writing complex routing rules for every new room combination.
- Action: Implemented a global `BLACKLIST` in `config.rooms.js` and a prototype override for `Creep.prototype.moveTo` in `main.js`. Returning `false` in `opts.roomCallback` forces the global PathFinder to treat the entire room as unwalkable.
- Evidence: Hardcoded detours removed from kernel; creeps naturally path around `E57S55` using default movement calls.

- Date-Time (UTC): `2026-02-15T20:30:00Z`
- Context: Cross-room healing constraints and Creep survival.
- Observation: Towers cannot heal across room boundaries due to Screeps mechanics, leading to damaged creeps returning to dangerous rooms before being fully healed.
- Impact: Increased mortality rate for logistics and mining creeps operating in remote rooms.
- Action: Added a "Pre-flight Check" (Pit Stop) logic to `role.hauler.js` and `role.remoteMiner.js`. Creeps now pause their mission and wait in their Home room if `hits < hitsMax` so the local Tower can fully heal them before they cross the border.
- Evidence: Damaged creeps display "🩹 Pit Stop" and remain in the safe room until fully repaired.

- Date-Time (UTC): `2026-02-15T21:00:00Z`
- Context: Defender survivability in sustained cross-room combat.
- Observation: Defenders fought to the death in target rooms because they lacked self-preservation logic, forcing the colony to constantly spend energy replacing them.
- Impact: High energy drain during invasions and temporary loss of room control while replacements traveled.
- Action: Implemented "Tactical Retreat" and "Pit Stop" logic in `role.defender.js`. Defenders now flee to `HOME` if their health drops below 40% (`hits < hitsMax * 0.4`), where they hold position until Towers fully heal them.
- Evidence: Defenders emit "🚑 Retreat!" and return to home safely, reusing the same body for multiple engagements.

- Date-Time (UTC): `2026-02-15T22:30:00Z`
- Context: Defense capability during heavy invader pressure (2+ hostiles).
- Observation: A single unassisted defender was vulnerable to being overwhelmed by grouped hostiles, leading to attrition and resource drain.
- Impact: Slower threat clearance and higher rebuilding costs for defense units.
- Action: Activated the dormant `role.healer.js` script and integrated dynamic threat scaling in `main.js`. The system now scales up to 3 defenders based on enemy count, and automatically deploys a dedicated `healer` if threat levels reach 2 or more.
- Evidence: Spawn queue now displays `healer@TARGET` when multiple hostiles appear, and logger tracks `heal:1/1` during DEF ALERT.

- Date-Time (UTC): `2026-02-15T23:00:00Z`
- Context: Transitioning to advanced economy (Phase 4 Roadmap).
- Observation: `E58S56` (HOME) reached RCL 7 and `E57S56` (TARGET) reached RCL 6, enabling Extractor structures and mineral harvesting.
- Impact: The colony can now gather raw minerals necessary for Labs, boosts, and market trades.
- Action: Implemented dynamic `mineralMiner` queue detection in `main.js`. It automatically identifies rooms with `RCL >= 6`, an active `Extractor`, and `mineral.amount > 0` to spawn and dispatch a dedicated `mineralMiner` who delivers directly to the Terminal/Storage.
- Evidence: Heartbeat assignments now track `MM@<Room>` quotas and `MINM` population appears.

- Date-Time (UTC): `2026-02-15T23:45:00Z`
- Context: CPU Bucket limits and Creep lifecycle management.
- Observation: Highly optimized code leads to a full CPU bucket (10,000), wasting potential market value. Obsolete creeps previously had to be manually killed (`suicide`), wasting their initial energy cost.
- Impact: Lost opportunity for Pixel generation (credits) and wasted energy from unneeded creeps.
- Action: Added automated `Game.cpu.generatePixel()` when bucket is full. Implemented a universal `creep.memory.recycle` flag that routes creeps to the nearest spawn to reclaim their energy cost.
- Evidence: `Game.cpu.bucket` check at the end of the main loop and `recycleCreep` logic intercepting standard role execution.

- Date-Time (UTC): `2026-02-16T00:15:00Z`
- Context: Creeps hanging at room borders when a room is abandoned.
- Observation: Two engine mechanics caused "Ping-Pong" loops: 1. `PathFinder` defaults to 2000 `maxOps`, returning incomplete paths when detouring around blacklisted rooms. 2. Role-specific memory keys (like `salvageRoom`) retain the abandoned room.
- Impact: Scavengers and haulers froze at borders, wasting CPU on repeated failed pathing attempts.
- Action: Increased `opts.maxOps` to 8000 in the global `moveTo` override and replaced hardcoded memory key purges with a universal loop that scrubs the abandoned room from all memory fields.
- Evidence: Creeps successfully calculated detours and resumed operations in valid rooms.

- Date-Time (UTC): `2026-02-16T01:00:00Z`
- Context: Ping-pong oscillation at borders of active rooms with Invader Cores.
- Observation: The "Flee" logic for remote miners and haulers was strictly vision-based. When encountering a Core, they fled to a safe room, instantly lost vision of the Core, "forgot" the danger, and tried to return.
- Impact: Endless ping-pong at the room border whenever an Invader Core was active.
- Action: Implemented "No-Vision Amnesia" fix. Fleeing creeps now set a `lastDangerTick` or `fleeCooldown` in memory, forcing them to hold position in the safe room (`💤 Safe`/`⌛ Abwarten`) for 50 ticks before attempting to re-enter.
- Evidence: Creeps now safely park in the home room instead of looping on the exit tiles.

- Date-Time (UTC): `2026-02-16T01:30:00Z`
- Context: Over-spawning of remote miners in E58S55.
- Observation: The orchestrator was configured to spawn 4 `remoteMiner`s for E58S55, but the room only possesses 1 energy source. The idle surplus creeps hovered near room borders.
- Impact: Wasted energy on spawning redundant creeps that had no work capacity available.
- Action: Adjusted `MINING_REMOTE_MINER_QUOTA` (hardcoded 4 -> 2) in `main.js`, `manifest.md`, and `utils.logger.js`. Operator manually dispatched surplus creeps to the recycler via mass console command.
- Evidence: Spawn queue now appropriately targets `RM@M:2`, preventing over-saturation.

- Date-Time (UTC): `2026-02-16T03:30:00Z`
- Context: Safeguarding against CPU Bucket exhaustion and Quota Leaks.
- Observation: A single missing targetRoom assignment previously caused an infinite spawn loop, draining the 10k CPU bucket via PathFinder overloads and terminating the script early.
- Impact: Hard script terminations bypassed Tower and Spawn logic, leading to total defense failure.
- Action: Implemented a "CPU Circuit Breaker" in `main.js` that soft-yields creep execution if `Game.cpu.getUsed() > Game.cpu.tickLimit * 0.8`. Added a `HARD_POP_CAP` of 60 to globally block infinite spawn loops.
- Evidence: Script gracefully logs `⏸️ CPU` over creeps instead of crashing the Screeps Node VM.

- Date-Time (UTC): `2026-02-16T03:45:00Z`
- Context: Rampart buffer threshold evaluation.
- Observation: 10,000 hitpoints provide approximately 10 minutes of buffer against a standard Invader, which proved insufficient during severe kernel/CPU crashes.
- Impact: Soft structures (Spawns, Towers) remain highly vulnerable if the active defense orchestration goes offline for over 15 minutes.
- Action: Increased `RAMPART_FLOOR` globally from 10,000 to 50,000, extending the fallback safety margin to roughly ~1 hour of sustained attack. Raised soft cap to 100,000.
- Evidence: Code updated in `role.builder.js`, `role.repairer.js`, `structure.tower.js`, and `main.js` audit logic.

- Date-Time (UTC): `2026-02-16T04:00:00Z`
- Context: System freeze for stability testing and baseline observation.
- Observation: The colony has undergone rapid architectural changes (CPU breakers, automated road planning, rampart upgrades). The operator explicitly values offline stability ("the game belongs to me, not I to the game").
- Impact: Prevents feature-creep and allows the new safety mechanisms (Pop Cap, CPU Breaker, 50k Ramparts) to be tested by natural game events.
- Action: Suspended new feature deployments (e.g., Base Planner Phase 2). The system is now entering an active "Hands-Off" monitoring phase.
- Evidence: Operator mandate. Roadmap marked Phase 1 of Base Planner as done and paused Phase 2.

- Date-Time (UTC): `2026-02-16T05:30:00Z`
- Context: Wipe and Respawn (The Phoenix Protocol).
- Observation: The previous colony was wiped by a high-level PvP siege. The operator successfully respawned in a new sector (`W7N8`), retaining GCL 3.
- Impact: The colony starts at RCL 1 but with a highly optimized codebase (SCOS v7), including automated base planning and diplomacy tools.
- Action: Updated `config.rooms.js` topology to the new sector. Cleared the global pathing blacklist. Removed `jlk` from the diplomacy whitelist as the new sector is far away.
- Evidence: Topology mapped to `W7N8`. `ALLIES` array in `main.js` and `structure.tower.js` is empty. Version bumped to `7.0.0`.

- Date-Time (UTC): `2026-02-16T06:00:00Z`
- Context: Scouting new novice sector around `W7N8`.
- Observation: Northern rooms (`W7N9`, etc.) are blocked by mountains. `W7N7` (South) has 2 sources. `W8N8` (West) and `W6N8` (East) have 1 source each. `W6N6` contains an Invader Core. Novice area is protected for 16 days.
- Impact: Defines the expansion roadmap for the next two weeks. 16-day shield allows pure economic boom without PvP risk.
- Action: Updated topology in `config.rooms.js` and manifest. `TARGET` set to `W7N7` for future base. `W6N6` added to `BLACKLIST`.
- Evidence: Map scouting by operator.

- Date-Time (UTC): `2026-02-16T06:30:00Z`
- Context: Early game bootstrap optimization (RCL 1-2).
- Observation: Builders wasted time on roads while Extensions were pending. Haulers and Scavengers idled because no containers existed.
- Impact: Slower progression to higher energy capacities.
- Action: Disabled `hauler` and `scavenger` quotas in `config.roles.js` temporarily. Updated `role.builder.js` to prioritize `STRUCTURE_EXTENSION` immediately below Spawns.
- Evidence: Creep distribution stabilizes; builders focus entirely on energy capacity.

- Date-Time (UTC): `2026-02-16T12:00:00Z`
- Context: Transitioning from rigid multi-room constants to autonomous Colony Architecture.
- Observation: Hardcoded HOME/TARGET variables scaled poorly and required manual intervention during the cold reboot (Phase 1). Advanced quotas starved the new Level 1 spawn.
- Impact: Unpredictable spawn locks when claiming new rooms or recovering from wipes.
- Action: Introduced the "Control Room" registry (`config.rooms.js`) and the "Evolution Protocol" (`main.js`). Rooms now dynamically self-evaluate their required worker quotas based on their individual Room Control Level (RCL). Added `STRUCTURE_STORAGE` to the automated base planner for RCL 4 integration.
- Evidence: `main.js` now uses `getPhaseQuotas(level)` for local and target rooms dynamically. Version bumped to `7.1.0`.

- Date-Time (UTC): `2026-02-16T14:15:00Z`
- Context: Screeps UI and Heartbeat readability.
- Observation: Unicode Emoji characters in `creep.say()` caused rendering overlaps, text clipping, and visual clutter in the game client.
- Impact: Poor visual observability on the map.
- Action: Converted all `creep.say()` outputs across all 14 roles to pure ASCII text (e.g., 'Zzz', 'PitStop', 'No E'). Fixed obsolete defender guard coordinates from `(31,3)` to `(25,25)`.
- Evidence: Visual map clarity restored, bubbles no longer overlap wildly.

- Date-Time (UTC): `2026-02-16T14:30:00Z`
- Context: Creep lifecycle, auto-recycling, and pre-spawning logic.
- Observation: A static 75-tick pre-spawn window caused either spawn-overlaps or gaps depending on creep size and destination distance. Obsolete defenders drained energy without recycling, and recycled creeps dropped their carried payload on the floor.
- Impact: Wasted CPU, energy loss on creep death, and inaccurate spawn timing.
- Action: Implemented dynamic `getPreSpawnTime()` in `main.js` combining body size and `Game.map.getRoomLinearDistance()`. Added auto-recycle for obsolete defenders. Added an inventory dump routine before a creep jumps into the spawn for recycling.
- Evidence: Heartbeat tracks defender `ttl`. Creeps reliably deposit payload before recycling. Spawns calculate perfect replacement timing.
