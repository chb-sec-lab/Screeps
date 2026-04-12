# SCOS Alerts Log

[Hub](hub.html) | [Overview](index.md) | [Manifest](manifest.md) | [Architecture](architecture.md) | [Observations](observations.md)

## Purpose

Track urgent production incidents and response quality. Keep entries brief and factual.

## Severity Scale

- `SEV-1`: immediate threat to survival (home collapse, spawn deadlock, complete defense failure)
- `SEV-2`: major degradation (target room unsafe, mission blocked, repeated spawn failures)
- `SEV-3`: local issue with workaround (single-role instability, temporary routing issue)

## Entry Template

- Date-Time (UTC): `YYYY-MM-DDTHH:MM:SSZ`
- Severity: `SEV-x`
- Trigger: what happened
- Scope: affected room(s)/role(s)
- Immediate Response: first mitigation
- Resolution: final fix
- Follow-up: preventive action

## Entries

- Date-Time (UTC): `2026-02-14T10:21:00Z`
- Severity: `SEV-2`
- Trigger: invader pressure in `E57S56` while logistics and builder traffic were active
- Scope: `remoteMiner`, `upgrader`, `builder` losses and interruptions
- Immediate Response: threat-driven defender priority and emergency spawn path
- Resolution: defender routing with memory-based target assignment
- Follow-up: continue extension rollout in `E57S56` to improve local spawn throughput

- Date-Time (UTC): `2026-02-14T22:34:00Z`
- Severity: `SEV-2`
- Trigger: kernel loop crash during active intruder period (`TypeError: _.maxBy is not a function`)
- Scope: full colony orchestration paused due to exception in `main.js`
- Immediate Response: replaced unsupported lodash helper with runtime-safe native loop selection for urgent threat room
- Resolution: loop recovered and threat handling resumed without repeated crash spam
- Follow-up: avoid non-portable lodash helpers in Screeps runtime and prefer explicit JS loops in critical paths

- Date-Time (UTC): `2026-02-15T09:15:00Z`
- Severity: `SEV-2`
- Trigger: CPU limit reached (20/20) and expansion blocked by undetected Invader Cores
- Scope: Global CPU performance, rooms `E57S55` and `E58S55`
- Immediate Response: Optimized kernel loops and updated defender role to target cores
- Resolution: CPU usage stabilized below limit; defenders successfully engaged and cleared Invader Cores
- Follow-up: Monitor CPU overhead during concurrent multi-room combat operations

- Date-Time (UTC): `2026-02-15T15:00:00Z`
- Severity: `SEV-2`
- Trigger: Persistent hostile presence in `E57S55` caused total loss of energy imports, starving the target room `E57S56` infrastructure.
- Scope: `E57S56` (infrastructure buffers) and `E57S55` (remote miners/claimer).
- Immediate Response: Reduced `TARGET_UPGRADER_QUOTA` and `TARGET_BUILDER_QUOTA` to 1. Reduced `E57S55` remote miners to 1.
- Resolution: Shifted the `claimer` spawn priority to `E58S55` to safely secure and double energy output from the secondary mining room.
- Follow-up: Evaluate if `E57S55` should be abandoned completely if hostility continues.

- Date-Time (UTC): `2026-02-15T19:00:00Z`
- Severity: `SEV-3`
- Trigger: Armada of creeps (haulers, builders, upgraders) stuck oscillating at the border of `E57S55`.
- Scope: Legacy creeps holding `E57S55` in memory + Flawed flee logic.
- Immediate Response: Added automatic memory purge in `main.js` execution loop to instantly redirect `E57S55` assignments to the active `E58S55` room.
- Resolution: Creeps instantly unblocked and resumed work. 
- Follow-up: Reassigned the `EXPANSION` constant in `config.rooms.js` to officially cut ties with `E57S55`.

