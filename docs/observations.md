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

- Date-Time (UTC): `2026-02-16T15:00:00Z`
- Context: Idle civilian creeps holding CPU/memory indefinitely when economy is saturated.
- Observation: Worker creeps would idle forever at `(25,25)` when no work was available, wasting initial spawn cost and risking quota deadlocks.
- Impact: Stagnant population limits adaptability.
- Action: Implemented a universal 100-tick idle auto-recycle feature ("Inaktivitäts-Schredder"). Creeps log `idleCount` and jump into the recycler if they haven't performed a productive action in 100 ticks.
- Evidence: Code updated to reset `idleCount` on productive ticks and trigger `memory.recycle` at >100.

- Date-Time (UTC): `2026-02-16T15:45:00Z`
- Context: Bootstrapping new colonies.
- Observation: The automated base planner (`utils.planner.js`) required a manually placed Spawn to act as the anchor point, delaying autonomous expansion.
- Impact: Human intervention required to start a new colony.
- Action: Implemented `Auto-Bootstrap` in the planner to dynamically calculate the midpoint between the controller and the first source and automatically place the first `STRUCTURE_SPAWN` construction site. Reduced planner interval from 1000 to 100 ticks.
- Evidence: System can now autonomously claim and initiate construction in a completely blank room.

- Date-Time (UTC): `2026-02-16T17:30:00Z`
- Context: Spawn-recycle loops due to static quotas in fully developed rooms.
- Observation: The system continuously spawned builders and scavengers even when no construction sites or dropped energy existed, leading to immediate 100-tick idle timeouts and recycling.
- Impact: Wasted spawn time, energy, and CPU.
- Action: Upgraded `getPhaseQuotas()` in `main.js` to Just-In-Time (JIT) logic. Builder quotas drop to 0 if no sites exist, shifting capacity to upgraders. Scavenger quotas drop to 0 if the floor is clean.
- Evidence: Spawns now push upgraders during peace-time and instantly switch to builders when `utils.planner.js` drops new sites.

- Date-Time (UTC): `2026-02-16T18:00:00Z`
- Context: Multi-room observability in the console.
- Observation: The single-line Heartbeat log became unreadable as the colony expanded to 4 rooms.
- Impact: High cognitive load to deduce which room was missing which role or if spawns were active.
- Action: Rewrote `utils.logger.js` and the heartbeat compiler in `main.js` to output a multi-line, color-coded dashboard grouped by room, including average TTL, RCL, and current spawn actions.
- Evidence: Console now displays a clean grid `[HOME] W7N8 (RCL 7) ... └─ HV:2/2 BLD:1/1 ...`

- Date-Time (UTC): `2026-02-16T18:30:00Z`
- Context: CPU bloat and orchestration deadlocks from redundant `room.find()` calls.
- Observation: The kernel repeatedly scanned rooms for structures and creeps across different modules, wasting CPU and causing edge-case deadlocks for unowned rooms.
- Impact: High CPU usage and rigid code coupling.
- Action: Extracted room scanning into a dedicated `utils.inventory.js` module. The kernel now relies exclusively on the cached `Memory.inventory` state.
- Evidence: CPU usage significantly stabilized; orchestration logic simplified.

- Date-Time (UTC): `2026-02-16T20:00:00Z`
- Context: Transitioning from rigid 4-room constants to an infinite-base architecture.
- Observation: Hardcoded `HOME/TARGET/EXPANSION/MINING` constants prevented the colony from scaling beyond GCL 4.
- Impact: Artificial limit on empire growth.
- Action: Refactored `main.js` to iterate over a dynamic `activeRegistry`. Spawning logic now generates a prioritized request queue for any number of `CORE` and `REMOTE` colonies. Added GCL-awareness to pause expansions when the limit is reached.
- Evidence: Spawner correctly manages `W8N8` as a remote outpost and prepares to claim `W6N8` dynamically.

- Date-Time (UTC): `2026-02-16T20:30:00Z`
- Context: Autonomous expansion and threat avoidance (Phase 5).
- Observation: Need for dynamic target selection and intelligence gathering to safely utilize the new infinite-base architecture.
- Impact: Allows the colony to spread autonomously.
- Action: Created `role.scout.js` and `utils.expansion.js`. Scouts map the universe, register minerals, and flag `dangerUntil` for hostile rooms. The global `PathFinder` routes around danger zones. The expander automatically selects the highest-scoring room when GCL is available.
- Evidence: Global console command `intel()` successfully outputs colored radar maps of surrounding sectors.

