/**
 * main.js - SCOS Kernel
 * Role: Orchestrator / Spawn Policy / Defense Escalation / Audit Snapshots
 */
const rooms = require('config.rooms');
const roles = require('config.roles');
const logger = require('utils.logger');
const towerLogic = require('structure.tower');
const planner = require('utils.planner');
const DEFENSE_COOLDOWN_TICKS = 200;
const TACTICAL_AUDIT_INTERVAL = 200;
const STRATEGIC_AUDIT_INTERVAL = 3600;
const AUDIT_RETENTION_TACTICAL = 120;
const AUDIT_RETENTION_STRATEGIC = 100;

// --- GLOBAL PATHFINDER OVERRIDE ---
// Automatisches Blockieren von Räumen für alle Creeps
const originalMoveTo = Creep.prototype.moveTo;
Creep.prototype.moveTo = function(target, opts) {
    opts = opts || {};
    const userCallback = opts.roomCallback;
    
    // 🛠️ FIX: Give PathFinder enough CPU headroom to calculate detours around blacklisted rooms!
    // If it hits maxOps (default 2000), it returns an incomplete path, causing creeps to freeze at room borders.
    if (!opts.maxOps) opts.maxOps = 8000;

    opts.roomCallback = function(roomName) {
        if (rooms.BLACKLIST && rooms.BLACKLIST.includes(roomName)) {
            return false; // ⛔ Weist den PathFinder an, diesen Raum komplett zu ignorieren
        }
        if (userCallback) {
            return userCallback(roomName);
        }
        return undefined;
    };
    
    return originalMoveTo.call(this, target, opts);
};

let modules = {};
const roleNames = ['harvester', 'hauler', 'scavenger', 'repairer', 'defender', 'vanguard', 'medic', 'breacher', 'remoteMiner', 'builder', 'claimer', 'upgrader', 'healer', 'mineralMiner'];

roleNames.forEach(name => {
    try { modules[name] = require('role.' + name); } catch (e) { /* Safe Load */ }
});