- Date-Time (UTC): `2026-02-15T19:30:00Z`
- Severity: `SEV-2`
- Trigger: Creep Armada still bouncing endlessly between `E58S55` and `E57S55` despite memory purge.
- Scope: Global pathfinding and Flee logic.
- Immediate Response: Investigated map topology. Identified that the default Screeps `PathFinder` routes creeps traveling between `TARGET (E57S56)` and `MINING (E58S55)` through the `E57S55` shortcut. Upon entering, the `hauler` Flee logic triggers, forcing them back, creating an infinite loop.
- Resolution: Implemented strict **Quarantine Zone** and **Safe Corridor** logic in `main.js`. Creeps in `E57S55` are forced to EVAC immediately overriding any role logic. Cross-room travel between TARGET and MINING is hard-routed through `HOME`.
- Follow-up: Future remote strategies must explicitly map safe transit corridors if adjacent rooms are occupied by hostile Invader Cores.

- Date-Time (UTC): `2026-02-15T22:05:00Z`
- Severity: `SEV-2`
- Trigger: Kernel loop crash (`ReferenceError: dynamicMinerQueue is not defined`).
- Scope: Full colony orchestration halted.
- Immediate Response: Added missing `dynamicMinerQueue` array initialization and population loop right before it is assigned to `roomAssignments` in `main.js`.
- Resolution: Loop successfully recovered and dynamic harvester spawning resumed.
- Follow-up: Ensure full variable scope transfers during module patching.

- Date-Time (UTC): `2026-02-15T23:30:00Z`
- Severity: `SEV-3`
- Trigger: Harvesters and Scavengers endlessly ping-ponging at room borders (`E58S56` -> `E57S56` and `E58S55`).
- Scope: Logistics and Mining roles across multi-room deployments.
- Immediate Response: Identified state-machine flaws. Harvesters were locking onto `HOME` sources during spawn and trying to return to them from target rooms. Scavengers with partial energy loads crossed borders for tiny salvage amounts when local delivery failed.
- Resolution: Updated `main.js` to automatically clear cross-room source locks and only assign sources when harvesters reach their `targetRoom`. Modified `role.scavenger.js` to strictly forbid cross-room scavenging if already carrying energy (using `localOnly` scoping).
- Follow-up: Future roles with "lock-on" behavior must validate that their locked target exists in the correct designated operational room.

- Date-Time (UTC): `2026-02-16T00:15:00Z`
- Severity: `SEV-3`
- Trigger: Creeps (specifically Scavengers) hanging at room borders again, trying to reach abandoned `E57S55`.
- Scope: Global PathFinder and Creep Memory.
- Immediate Response: Identified a recurring "Border Ping-Pong" pattern. Cause 1: `PathFinder` hit `maxOps: 2000` when calculating detours around the blacklisted room, returning incomplete paths. Cause 2: Hardcoded memory purges missed custom role keys like `salvageRoom`.
- Resolution: Increased `opts.maxOps` to `8000` in the global `moveTo` prototype. Replaced the static memory purge with a dynamic loop that scrubs `E57S55` from *all* memory keys.
- Follow-up: Abandoning a room requires Universal Memory Scrubbing, not just targeting known keys.

- Date-Time (UTC): `2026-02-16T03:15:00Z`
- Severity: `SEV-1`
- Trigger: Missing `targetRoom` memory assignment for `miningUpgraders` quota resulted in infinite upgrader spawning (36+ creeps).
- Scope: Global CPU crash (Bucket exhausted), complete energy starvation, total defense failure resulting in destroyed Spawns and Towers in `E57S56` and `E58S55`.
- Immediate Response: Mass recycled defective upgraders via console to restore CPU and energy.
- Resolution: Added missing `spawnMemory.targetRoom = rooms.MINING` mapping in `main.js`.
- Follow-up: Validate memory mapping for all new room-specific role quotas to prevent quota leaks.