- Date-Time (UTC): `2026-02-16T21:00:00Z`
- Context: Advanced economy integration (Phase 4).
- Observation: High-level rooms accumulate excess minerals, while energy reserves can fluctuate during sieges.
- Impact: Stagnant wealth and vulnerability to energy starvation.
- Action: Implemented `utils.market.js`. The module automatically sells minerals above 10k buffer to the highest bidder and auto-buys energy if colony reserves fall below 50k. Added credit tracking to the Heartbeat HUD.
- Evidence: Heartbeat logs display `💰 150,000c (+2,400)`.

- Date-Time (UTC): `2026-02-16T22:30:00Z`
- Context: HUD accuracy and room state transitions.
- Observation: Newly claimed rooms (e.g. `W8N8`) were still tracked as `REMOTE` outposts, and the HUD displayed `Unclaimed` for reserved rooms due to missing phase context.
- Impact: Pioneers were not dispatched to build spawns in freshly conquered territory.
- Action: Updated `main.js` to automatically upgrade any `my: true` room in the inventory to a `CORE` registry type. Added detailed phase strings (e.g., `Phase 3 (Empire)`, `Bootstrap (No Spawn)`) to `getPhaseQuotas` and exposed them in the HUD.
- Evidence: HUD now accurately shows `[CORE] W8N8 (RCL 2 | Phase 1 (Pioneers))` and correctly triggers the builder priority.

- Date-Time (UTC): `2026-02-16T23:00:00Z`
- Context: Base Planner expansion for advanced RCL structures.
- Observation: Manual code adjustments were required for every new structure type (Labs, Terminals, Nukers, Extractors) as the colony leveled up.
- Impact: Hinders full autonomy.
- Action: Rewrote `utils.planner.js` to dynamically iterate through all core structures defined in `CONTROLLER_STRUCTURES` and place them automatically via the spiral-checkerboard algorithm. Added specific placement logic for Extractors and Containers.
- Evidence: Terminals and Extractors are now placed immediately upon reaching RCL 6 without human intervention.

- Date-Time (UTC): `2026-02-16T23:30:00Z`
- Context: Late-game base defense optimization.
- Observation: Perimeter walls (`STRUCTURE_WALL`) consume vast amounts of energy to maintain against decay, stalling economic growth.
- Impact: "Bunker Bankrupting" limits expansion.
- Action: Adopted the "Smart-Bunker" (Point-Defense) strategy. `utils.planner.js` now only places `STRUCTURE_RAMPART` directly on critical assets (Spawns, Towers, Storage, Terminal). The `structure.tower.js` prioritizes the absolute weakest rampart for emergency upkeep up to 50k hits.
- Evidence: Critical infrastructure is protected without the massive energy drain of perimeter walling.

- Date-Time (UTC): `2026-02-17T00:30:00Z`
- Context: Hauler Ping-Pong loop between Storage and delivery states.
- Observation: Haulers endlessly withdrew from storage and immediately deposited back because withdrawal logic lacked a strict sink-demand check.
- Impact: Idle-timers never triggered, preventing surplus haulers from recycling.
- Action: Restricted `storage` withdrawal in `role.hauler.js` to strictly require active demand from Spawns, Extensions, or Towers.
- Evidence: Extra haulers correctly entered `Idle:Empty` state and recycled.

- Date-Time (UTC): `2026-02-18T11:00:00Z`
- Context: Idle harvesters observed in high-RCL rooms despite "Fact-Based Scaling" being active.
- Observation: The `role.harvester` body in `config.roles.js` was defined with only 3 WORK parts. This is insufficient to saturate an energy source (10 energy/tick), which requires 5 WORK parts.
- Impact: The "Fact-Based Scaling" logic in `main.js`, which reduces the harvester quota to 1 per source at RCL 4+, was causing under-harvesting because the single harvester was too small. This resulted in inefficient swarms of underpowered, idle creeps.
- Action: Upgraded the `harvester` body to a 5-WORK-part configuration. This aligns the physical creep with the documented strategic intent in `manifest.md`, allowing the "Fact-Based Scaling" protocol to function correctly.
- Evidence: `manifest.md` explicitly states the goal of using a "single large Harvester". The previous body definition did not meet this requirement.