module.exports.loop = function () {
    for (let name in Memory.creeps) if (!Game.creeps[name]) delete Memory.creeps[name];

    const census = {};
    roleNames.forEach(r => census[r] = 0);
    const homeRoom = Game.rooms[rooms.HOME];
    const allSpawns = Object.values(Game.spawns);
    const targetRoomView = Game.rooms[rooms.TARGET];
    const expansionRoomView = Game.rooms[rooms.EXPANSION];

    // --- EVOLUTION PROTOCOL (RCL-Based Dynamic Quotas) ---
    // Evaluiert JEDEN geclaimten Raum einzeln basierend auf seinem eigenen Controller-Level
    function getPhaseQuotas(level) {
        if (level <= 2) return { builder: 3, upgrader: 2, repairer: 0, hauler: 0, scav: 0 }; // Phase 1: Bootstrap
        if (level === 3) return { builder: 2, upgrader: 2, repairer: 1, hauler: 1, scav: 1 }; // Phase 2: Basic Infra
        return { builder: 1, upgrader: 2, repairer: 1, hauler: 2, scav: 2 }; // Phase 3: Empire
    }

    const homeRCL = homeRoom && homeRoom.controller ? homeRoom.controller.level : 1;
    const homePhase = getPhaseQuotas(homeRCL);
    let HOME_BUILDER_QUOTA = homePhase.builder;
    let HOME_UPGRADER_QUOTA = homePhase.upgrader;
    let HOME_REPAIRER_QUOTA = homePhase.repairer;
    roles.COUNTS.hauler = homePhase.hauler; // Global fallback basis
    roles.COUNTS.scavenger = homePhase.scav;

    // Wenn der Target-Raum uns gehört, berechnet er ab sofort seine eigenen autonomen Phasen!
    let targetPhase = { builder: 1, upgrader: 1, repairer: 2, hauler: 1 }; // SCOS Target Fallback
    if (targetRoomView && targetRoomView.controller && targetRoomView.controller.my) {
        targetPhase = getPhaseQuotas(targetRoomView.controller.level);
    }
    let TARGET_BUILDER_QUOTA = targetPhase.builder;
    let TARGET_UPGRADER_QUOTA = targetPhase.upgrader;
    let TARGET_REPAIRER_QUOTA = targetPhase.repairer;
    let TARGET_HAULER_QUOTA = targetPhase.hauler || 1;

    let MINING_BUILDER_QUOTA = 0;
    let MINING_UPGRADER_QUOTA = 0;
    let MINING_HAULER_QUOTA = 0;
    let MINING_REMOTE_MINER_QUOTA = 0;
    let MINING_CLAIMER_QUOTA = 0;
    let EXPANSION_MINER_QUOTA = 0;
    let EXPANSION_HAULER_QUOTA = 0;

    if (homeRCL >= 4) {
        MINING_BUILDER_QUOTA = 2;
        MINING_UPGRADER_QUOTA = 1;
        MINING_HAULER_QUOTA = 1;
        MINING_REMOTE_MINER_QUOTA = 2;
        MINING_CLAIMER_QUOTA = 1;
    }

    // --- DEFENSE STATUS (Home + Target) ---
    if (!Memory.defense) Memory.defense = {};
    
    const ALLIES = []; // Whitelist for passing players

    function getHostileCount(room) {
        if (!room) return 0;
        const creeps = room.find(FIND_HOSTILE_CREEPS, {
            filter: c =>
                !ALLIES.includes(c.owner.username) &&
                (c.getActiveBodyparts(ATTACK) > 0 ||
                c.getActiveBodyparts(RANGED_ATTACK) > 0 ||
                c.getActiveBodyparts(HEAL) > 0)
        }).length;
        const cores = room.find(FIND_HOSTILE_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_INVADER_CORE
        }).length;
        return creeps + cores;
    }

    const roomThreats = {
        [rooms.HOME]: getHostileCount(homeRoom),
        [rooms.TARGET]: getHostileCount(targetRoomView),
        [rooms.EXPANSION]: getHostileCount(expansionRoomView),
        [rooms.MINING]: getHostileCount(Game.rooms[rooms.MINING])
    };
    const homeThreat = roomThreats[rooms.HOME];
    const targetThreat = roomThreats[rooms.TARGET];
    const expansionThreat = roomThreats[rooms.EXPANSION];
    const hasLiveThreat = homeThreat > 0 || targetThreat > 0 || expansionThreat > 0;

    if (hasLiveThreat) {
        let urgentRoom = rooms.HOME;
        let urgentThreat = roomThreats[rooms.HOME] || 0;
        Object.keys(roomThreats).forEach(roomName => {
            const threat = roomThreats[roomName] || 0;
            if (threat > urgentThreat) {
                urgentThreat = threat;
                urgentRoom = roomName;
            }
        });
        urgentThreat = Math.max(1, urgentThreat);

        Memory.defense.activeUntil = Game.time + DEFENSE_COOLDOWN_TICKS;
        Memory.defense.targetRoom = urgentRoom;
        Memory.defense.need = Math.min(3, Math.max(1, urgentThreat)); // Skaliert bis max 3 Defender
        Memory.defense.healerNeed = urgentThreat >= 2 ? 1 : 0; // 1 Healer-Support ab 2+ Feinden
    }

    const defenseActive = Memory.defense.activeUntil && Game.time <= Memory.defense.activeUntil;
    const defenseTargetRoom = defenseActive ? (Memory.defense.targetRoom || rooms.TARGET) : null;
    const defenseNeed = defenseActive ? (Memory.defense.need || 1) : 0;
    const defenseHealerNeed = defenseActive ? (Memory.defense.healerNeed || 0) : 0;

    // --- PASS 1: CENSUS & SOURCE TRACKING ---
    const sourceAssignments = {};
    [homeRoom, targetRoomView, expansionRoomView].forEach(room => {
        if (room) room.find(FIND_SOURCES).forEach(s => sourceAssignments[s.id] = 0);
    });

    for (let name in Game.creeps) {
        const creep = Game.creeps[name];
        census[creep.memory.role]++;
        if (creep.memory.role === 'harvester' && creep.memory.targetSourceId) {
            sourceAssignments[creep.memory.targetSourceId] = (sourceAssignments[creep.memory.targetSourceId] || 0) + 1;
        }
        
        // Attack Detection
        if (creep.hits < (creep.memory.lastHits || creep.hitsMax)) {
            logger.log(`⚠️ ATTACK: ${creep.name} in ${creep.room.name}!`, 'error');
        }
        creep.memory.lastHits = creep.hits;

        // --- EXECUTION (Merged Pass) ---
        creep.memory.home = rooms.HOME;
        creep.memory.target = rooms.TARGET;

        // --- UNIVERSAL RECYCLE COMMAND ---
        if (creep.memory.recycle) {
            creep.say('♻️ Recycle');
            const spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS) || creep.pos.findClosestByRange(FIND_MY_SPAWNS);
            if (spawn) {
                if (spawn.recycleCreep(creep) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ff00ff' } });
                }
            }
            continue; // Skip normal role logic
        }

        // --- UNIVERSAL MEMORY PURGE: Scrub E57S55 completely ---
        let memoryPatched = false;
        for (let key in creep.memory) {
            if (creep.memory[key] === 'E57S55') {
                if (key === 'salvageRoom' || key === 'salvageId') {
                    creep.memory.salvageRoom = null;
                    creep.memory.salvageId = null;
                } else if (key === 'workRoom' || key === 'targetRoom') {
                    creep.memory[key] = rooms.MINING;
                } else if (key === 'homeRoom') {
                    creep.memory[key] = rooms.HOME;
                } else {
                    creep.memory[key] = null;
                }
                memoryPatched = true;
            }
        }
        if (memoryPatched) delete creep.memory._move; // Clear cached bad paths!

        // Migration guard: remote expansion haulers must always deliver to HOME.
        if (
            creep.memory.role === 'hauler' &&
            creep.memory.targetRoom === rooms.EXPANSION &&
            creep.memory.homeRoom !== rooms.HOME
        ) {
            creep.memory.homeRoom = rooms.HOME;
        }

        // QUARANTINE ZONE & SAFE CORRIDOR LOGIC
        // The pathfinder naturally tries to shortcut through E57S55. We must actively forbid it.
        if (creep.room.name === 'E57S55') {
            creep.say('🚨 EVAC');
            const evacExit = creep.pos.findClosestByRange(creep.room.findExitTo(rooms.MINING));
            if (evacExit) creep.moveTo(evacExit, { visualizePathStyle: { stroke: '#ff0000' } });
            continue; // Skip role execution to prevent Flee loops from breaking movement!
        }
        
        // Auto-fix Harvesters without source
        if (creep.memory.role === 'harvester') {
            if (creep.memory.targetSourceId && creep.memory.targetRoom) {
                const s = Game.getObjectById(creep.memory.targetSourceId);
                if (s && s.room.name !== creep.memory.targetRoom) {
                    creep.memory.targetSourceId = null; // Clear wrong-room source
                }
            }
            
            if (!creep.memory.targetSourceId && (!creep.memory.targetRoom || creep.room.name === creep.memory.targetRoom)) {
                if (creep.room) {
                    const sources = creep.room.find(FIND_SOURCES);
                    const best = _.sortBy(sources, s => sourceAssignments[s.id] || 0)[0];
                    if (best) {
                        creep.memory.targetSourceId = best.id;
                        sourceAssignments[best.id] = (sourceAssignments[best.id] || 0) + 1;
                    }
                }
            }
        }

        // --- CPU CIRCUIT BREAKER ---
        // Prevent hard CPU timeout crashes (Script execution timed out).
        if (Game.cpu.getUsed() > Game.cpu.tickLimit * 0.8) {
            creep.say('⏸️ CPU');
            continue; // Skip expensive role logic this tick, but keep the loop alive
        }

        if (modules[creep.memory.role]) {
            try { modules[creep.memory.role].run(creep); } catch (e) { }
        }
    }

    // --- PASS 3: INFRASTRUCTURE (TOWERS) ---
    [rooms.HOME, rooms.TARGET, rooms.EXPANSION, rooms.MINING].forEach(roomName => {
        const room = Game.rooms[roomName];
        if (room) {
            const towers = room.find(FIND_MY_STRUCTURES, {filter: {structureType: STRUCTURE_TOWER}});
            towers.forEach(t => {
                try { towerLogic.run(t); } catch (e) { logger.log('Tower Error: ' + e, 'error'); }
            });
        }
    });

    // --- PASS 4: SPAWNING (MULTI-SPAWN) ---
    let queuePreview = [];
    let roomAssignments = {};
    const spawnActions = [];
    const armyOn = (rooms.WAR_MODE === true);
    const targetRoom = rooms.TARGET;
    const expansionRoom = rooms.EXPANSION;
    const plannedSpawns = [];

    function countAssigned(role, roomName, memoryKey) {
        const live = _.filter(Game.creeps, c =>
            c.memory.role === role &&
            (c.memory[memoryKey] === roomName || (!c.memory[memoryKey] && c.room.name === roomName))
        ).length;
        const planned = _.filter(plannedSpawns, m =>
            m.role === role && m[memoryKey] === roomName
        ).length;
        return live + planned;
    }

    function countRole(role) {
        return (census[role] || 0) + _.filter(plannedSpawns, m => m.role === role).length;
    }

    function readNeeds() {
        const homeBuilders = countAssigned('builder', rooms.HOME, 'workRoom');
        const homeUpgraders = countAssigned('upgrader', rooms.HOME, 'targetRoom');
        const homeRepairers = countAssigned('repairer', rooms.HOME, 'workRoom');
        const targetBuilders = countAssigned('builder', targetRoom, 'workRoom');
        const targetRepairers = countAssigned('repairer', targetRoom, 'workRoom');
        const targetUpgraders = countAssigned('upgrader', targetRoom, 'targetRoom');
        const targetHaulers = countAssigned('hauler', targetRoom, 'workRoom');
        const miningBuilders = countAssigned('builder', rooms.MINING, 'workRoom');
        const miningUpgraders = countAssigned('upgrader', rooms.MINING, 'targetRoom');
        const miningHaulers = countAssigned('hauler', rooms.MINING, 'workRoom');
        const miningClaimers = countAssigned('claimer', rooms.MINING, 'targetRoom');
        const expansionRemoteMiners = countAssigned('remoteMiner', expansionRoom, 'targetRoom');
        const expansionHaulers = countAssigned('hauler', expansionRoom, 'targetRoom');
        const miningRemoteMiners = countAssigned('remoteMiner', rooms.MINING, 'targetRoom');
        const defenseDefenders = defenseTargetRoom ? countAssigned('defender', defenseTargetRoom, 'targetRoom') : 0;
        const defenseHealers = defenseTargetRoom ? countAssigned('healer', defenseTargetRoom, 'targetRoom') : 0;
        const miningController = Game.rooms[rooms.MINING] && Game.rooms[rooms.MINING].controller;
        const shouldReserveMining = !miningController || !miningController.my;
        return {
            homeBuilders,
            homeUpgraders,
            homeRepairers,
            targetBuilders,
            targetRepairers,
            targetUpgraders,
            targetHaulers,
            miningBuilders,
            miningUpgraders,
            miningHaulers,
            miningClaimers,
            expansionRemoteMiners,
            expansionHaulers,
            miningRemoteMiners,
            defenseDefenders,
            defenseHealers,
            shouldReserveMining
        };
    }

    function bodyCost(body) {
        return _.sum(body, part => BODYPART_COST[part] || 0);
    }

    const fallbackBodies = {
        defender: [TOUGH, MOVE, ATTACK, MOVE],
        hauler: [CARRY, CARRY, MOVE],
        scavenger: [CARRY, MOVE],
        repairer: [WORK, CARRY, MOVE],
        builder: [WORK, CARRY, MOVE],
        upgrader: [WORK, CARRY, MOVE],
        remoteMiner: [WORK, CARRY, MOVE],
        harvester: [WORK, CARRY, MOVE],
        claimer: [CLAIM, MOVE],
        healer: [MOVE, HEAL],
        mineralMiner: [WORK, CARRY, MOVE]
    };

    function resolveSpawnBody(spawn, role) {
        const full = roles.BODIES[role];
        if (!full) return null;
        if (bodyCost(full) <= spawn.room.energyAvailable) return full;

        const fallback = fallbackBodies[role];
        if (fallback && bodyCost(fallback) <= spawn.room.energyAvailable) return fallback;

        return null;
    }

    const baseNeeds = readNeeds();

    const baseRooms = Object.values(Game.rooms).filter(room => room.find(FIND_MY_SPAWNS).length > 0);
    const dynamicMinerQueue = [];
    baseRooms.forEach(room => {
        const sourcesCount = room.find(FIND_SOURCES).length;
        const requiredMiners = sourcesCount * 2;
        const currentMiners = countAssigned('harvester', room.name, 'targetRoom');
        dynamicMinerQueue.push({
            room: room.name,
            current: currentMiners,
            required: requiredMiners
        });
    });

    const dynamicMineralQueue = [];
    baseRooms.forEach(room => {
        if (room.controller && room.controller.level >= 6) {
            const mineral = room.find(FIND_MINERALS)[0];
            if (mineral && mineral.amount > 0) {
                const hasExtractor = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_EXTRACTOR }).length > 0;
                if (hasExtractor) {
                    const currentMiners = countAssigned('mineralMiner', room.name, 'workRoom');
                    dynamicMineralQueue.push({ room: room.name, current: currentMiners, required: 1 });
                }
            }
        }
    });

    roomAssignments = { // Re-assigning to roomAssignments directly, it's better to do it once
        homeBuilders: baseNeeds.homeBuilders,
        homeBuilderNeed: HOME_BUILDER_QUOTA,
            homeUpgraders: baseNeeds.homeUpgraders,
            homeUpgraderNeed: HOME_UPGRADER_QUOTA,
        homeRepairers: baseNeeds.homeRepairers,
        homeRepairerNeed: HOME_REPAIRER_QUOTA,
        targetBuilders: baseNeeds.targetBuilders,
        targetRepairers: baseNeeds.targetRepairers,
        targetUpgraders: baseNeeds.targetUpgraders,
        targetUpgraderNeed: TARGET_UPGRADER_QUOTA, // This was just a typo fix, it's correct now.
        targetHaulers: baseNeeds.targetHaulers,
        miningBuilders: baseNeeds.miningBuilders,
        miningUpgraders: baseNeeds.miningUpgraders,
        miningHaulers: baseNeeds.miningHaulers,
        miningClaimers: baseNeeds.miningClaimers,
        expansionRemoteMiners: baseNeeds.expansionRemoteMiners,
        expansionHaulers: baseNeeds.expansionHaulers,
        miningRemoteMiners: baseNeeds.miningRemoteMiners,
        defenseDefenders: baseNeeds.defenseDefenders,
        defenseHealers: baseNeeds.defenseHealers,
        dynamicMiners: dynamicMinerQueue,
        dynamicMineralMiners: dynamicMineralQueue
    };

    function addQueueEntry(ok, label, have, need) {
        if (!ok) queuePreview.push(`${label}:${have}/${need}`);
    }

    // --- VISUAL QUEUE DISPLAY (Must match priority ladder below) ---
    dynamicMinerQueue.forEach(q => {
        addQueueEntry(q.current >= Math.min(2, q.required), `harv.min@${q.room}`, q.current, Math.min(2, q.required));
    });
    if (defenseActive) {
        addQueueEntry(baseNeeds.defenseDefenders >= defenseNeed, `defender@${defenseTargetRoom}`, baseNeeds.defenseDefenders, defenseNeed);
        if (defenseHealerNeed > 0) {
            addQueueEntry(baseNeeds.defenseHealers >= defenseHealerNeed, `healer@${defenseTargetRoom}`, baseNeeds.defenseHealers, defenseHealerNeed);
        }
    }
    dynamicMinerQueue.forEach(q => {
        addQueueEntry(q.current >= q.required, `harv.full@${q.room}`, q.current, q.required);
    });
    addQueueEntry(baseNeeds.homeBuilders >= HOME_BUILDER_QUOTA, `builder@${rooms.HOME}`, baseNeeds.homeBuilders, HOME_BUILDER_QUOTA);
    addQueueEntry(baseNeeds.homeUpgraders >= HOME_UPGRADER_QUOTA, `upgrader@${rooms.HOME}`, baseNeeds.homeUpgraders, HOME_UPGRADER_QUOTA);
    addQueueEntry(baseNeeds.targetBuilders >= TARGET_BUILDER_QUOTA, `builder@${targetRoom}`, baseNeeds.targetBuilders, TARGET_BUILDER_QUOTA);
    addQueueEntry(baseNeeds.miningBuilders >= MINING_BUILDER_QUOTA, `builder@${rooms.MINING}`, baseNeeds.miningBuilders, MINING_BUILDER_QUOTA);
    addQueueEntry(baseNeeds.targetUpgraders >= TARGET_UPGRADER_QUOTA, `upgrader@${targetRoom}`, baseNeeds.targetUpgraders, TARGET_UPGRADER_QUOTA);
    addQueueEntry(baseNeeds.miningUpgraders >= MINING_UPGRADER_QUOTA, `upgrader@${rooms.MINING}`, baseNeeds.miningUpgraders, MINING_UPGRADER_QUOTA);
    addQueueEntry(countRole('hauler') >= roles.COUNTS.hauler, 'hauler', countRole('hauler'), roles.COUNTS.hauler);
    addQueueEntry(baseNeeds.targetHaulers >= TARGET_HAULER_QUOTA, `hauler@${targetRoom}`, baseNeeds.targetHaulers, TARGET_HAULER_QUOTA);
    addQueueEntry(baseNeeds.miningHaulers >= MINING_HAULER_QUOTA, `hauler@${rooms.MINING}`, baseNeeds.miningHaulers, MINING_HAULER_QUOTA);
    addQueueEntry(baseNeeds.expansionHaulers >= EXPANSION_HAULER_QUOTA, `hauler@${expansionRoom}`, baseNeeds.expansionHaulers, EXPANSION_HAULER_QUOTA);
    addQueueEntry(countRole('scavenger') >= roles.COUNTS.scavenger, 'scavenger', countRole('scavenger'), roles.COUNTS.scavenger);
    addQueueEntry(baseNeeds.homeRepairers >= HOME_REPAIRER_QUOTA, `repairer@${rooms.HOME}`, baseNeeds.homeRepairers, HOME_REPAIRER_QUOTA);
    addQueueEntry(baseNeeds.targetRepairers >= TARGET_REPAIRER_QUOTA, `repairer@${targetRoom}`, baseNeeds.targetRepairers, TARGET_REPAIRER_QUOTA);
    if (baseNeeds.shouldReserveMining && MINING_CLAIMER_QUOTA > 0) {
        addQueueEntry(baseNeeds.miningClaimers >= MINING_CLAIMER_QUOTA, `claimer@${rooms.MINING}`, baseNeeds.miningClaimers, MINING_CLAIMER_QUOTA);
    }
    addQueueEntry(baseNeeds.expansionRemoteMiners >= EXPANSION_MINER_QUOTA, `remoteMiner@${expansionRoom}`, baseNeeds.expansionRemoteMiners, EXPANSION_MINER_QUOTA);
    addQueueEntry(baseNeeds.miningRemoteMiners >= MINING_REMOTE_MINER_QUOTA, `remoteMiner@${rooms.MINING}`, baseNeeds.miningRemoteMiners, MINING_REMOTE_MINER_QUOTA);
    dynamicMineralQueue.forEach(q => {
        addQueueEntry(q.current >= q.required, `min.miner@${q.room}`, q.current, q.required);
    });
    if (armyOn) {
        addQueueEntry(countRole('vanguard') >= roles.COUNTS.vanguard, 'vanguard', countRole('vanguard'), roles.COUNTS.vanguard);
        addQueueEntry(countRole('medic') >= roles.COUNTS.medic, 'medic', countRole('medic'), roles.COUNTS.medic);
    }
    addQueueEntry(countRole('remoteMiner') >= roles.COUNTS.remoteMiner, 'remoteMiner', countRole('remoteMiner'), roles.COUNTS.remoteMiner);
    addQueueEntry(countRole('builder') >= roles.COUNTS.builder, 'builder', countRole('builder'), roles.COUNTS.builder);
    addQueueEntry(countRole('claimer') >= roles.COUNTS.claimer, 'claimer', countRole('claimer'), roles.COUNTS.claimer);
    addQueueEntry(countRole('upgrader') >= roles.COUNTS.upgrader, 'upgrader', countRole('upgrader'), roles.COUNTS.upgrader);

    const idleSpawns = allSpawns.filter(s => !s.spawning);
    if (idleSpawns.length === 0 && allSpawns.length > 0) queuePreview = ['spawn busy'];

    // --- FAILSAFE: GLOBAL POPULATION CAP ---
    const HARD_POP_CAP = 60;
    if (Object.keys(Game.creeps).length >= HARD_POP_CAP) {
        queuePreview = [`POP CAP (${HARD_POP_CAP})`];
        idleSpawns.length = 0; // Force-abort all spawn logic this tick
        if (Game.time % 20 === 0) logger.log(`🛑 Global Population Cap (${HARD_POP_CAP}) reached! Spawning halted to prevent Quota Leaks.`, 'error');
    }

    for (const spawn of idleSpawns) {
        let sRole = null;
        let spawnMemory = null;

            const minHarvesterDeficit = dynamicMinerQueue.find(q => q.current < Math.min(2, q.required));
            const fullHarvesterDeficit = dynamicMinerQueue.find(q => q.current < q.required);
            const mineralDeficit = dynamicMineralQueue.find(q => q.current < q.required);

    // --- STRICT SPAWN PRIORITY LADDER ---
    if (minHarvesterDeficit) sRole = 'harvester';
    else if (defenseActive && baseNeeds.defenseDefenders < defenseNeed) sRole = 'defender';
    else if (defenseActive && baseNeeds.defenseHealers < defenseHealerNeed) sRole = 'healer';
    else if (fullHarvesterDeficit) sRole = 'harvester';
    else if (baseNeeds.homeBuilders < HOME_BUILDER_QUOTA) sRole = 'builder';
    else if (baseNeeds.homeUpgraders < HOME_UPGRADER_QUOTA) sRole = 'upgrader';
    else if (baseNeeds.targetBuilders < TARGET_BUILDER_QUOTA) sRole = 'builder';
    else if (baseNeeds.miningBuilders < MINING_BUILDER_QUOTA) sRole = 'builder';
    else if (baseNeeds.targetUpgraders < TARGET_UPGRADER_QUOTA) sRole = 'upgrader';
    else if (baseNeeds.miningUpgraders < MINING_UPGRADER_QUOTA) sRole = 'upgrader';
    else if (countRole('hauler') < roles.COUNTS.hauler) sRole = 'hauler';
    else if (baseNeeds.targetHaulers < TARGET_HAULER_QUOTA) sRole = 'hauler';
    else if (baseNeeds.miningHaulers < MINING_HAULER_QUOTA) sRole = 'hauler';
    else if (baseNeeds.expansionHaulers < EXPANSION_HAULER_QUOTA) sRole = 'hauler';
    else if (countRole('scavenger') < roles.COUNTS.scavenger) sRole = 'scavenger';
    else if (baseNeeds.homeRepairers < HOME_REPAIRER_QUOTA) sRole = 'repairer';
    else if (baseNeeds.targetRepairers < TARGET_REPAIRER_QUOTA) sRole = 'repairer';
    else if (baseNeeds.shouldReserveMining && baseNeeds.miningClaimers < MINING_CLAIMER_QUOTA) sRole = 'claimer';
    else if (baseNeeds.expansionRemoteMiners < EXPANSION_MINER_QUOTA) sRole = 'remoteMiner';
    else if (baseNeeds.miningRemoteMiners < MINING_REMOTE_MINER_QUOTA) sRole = 'remoteMiner';
    else if (mineralDeficit) sRole = 'mineralMiner';
    else if (armyOn && countRole('vanguard') < roles.COUNTS.vanguard) sRole = 'vanguard';
    else if (armyOn && countRole('medic') < roles.COUNTS.medic) sRole = 'medic';
    else if (countRole('remoteMiner') < roles.COUNTS.remoteMiner) sRole = 'remoteMiner';
    else if (countRole('builder') < roles.COUNTS.builder) sRole = 'builder';
    else if (countRole('claimer') < roles.COUNTS.claimer) sRole = 'claimer';
    else if (countRole('upgrader') < roles.COUNTS.upgrader) sRole = 'upgrader';

        if (!sRole) continue;

        const name = roles.generateName(sRole);
        spawnMemory = { role: sRole };

            if (sRole === 'harvester') {
                if (minHarvesterDeficit) {
                    spawnMemory.targetRoom = minHarvesterDeficit.room;
                } else if (fullHarvesterDeficit) {
                    spawnMemory.targetRoom = fullHarvesterDeficit.room;
                }
            }

        if (sRole === 'builder' && baseNeeds.homeBuilders < HOME_BUILDER_QUOTA) {
            spawnMemory.workRoom = rooms.HOME;
        } else if (sRole === 'builder' && baseNeeds.targetBuilders < TARGET_BUILDER_QUOTA) {
            spawnMemory.workRoom = targetRoom;
        } else if (sRole === 'builder' && baseNeeds.miningBuilders < MINING_BUILDER_QUOTA) {
            spawnMemory.workRoom = rooms.MINING;
        }

        if (sRole === 'repairer' && baseNeeds.homeRepairers < HOME_REPAIRER_QUOTA) {
            spawnMemory.workRoom = rooms.HOME;
        } else if (sRole === 'repairer' && baseNeeds.targetRepairers < TARGET_REPAIRER_QUOTA) {
            spawnMemory.workRoom = targetRoom;
        }

        if (sRole === 'hauler') {
            if (countRole('hauler') < roles.COUNTS.hauler) {
                // This is a home hauler, no extra memory needed, it will default to workRoom=HOME
            } else if (baseNeeds.targetHaulers < TARGET_HAULER_QUOTA) {
                spawnMemory.workRoom = targetRoom;
        } else if (baseNeeds.miningHaulers < MINING_HAULER_QUOTA) {
            spawnMemory.workRoom = rooms.MINING;
            } else if (baseNeeds.expansionHaulers < EXPANSION_HAULER_QUOTA) {
                spawnMemory.targetRoom = expansionRoom;
                spawnMemory.homeRoom = rooms.HOME;
            }
        }

        if (sRole === 'defender' && defenseActive && baseNeeds.defenseDefenders < defenseNeed) {
            spawnMemory.targetRoom = defenseTargetRoom;
            spawnMemory.homeRoom = rooms.HOME;
        }

        if (sRole === 'healer' && defenseActive && baseNeeds.defenseHealers < defenseHealerNeed) {
            spawnMemory.targetRoom = defenseTargetRoom;
            spawnMemory.homeRoom = rooms.HOME;
        }

        if (sRole === 'mineralMiner' && mineralDeficit) {
            spawnMemory.workRoom = mineralDeficit.room;
        }

        if (sRole === 'upgrader' && baseNeeds.homeUpgraders < HOME_UPGRADER_QUOTA) {
            spawnMemory.targetRoom = rooms.HOME;
        } else if (sRole === 'upgrader' && baseNeeds.targetUpgraders < TARGET_UPGRADER_QUOTA) {
            spawnMemory.targetRoom = targetRoom;
        } else if (sRole === 'upgrader' && baseNeeds.miningUpgraders < MINING_UPGRADER_QUOTA) {
            spawnMemory.targetRoom = rooms.MINING;
        }

        if (sRole === 'claimer' && baseNeeds.shouldReserveMining && baseNeeds.miningClaimers < MINING_CLAIMER_QUOTA) {
            spawnMemory.targetRoom = rooms.MINING;
            spawnMemory.claimMode = 'claim';
        }

        if (sRole === 'remoteMiner') {
                if (baseNeeds.expansionRemoteMiners < EXPANSION_MINER_QUOTA) {
                spawnMemory.targetRoom = expansionRoom;
                spawnMemory.homeRoom = rooms.HOME;
            } else if (baseNeeds.miningRemoteMiners < MINING_REMOTE_MINER_QUOTA) {
                spawnMemory.targetRoom = rooms.MINING;
                spawnMemory.homeRoom = rooms.HOME;
            }
        }

        const body = resolveSpawnBody(spawn, sRole);
        if (!body) {
            continue;
        }

        const spawnRes = spawn.spawnCreep(body, name, { memory: spawnMemory });
        if (spawnRes === OK) {
            plannedSpawns.push(spawnMemory);
                if (spawnMemory.role === 'harvester') {
                    const qEntry = dynamicMinerQueue.find(q => q.room === spawnMemory.targetRoom);
                    if (qEntry) qEntry.current++;
                }
            spawnActions.push(`${spawn.name}:${sRole}[${body.length}]->${spawnMemory.targetRoom || spawnMemory.workRoom || spawn.room.name}`);
            logger.log(`🐣 ${spawn.name} spawning: ${name}`, 'success');
        } else {
            logger.log(`${spawn.name} blocked: role=${sRole} code=${spawnRes}`, 'warn');
        }
    }

    logger.report({
        energy: homeRoom ? homeRoom.energyAvailable : 0,
        cap: homeRoom ? homeRoom.energyCapacityAvailable : 0,
        census: census,
        rooms: {
            home: rooms.HOME,
            target: rooms.TARGET,
            expansion: rooms.EXPANSION
        },
        assignments: roomAssignments,
        spawn: allSpawns.length ? {
            total: allSpawns.length,
            busy: allSpawns.filter(s => s.spawning).length,
            actions: spawnActions
        } : null,
        defense: {
            active: !!defenseActive,
            room: defenseTargetRoom,
            need: defenseNeed,
            current: defenseTargetRoom ? _.filter(Game.creeps, c => c.memory.role === 'defender' && c.memory.targetRoom === defenseTargetRoom).length : 0,
            healerNeed: defenseHealerNeed,
            currentHealers: defenseTargetRoom ? _.filter(Game.creeps, c => c.memory.role === 'healer' && c.memory.targetRoom === defenseTargetRoom).length : 0,
            homeThreat: homeThreat,
            targetThreat: targetThreat,
            expansionThreat: expansionThreat
        },
        queue: queuePreview
    });

    // --- PASS 5: AUDIT SNAPSHOTS (Tactical + Strategic) ---
    function getBufferedEnergy(room) {
        if (!room) return 0;
        return _.sum(
            room.find(FIND_STRUCTURES, {
                filter: s =>
                    s.store &&
                    (s.structureType === STRUCTURE_STORAGE ||
                        s.structureType === STRUCTURE_CONTAINER ||
                        s.structureType === STRUCTURE_LINK)
            }),
            s => s.store[RESOURCE_ENERGY] || 0
        );
    }

    function getLowRampartCount(room, floor) {
        if (!room) return 0;
        return room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_RAMPART && s.hits < floor
        }).length;
    }

    function buildAuditSnapshot(tick) {
        const trackedRooms = [rooms.HOME, rooms.TARGET, rooms.EXPANSION];
        const roomSnapshots = trackedRooms.map(roomName => {
            const room = Game.rooms[roomName];
            const creepsInRoom = _.filter(Game.creeps, c => c.room.name === roomName);
            const rolePop = _.countBy(creepsInRoom, c => c.memory.role || 'unknown');
            return {
                name: roomName,
                visible: !!room,
                energyAvailable: room ? room.energyAvailable : 0,
                energyCapacity: room ? room.energyCapacityAvailable : 0,
                bufferedEnergy: getBufferedEnergy(room),
                hostiles: roomThreats[roomName] || 0,
                lowRamparts: getLowRampartCount(room, 50000),
                rolePopulation: rolePop
            };
        });

        return {
            tick: tick,
            totalBufferedEnergy: _.sum(roomSnapshots, r => r.bufferedEnergy || 0),
            totalHostiles: _.sum(roomSnapshots, r => r.hostiles || 0),
            spawnBusy: _.filter(allSpawns, s => s.spawning).length,
            spawnTotal: allSpawns.length,
            population: Object.keys(Game.creeps).length,
            rooms: roomSnapshots
        };
    }

    if (!Memory.audit) Memory.audit = {};
    if (!Memory.audit.tactical) Memory.audit.tactical = [];
    if (!Memory.audit.strategic) Memory.audit.strategic = [];

    if (Game.time % TACTICAL_AUDIT_INTERVAL === 0) {
        const tacticalSnapshot = buildAuditSnapshot(Game.time);
        Memory.audit.tactical.push(tacticalSnapshot);
        if (Memory.audit.tactical.length > AUDIT_RETENTION_TACTICAL) {
            Memory.audit.tactical = Memory.audit.tactical.slice(-AUDIT_RETENTION_TACTICAL);
        }
        logger.auditTactical(tacticalSnapshot);
    }

    if (Game.time % STRATEGIC_AUDIT_INTERVAL === 0) {
        const strategicSnapshot = buildAuditSnapshot(Game.time);
        Memory.audit.strategic.push(strategicSnapshot);
        if (Memory.audit.strategic.length > AUDIT_RETENTION_STRATEGIC) {
            Memory.audit.strategic = Memory.audit.strategic.slice(-AUDIT_RETENTION_STRATEGIC);
        }
        logger.auditStrategic(strategicSnapshot);
    }

    // --- PASS 6: PIXEL GENERATION (Market/CPU) ---
    if (Game.cpu.bucket === 10000 && Game.cpu.generatePixel) {
        Game.cpu.generatePixel();
        logger.log('💎 Pixel generated! (10,000 Bucket converted)', 'success');
    }

    // --- PASS 7: AUTOMATED BASE PLANNING ---
    // Run very infrequently to save CPU, e.g., every 1000 ticks.
    if (Game.time % 1000 === 0) {
        Object.values(Game.rooms)
            .filter(r => r.controller && r.controller.my)
            .forEach(r => planner.run(r));
    }
};