- Date-Time (UTC): `2026-02-16T04:30:00Z`
- Severity: `SEV-1`
- Trigger: High-level PvP attack by player 'jlk' requesting passthrough. Ignored chat and solid wall ramparts led to the destruction of all Spawns and Towers by dismantling units.
- Scope: Global infrastructure wipe in active rooms. Code/GCL survived.
- Immediate Response: Activated Safe Mode. Placed new Spawn site. Forcibly reassigned all surviving logistics/mining creeps to `builder` role via console to bootstrap the new spawn using residual storage energy.
- Resolution: Implemented diplomacy whitelist (`ALLIES = ['jlk']`) in `main.js` and `structure.tower.js`. Reconfigured ramparts to bunker-style (only covering structures, leaving roads open). 
- Follow-up: Fixed `role.builder.js` to prioritize Spawns absolutely (`0) ABSOLUTE EMERGENCY`) over the new 50k rampart floor to prevent deadlock during future cold-boots.

- Date-Time (UTC): `2026-02-16T06:30:00Z`
- Severity: `SEV-1`
- Trigger: Colony deadlock at RCL 1 during respawn bootstrap. `HOME_UPGRADER_QUOTA` was missing from the rigid spawn priority ladder, causing the spawner to prioritize remote/expansion roles (which it couldn't afford or utilize properly).
- Scope: `HOME` progression completely stalled.
- Immediate Response: Mass-recycled wandering creeps via console to recover energy. 
- Resolution: Hardcoded `HOME_UPGRADER_QUOTA: 2` into the `main.js` priority ladder directly below Harvesters and Builders.
- Follow-up: Bootstrapping a new room requires strict localized prioritization (Harvester -> Builder -> Upgrader) before any remote quotas are evaluated.

- Date-Time (UTC): `2026-02-16T14:00:00Z`
- Severity: `SEV-3`
- Trigger: Widespread "Border Ping-Pong" and idle deadlocks among logistics and worker creeps (haulers, scavengers, remoteMiners).
- Scope: Multi-room logistics and early-game bootstrapping.
- Immediate Response: Identified that early `return` in idle states left creeps on exit tiles (`x=0,49` or `y=0,49`), causing the engine to bounce them back.
- Resolution: Implemented a universal Anti-Ping-Pong fallback (`moveTo(25,25, {range: 22})`) for all idle states. Fixed Scavenger deadlock by replacing broken distribution with `doConsolidate`. Enabled Haulers to scavenge drops/ruins when containers are missing.
- Follow-up: Ensure all future idle states actively steer creeps away from room borders.

- Date-Time (UTC): `2026-02-16T15:30:00Z`
- Severity: `SEV-1`
- Trigger: Claimers and pioneers routing to `W8N8` instead of `W6N8` (Quota Leak & Amnesia).
- Scope: `main.js` spawn logic, `role.claimer.js` fallbacks.
- Immediate Response: Analyzed target room amnesia and fallback variables causing creeps to migrate to the wrong room.
- Resolution: Fixed missing `targetRoom` memory assignment for claimers in `main.js`. Removed `EXPANSION` fallback from `role.claimer.js`. Added an orphan migration script to redirect stranded creeps from `W8N8` to `W6N8`.
- Follow-up: Avoid hardcoded room fallbacks in roles; rely entirely on `main.js` orchestrator memory.

- Date-Time (UTC): `2026-02-16T16:00:00Z`
- Severity: `SEV-2`
- Trigger: Creeps (claimers, builders) bouncing infinitely at room borders ("Swamp Hugging").
- Scope: Global PathFinder and room transition mechanics.
- Immediate Response: Identified that creeps stepping onto an exit tile to bypass swamps trigger an engine teleport back to the previous room.
- Resolution: Replaced `findExitTo` with `moveTo(25, 25)` for cross-room travel. Implemented a universal "Border Bounce Fix" (force one step inward) across `claimer`, `builder`, `upgrader`, and `remoteMiner`.
- Follow-up: All cross-room movement must actively pull creeps into the room, not just target the exit boundary.

- Date-Time (UTC): `2026-02-16T17:00:00Z`
- Severity: `SEV-3`
- Trigger: Creeps ordered to recycle froze indefinitely in remote mining rooms (e.g., `W7N7`) without a local spawn.
- Scope: Universal Recycle Command in `main.js`.
- Immediate Response: Identified that `FIND_MY_SPAWNS` is strictly local to the creep's current room.
- Resolution: Added global fallback `Object.values(Game.spawns)[0]` and cross-room `moveTo` routing for recycling creeps.
- Follow-up: Ensure all "return to base" fallbacks account for remote/unowned rooms.

- Date-Time (UTC): `2026-02-16T19:00:00Z`
- Severity: `SEV-2`
- Trigger: Kernel loop crash (`ReferenceError: activeRegistry is not defined`).
- Scope: Full colony orchestration halted.
- Immediate Response: Identified scope leak caused by block-level `const` declaration desynchronized during refactoring.
- Resolution: Replaced `const` with `var` to force variable hoisting to the top of the scope, preventing reference errors.
- Follow-up: Use `var` for core orchestration registries that are accessed across deeply nested fallback chains.

- Date-Time (UTC): `2026-02-16T19:30:00Z`
- Severity: `SEV-3`
- Trigger: `mineralMiner` creeps permanently freezing on empty mineral deposits.
- Scope: Mineral extraction logic.
- Immediate Response: Identified that sleeping while waiting for mineral regeneration (50,000 ticks) exceeds creep lifespan (1,500 ticks), causing silent quota leaks.
- Resolution: Forced immediate `memory.recycle = true` when minerals are depleted. The universal recycle command automatically dumps inventory before recycling.
- Follow-up: Avoid sleep states for any timer exceeding creep maximum lifespan.

- Date-Time (UTC): `2026-02-16T21:30:00Z`
- Severity: `SEV-2`
- Trigger: Kernel loop crashes (`ReferenceError: targetRoom is not defined` and `armyOn is not defined`).
- Scope: Spawner orchestration halted.
- Immediate Response: Identified missing variable declarations following the Infinite-Base architecture refactoring.
- Resolution: Re-declared `targetRoom`, `expansionRoom`, and `armyOn` at the top of the Spawner pass.
- Follow-up: Ensure legacy dependencies in helper functions like `readNeeds()` are either updated or provided with their required scope variables.

- Date-Time (UTC): `2026-02-16T22:00:00Z`
- Severity: `SEV-3`
- Trigger: Screeps console outputs raw HTML tags (`<font>`, `<span>`) instead of formatting text.
- Scope: Visual HUD in `utils.logger.js`.
- Immediate Response: Identified that the Screeps Steam Client aggressively sanitizes/escapes all HTML tags, unlike the Web Client.
- Resolution: Completely stripped all HTML tags from the logger and `global.intel`. Shifted to a pure ASCII/Emoji layout for guaranteed cross-client compatibility.
- Follow-up: Avoid HTML in `console.log` entirely. Rely on text alignment and Emojis for visual hierarchy.

- Date-Time (UTC): `2026-02-17T03:30:00Z`
- Severity: `SEV-1`
- Trigger: Global CPU Bucket exhaustion resulting in continuous `Script execution has been terminated` crashes.
- Scope: Global execution loop.
- Immediate Response: Added a CPU Circuit Breaker to skip ticks if bucket falls below 500.
- Resolution: Identified `findClosestByPath` combined with `ignoreCreeps: true` in `role.hauler.js` as a massive CPU sink (O(N^2) pathfinding). Replaced with `findClosestByRange` and cached `inRangeTo` distance checks across all logistics and worker roles.
- Follow-up: Forbid the use of `findClosestByPath` with `ignoreCreeps: true` in high-frequency arrays.