- Date-Time (UTC): `2026-02-18T12:00:00Z`
- Context: Follow-up to harvester body upgrade. Idle harvesters still observed in `W7N8`.
- Observation: The "Fact-Based Scaling" logic in `main.js` was set to reduce the harvester multiplier at RCL 4. However, the new 5-WORK part body (700 energy cost) is buildable at RCL 3. This caused the system to over-spawn harvesters (2 per source) at RCL 3, leading to one idle creep per source.
- Impact: Wasted energy on spawning redundant creeps and CPU on idle creep logic.
- Action: Adjusted the "Fact-Based Scaling" threshold in `main.js` to trigger at RCL 3. Corrected the `role.harvester.js` idle-recycle timer from 500 to the standard 100 ticks to remove surplus units faster.
- Evidence: User report of "4 harvesters standing around" in an RCL 3 room with 2 sources, which matches the `2 * 2 = 4` quota calculation.

- Date-Time (UTC): `2026-02-18T14:00:00Z`
- Context: Harvesters observed idling after the dynamic source-switching logic was implemented.
- Observation: The logic correctly switched sources if one was empty, but if *all* sources in a room were temporarily depleted, the harvester would still attempt to `harvest()` from an empty source. This returns `ERR_NOT_ENOUGH_RESOURCES` but does not trigger a `moveTo` call, causing the creep to freeze in place.
- Impact: Harvesters froze until sources regenerated, causing a temporary halt in the entire colony's energy income.
- Action: Added a final check in `role.harvester.js`. If the chosen source is still empty after re-evaluation, the creep will now explicitly `moveTo()` it and wait within range, instead of attempting a futile `harvest()` call. This makes the role resilient to temporary, room-wide energy depletion.
- Evidence: User report of "harvester... steht nur rum" (harvester... is just standing around).

- Date-Time (UTC): `2026-02-18T19:00:00Z`
- Context: Proactive code review of Upgrader efficiency and resilience.
- Observation: `role.upgrader.js` was lacking the `ERR_NO_PATH` (Unreachable Target Deadlock) protection that was recently added to Builders and Haulers.
- Impact: Upgraders could permanently freeze if they blocked each other while trying to withdraw from Storage or upgrade the Controller.
- Action: Added `unreachableTargetId` temporary blacklisting to all `moveTo` calls in the Upgrader role, fulfilling the SEV-1 follow-up directive.
- Evidence: Code review matched against Alert `2026-02-18T08:00:00Z` follow-up requirement.

- Date-Time (UTC): `2026-02-18T23:30:00Z`
- Context: HUD display showing `TTL: N/A` for all rooms.
- Observation: The `ttl` property in the room reports array was hardcoded to the string `'N/A'` and never calculated.
- Impact: Loss of fleet age visibility for the operator.
- Action: Replaced the hardcoded string with an actual calculation of the average `ticksToLive` of all creeps assigned to the room.
- Evidence: HUD now correctly displays `TTL: 1250` (or similar) instead of `N/A`.

- Date-Time (UTC): `2026-02-17T01:00:00Z`
- Context: Inter-colony logistics and energy balancing.
- Observation: New or besieged colonies could starve while mature core bases accumulated vast energy surpluses (>150k).
- Impact: Slower recovery and expansion for struggling rooms.
- Action: Added internal logistics to `utils.market.js`. Core bases with `>150k` energy automatically send 10k batches via Terminal to owned rooms falling below `50k` energy.
- Evidence: Terminal sends `RESOURCE_ENERGY` directly, averting market purchases when internal surplus is available.

- Date-Time (UTC): `2026-02-17T01:30:00Z`
- Context: RCL 5+ intra-room logistics optimization.
- Observation: Harvesters and haulers lost massive efficiency walking long distances between sources, controllers, and storage in mature rooms.
- Impact: Bottleneck in energy throughput at higher controller levels.
- Action: Implemented `structure.link.js` network. Source links beam energy to controller links (priority 1) or core storage links (priority 2), significantly reducing hauler pathing overhead.
- Evidence: Link transfers route energy instantly; harvesters prioritize depositing into adjacent links.

- Date-Time (UTC): `2026-02-17T02:00:00Z`
- Context: Creep Observability on the game map.
- Observation: Restricting frequent `creep.say()` calls for visual clarity made it impossible to easily identify creep roles and tasks on the map.
- Impact: Operator lost immediate visual feedback on creep distribution and behavior.
- Action: Added `room.visual.text()` overlay in the `main.js` execution loop to continuously render the creep's role beneath them without cluttering the action logs or overlapping chat bubbles.
- Evidence: Creeps now display small, color-coded role labels directly beneath their sprites.

- Date-Time (UTC): `2026-02-17T03:00:00Z`
- Context: Plundering abandoned enemy bases.
- Observation: Dead/abandoned rooms often contain hostile structures (Spawns, Towers, Extensions) filled with residual energy that goes to waste when they decay.
- Impact: Massive free energy influx available with zero mining cost.
- Action: Upgraded `role.scavenger.js` to target and withdraw from `!s.my` structures containing energy, specifically ignoring containers to protect neutral remote mining setups.
- Evidence: Scavengers successfully empty hostile structures and return the loot to the empire's storage.

- Date-Time (UTC): `2026-02-17T03:45:00Z`
- Context: Hauler logistics in rooms with single-access sources (W6N8).
- Observation: Haulers froze with `Seek Drop` because stationary miners physically blocked the path to the dropped energy, causing `findClosestByPath` to fail.
- Impact: Complete energy starvation in tight mining outposts.
- Action: Refactored resource targeting to use `ignoreCreeps: true` with `findClosestByRange` to allow haulers to walk up to the blocking creep and withdraw.
- Evidence: Haulers successfully approach miners and pull energy directly from their tile.

- Date-Time (UTC): `2026-02-17T04:00:00Z`
- Context: Cross-room energy and mineral overflow management.
- Observation: Haulers froze with `Idle:Full` or `Stuck:Min` when local storage was absent or full.
- Impact: Wasted carrying capacity and halted mining operations.
- Action: Upgraded `role.hauler.js` with SCOS Cross-System Export. Haulers now scan the global registry for the nearest valid `Storage` or `Terminal` and deliver inter-colony.
- Evidence: Haulers display `Export:Nrg` or `Export:Min` and traverse rooms to deliver goods.

- Date-Time (UTC): `2026-02-17T04:15:00Z`
- Context: Colony recovery and multi-room defense orchestration.
- Observation: Isolated spawns in failing or besieged rooms lacked the energy to bootstrap defenders or recovery workers, resulting in total room death (Death Spiral).
- Impact: Single points of failure for entire remote sectors.
- Action: Implemented the SCOS Mutual Aid Protocol. Spawns globally will now construct `defender`, `healer`, or emergency `harvester`/`hauler` units for other `CORE` rooms if those rooms drop to 0 economy creeps or trigger a defense alert.
- Evidence: Spawns log `🚑 MUTUAL AID: Spawn1 spawning defender to rescue W6N8!`.

- Date-Time (UTC): `2026-02-17T04:30:00Z`
- Context: Civilian survivability against Invader Cores and creeps.
- Observation: Builders and Harvesters ignored Invader Cores (classified as structures) and cornered themselves during evasion, causing pathfinder failures.
- Impact: Needless loss of civilian creeps during early core deployments.
- Action: Enhanced `ACTIVE EVASION (KITING)` protocol across all civilian roles to detect `STRUCTURE_INVADER_CORE` and permitted cross-room fleeing (`maxRooms: 2`).
- Evidence: Civilians accurately display `Kite!` and flee to adjacent rooms when cornered.

- Date-Time (UTC): `2026-02-17T06:00:00Z`
- Context: Spawner deadlocks and idle creep swarms in mature mining rooms.
- Observation: The "Screeps Speed Limit" means a source yields exactly 10e/t (3000 energy / 300 ticks). 3 large Harvesters (RCL 4+) strip a source in 85 ticks and idle for 215 ticks. Meanwhile, logistics bottlenecks cause full containers but empty spawns.
- Impact: Wasted spawn capacity, massive CPU sink from idle swarms, and manual tweaking of `config.rooms.js` required for every room.
- Action: Implemented "Fact-Based Scaling" (1 harvester per source at RCL 4+) and "Self-Healing Logistics" (dynamic hauler/scavenger quotas based on container overflow and dropped energy).
- Evidence: Heartbeat logs now dynamically scale hauler quotas and harvesters no longer cluster idly around depleted sources.

- Date-Time (UTC): `2026-02-17T07:00:00Z`
- Context: End-of-day configuration and performance sweep.
- Observation: Legacy static overrides in `config.rooms.js` (e.g., `harvesters: 9`) were bypassing the new Fact-Based Scaling logic, and civilian idle states contained residual `O(N^2)` pathing functions.
- Impact: Hindered autonomous JIT scaling and exposed the VM to CPU exhaustion when large numbers of legacy creeps idled.
- Action: Stripped all manual creep quotas from `config.rooms.js` to enforce pure OS autonomy. Eradicated `findClosestByPath` in fallback routines globally.
- Evidence: CPU stabilized at ~15ms, Spawns operate strictly on algorithmic demand, and `config.rooms.js` now acts purely as a topology map.
