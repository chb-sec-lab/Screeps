/**
 * main.js - SCOS Kernel
 * Role: Orchestrator / Spawn Policy / Defense Escalation / Audit Snapshots
 */
const rooms = require('config.rooms');
const roles = require('config.roles');
const logger = require('utils.logger');
const towerLogic = require('structure.tower');
const planner = require('utils.planner');
const inventory = require('utils.inventory');
const market = require('utils.market');
const expander = require('utils.expansion');
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

    const creep = this;

    opts.roomCallback = function(roomName) {
        if (rooms.BLACKLIST && rooms.BLACKLIST.includes(roomName)) {
            return false; // ⛔ Weist den PathFinder an, diesen Raum komplett zu ignorieren
        }

        // Scout-spezifische Feind-Vermeidung (Routing um Feindbasen herum)
        if (creep.memory && creep.memory.role === 'scout' && roomName !== creep.room.name) {
            const rData = Memory.inventory && Memory.inventory.rooms ? Memory.inventory.rooms[roomName] : null;
            if (rData) {
                if (rData.dangerUntil && Game.time < rData.dangerUntil) return false; // Raum ist temporär gesperrt
                if (rData.hostileTowers > 0 && !rData.my) return false; // Feindliche Base! Umweg berechnen.
            }
        }

        if (userCallback) {
            return userCallback(roomName);
        }
        return undefined;
    };
    
    return originalMoveTo.call(this, target, opts);
};

let modules = {};
const roleNames = ['harvester', 'hauler', 'scavenger', 'repairer', 'defender', 'vanguard', 'medic', 'breacher', 'remoteMiner', 'builder', 'claimer', 'upgrader', 'healer', 'mineralMiner', 'scout'];

roleNames.forEach(name => {
    try { modules[name] = require('role.' + name); } catch (e) { /* Safe Load */ }
});

// --- GLOBAL CONSOLE COMMANDS ---
global.intel = function() {
    if (!Memory.inventory || !Memory.inventory.rooms) return "Keine Inventar-Daten gefunden.";
    let intel = Memory.inventory.rooms;
    let out = ["\n<span style='color:#53d2b7; font-weight:bold;'>--- SCOS SCOUT INTEL ---</span>"];
    Object.keys(intel).forEach(r => {
        let d = intel[r];
        let owner = d.my ? 'ME' : (d.reservation || 'None');
        let danger = '';
        if (d.dangerUntil && Game.time < d.dangerUntil) {
            danger = ` | <span style='color:#ff4d4d; font-weight:bold;'>⚠️ DANGER (${d.dangerUntil - Game.time}t)</span>`;
        } else if (d.hostileTowers > 0 && !d.my) {
            danger = ` | <span style='color:#ffaa00; font-weight:bold;'>🏰 ENEMY BASE</span>`;
        }
        out.push(`<span style='color:#9db0c6'>🌍 [${r}]</span> | 👑 Owner: <span style='color:#ffb766'>${owner}</span> | ⚡ Src: ${d.sources} | 💎 Min: ${d.mineralAmount} | ⏱️ Scan: ${Game.time - d.lastUpdated}t ago${danger}`);
    });
    console.log(out.join('\n'));
    return "Intel report generated.";
};

module.exports.loop = function () {
    // --- AUTO-EXPANSION TARGET OVERRIDE ---
    if (Memory.empire && Memory.empire.targetRoom) {
        rooms.TARGET = Memory.empire.targetRoom;
    }

    for (let name in Memory.creeps) if (!Game.creeps[name]) delete Memory.creeps[name];

    // --- INVENTORY SCAN ---
    inventory.run();

    const census = {};
    roleNames.forEach(r => census[r] = 0);
    const homeRoom = Game.rooms[rooms.HOME];
    const allSpawns = Object.values(Game.spawns);

    // --- ACTIVE REGISTRY (Topology) ---
    // FIX: 'var' erzwingt das Hoisting der Variable. Verhindert ReferenceErrors, falls Codeblöcke de-synchronisiert wurden.
    var activeRegistry = {}; 
    if (rooms.registry) {
        for (let rn in rooms.registry) activeRegistry[rn] = rooms.registry[rn];
    }
    if (Memory.inventory && Memory.inventory.rooms) {
        Object.keys(Memory.inventory.rooms).forEach(rn => {
            if (Memory.inventory.rooms[rn].my && !activeRegistry[rn]) activeRegistry[rn] = { type: 'CORE' };
        });
    }
    if (Memory.empire && Memory.empire.targetRoom && !activeRegistry[Memory.empire.targetRoom]) {
        activeRegistry[Memory.empire.targetRoom] = { type: 'CORE' };
    }

    // --- EVOLUTION PROTOCOL (RCL-Based Dynamic Quotas) ---
    // JIT (Just-In-Time) Bedarfssteuerung: Evaluiert JEDEN geclaimten Raum einzeln basierend auf RCL UND tatsächlichem Bedarf
    function getPhaseQuotas(level, invData) {
        if (!invData) return { builder: 0, upgrader: 0, repairer: 0, hauler: 0, scav: 0 };
        const sites = invData.constructionSites;
        const drops = invData.droppedEnergy;
        
        let b = 0, u = 0, r = 0, h = 0, s = 0;
        
        if (level <= 2) {
            const noSpawn = invData.spawns === 0;
            b = sites > 0 ? (sites > 5 ? 3 : 2) : (noSpawn ? 1 : 0); // AUTO-VISION: 1 Pionier geht vor um den Raum aufzudecken, falls der Planner noch nicht lief!
            u = sites > 0 ? 0 : (!noSpawn ? 2 : 0); // JIT: Upgrader erst, wenn der Spawn steht.
        } else if (level === 3) {
            b = sites > 0 ? (sites > 5 ? 3 : 2) : 0; // JIT: 0 Builder wenn nichts zu bauen ist!
            u = sites > 0 ? 1 : 3; // JIT: Arbeiter werden zu Upgradern umgeschichtet
            r = 1; h = 1;
            s = drops > 1 ? 1 : 0; // JIT: Scavenger nur bei tatsächlichem Müll
        } else {
            b = sites > 0 ? (sites > 5 ? 3 : 2) : 0; 
            u = sites > 0 ? 1 : 3; 
            r = 1; h = 2;
            s = drops > 1 ? 1 : 0; 
        }
        return { builder: b, upgrader: u, repairer: r, hauler: h, scav: s };
    }

    const homeRCL = homeRoom && homeRoom.controller ? homeRoom.controller.level : 1;
    const homePhase = getPhaseQuotas(homeRCL, homeRoom);
    let HOME_BUILDER_QUOTA = homePhase.builder;
    let HOME_UPGRADER_QUOTA = homePhase.upgrader;
    let HOME_REPAIRER_QUOTA = homePhase.repairer;
    roles.COUNTS.hauler = homePhase.hauler; // Global fallback basis
    roles.COUNTS.scavenger = homePhase.scav;

    // --- GCL AWARENESS ---
    const ownedRooms = Object.values(Game.rooms).filter(r => r.controller && r.controller.my).length;
    const canClaimMore = ownedRooms < Game.gcl.level;

    // Wenn der Target-Raum uns gehört, berechnet er ab sofort seine eigenen autonomen Phasen!
    const targetInv = Memory.inventory && Memory.inventory.rooms ? Memory.inventory.rooms[rooms.TARGET] : null;
    let targetPhase = { builder: 0, upgrader: 0, repairer: 0, hauler: 0 };
    let TARGET_CLAIMER_QUOTA = 0;
    let TARGET_REMOTE_MINER_QUOTA = 0;
    let TARGET_REMOTE_HAULER_QUOTA = 0;

    if (targetInv && targetInv.my) {
        targetPhase = getPhaseQuotas(targetInv.rcl, targetInv);
    } else if (homeRCL >= 3) {
        TARGET_CLAIMER_QUOTA = 1; // Claim oder Reserve
        if (canClaimMore) {
            targetPhase = targetInv ? getPhaseQuotas(0, targetInv) : { builder: 1, upgrader: 0, repairer: 0, hauler: 0 }; 
        } else {
            TARGET_REMOTE_MINER_QUOTA = targetInv ? targetInv.sources * 2 : 2; // GCL-MAX FALLBACK: Nutze Target temporär als Remote Mine!
            TARGET_REMOTE_HAULER_QUOTA = targetInv ? targetInv.sources : 1;
        }
    }
    let TARGET_BUILDER_QUOTA = targetPhase.builder;
    let TARGET_UPGRADER_QUOTA = targetPhase.upgrader;
    let TARGET_REPAIRER_QUOTA = targetPhase.repairer;
    let TARGET_HAULER_QUOTA = targetPhase.hauler;

    let MINING_BUILDER_QUOTA = 0;
    let MINING_UPGRADER_QUOTA = 0;
    let MINING_HAULER_QUOTA = 0;
    let MINING_REMOTE_MINER_QUOTA = 0;
    let MINING_CLAIMER_QUOTA = 0;
    let EXPANSION_MINER_QUOTA = 0;
    let EXPANSION_HAULER_QUOTA = 0;

    // --- EXPANSION AS BASE (W8N8) ---
    // FIX: Wenn W8N8 geclaimt ist, wird es IMMER als Basis versorgt, auch wenn der Spawn noch fehlt!
    const expansionInv = Memory.inventory && Memory.inventory.rooms ? Memory.inventory.rooms[rooms.EXPANSION] : null;
    let expansionPhase = { builder: 0, upgrader: 0, repairer: 0, hauler: 0 };
    if (expansionInv && expansionInv.my) {
        expansionPhase = getPhaseQuotas(expansionInv.rcl, expansionInv);
    }
    let EXPANSION_BUILDER_QUOTA = expansionPhase.builder;
    let EXPANSION_UPGRADER_QUOTA = expansionPhase.upgrader;
    let EXPANSION_REPAIRER_QUOTA = expansionPhase.repairer;
    if (expansionPhase.hauler > 0) EXPANSION_HAULER_QUOTA = expansionPhase.hauler;

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
        [rooms.TARGET]: getHostileCount(Game.rooms[rooms.TARGET]),
        [rooms.EXPANSION]: getHostileCount(Game.rooms[rooms.EXPANSION]),
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
    [homeRoom, Game.rooms[rooms.TARGET], Game.rooms[rooms.EXPANSION]].forEach(room => {
        if (room) room.find(FIND_SOURCES).forEach(s => sourceAssignments[s.id] = 0);
    });

    for (let name in Game.creeps) {
        const creep = Game.creeps[name];
        census[creep.memory.role]++;
        if (creep.memory.role === 'harvester' && creep.memory.targetSourceId) {
            sourceAssignments[creep.memory.targetSourceId] = (sourceAssignments[creep.memory.targetSourceId] || 0) + 1;
        }
        
        if (creep.hits < (creep.memory.lastHits || creep.hitsMax)) logger.log(`⚠️ ATTACK: ${creep.name} in ${creep.room.name}!`, 'error');
        creep.memory.lastHits = creep.hits;

        // --- AUTO-RECYCLE OBSOLETE DEFENSE ---
        if (creep.memory.role === 'defender' || creep.memory.role === 'healer') {
            if (!defenseActive) {
                creep.memory.recycle = true;
            } else if (creep.memory.recycle) {
                creep.memory.recycle = false; // Alarm ist zurück! Abmarsch abbrechen.
            }
        }

        // --- UNIVERSAL RECYCLE COMMAND ---
        if (creep.memory.recycle) {
            creep.say('Recycle');

            // --- DUMP RESOURCES BEFORE RECYCLING ---
            if (creep.store.getUsedCapacity() > 0) {
                const resType = Object.keys(creep.store)[0]; // Energie oder Mineralien
                let sink = creep.room.storage;
                if (!sink || sink.store.getFreeCapacity(resType) === 0) {
                    sink = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                        filter: s => (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_CONTAINER) &&
                                     s.store && s.store.getFreeCapacity(resType) > 0
                    });
                }
                if (sink) {
                    if (creep.transfer(sink, resType) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(sink, { visualizePathStyle: { stroke: '#00ffcc' } });
                    }
                    continue; 
                }
            }

            let spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS) || creep.pos.findClosestByRange(FIND_MY_SPAWNS) || Object.values(Game.spawns)[0];
            if (spawn) {
                if (creep.room.name !== spawn.room.name) {
                    creep.moveTo(new RoomPosition(25, 25, spawn.room.name), { visualizePathStyle: { stroke: '#ff00ff' }, reusePath: 50 });
                } else if (spawn.recycleCreep(creep) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ff00ff' } });
                }
            }
            continue; 
        }

        // --- UNIVERSAL MEMORY PURGE & ORPHAN MIGRATION ---
        let memoryPatched = false;
        for (let key in creep.memory) {
            if (['E57S55', 'E57S56', 'E58S55', 'E58S56', 'W8N8'].includes(creep.memory[key])) { // Clean up old hardcodes
                if (!activeRegistry[creep.memory[key]]) {
                    creep.memory[key] = Memory.empire && Memory.empire.targetRoom ? Memory.empire.targetRoom : rooms.HOME;
                    memoryPatched = true;
                }
            }
        }
        if (memoryPatched) delete creep.memory._move;

        // QUARANTINE ZONE & SAFE CORRIDOR LOGIC
        // The pathfinder naturally tries to shortcut through E57S55. We must actively forbid it.
        if (creep.room.name === 'E57S55') {
            creep.say('EVAC');
            const evacExit = creep.pos.findClosestByRange(creep.room.findExitTo(rooms.MINING));
            if (evacExit) creep.moveTo(evacExit, { visualizePathStyle: { stroke: '#ff0000' } });
            continue; 
        }
        
        // Auto-fix Harvesters without source
        if (creep.memory.role === 'harvester') {
            if (creep.memory.targetSourceId && creep.memory.targetRoom) {
                const s = Game.getObjectById(creep.memory.targetSourceId);
                if (s && s.room.name !== creep.memory.targetRoom) {
                    creep.memory.targetSourceId = null; 
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

        if (Game.cpu.getUsed() > Game.cpu.tickLimit * 0.8) {
            creep.say('CPU');
            continue; 
        }

        if (modules[creep.memory.role]) {
            try { modules[creep.memory.role].run(creep); } catch (e) { }
        }
    }

    // --- PASS 3: INFRASTRUCTURE (TOWERS) ---
    Object.keys(activeRegistry).forEach(roomName => {
        const room = Game.rooms[roomName];
        if (room) {
            const towers = room.find(FIND_MY_STRUCTURES, {filter: {structureType: STRUCTURE_TOWER}});
            towers.forEach(t => {
                try { towerLogic.run(t); } catch (e) { logger.log('Tower Error: ' + e, 'error'); }
            });
        }
    });

    // --- PASS 4: SPAWNING (MULTI-SPAWN INFINITE BASES) ---
    let queuePreview = [];
    const spawnActions = [];
    const plannedSpawns = [];

    function getPreSpawnTime(creep) {
        const spawnTime = creep.body.length * 3;
        const targetR = creep.memory.targetRoom || creep.memory.workRoom || creep.room.name;
        const homeR = creep.memory.homeRoom || creep.memory.home || creep.room.name;
        const roomDist = Game.map.getRoomLinearDistance(homeR, targetR);
        const travelTime = (roomDist === 0) ? 20 : (roomDist * 50); // 20 Ticks im eigenen Raum, 50 pro Raumwechsel
        return spawnTime + travelTime + 10; // +10 Ticks Sicherheitspuffer
    }

    function countAssigned(role, roomName, memoryKey) {
        const live = _.filter(Game.creeps, c =>
            c.memory.role === role &&
            (c.spawning || c.ticksToLive > getPreSpawnTime(c)) && 
            (c.memory[memoryKey] === roomName || (!c.memory[memoryKey] && c.room.name === roomName))
        ).length;
        const planned = _.filter(plannedSpawns, m =>
            m.role === role && m[memoryKey] === roomName
        ).length;
        return live + planned;
    }

    function countRole(role) {
        const live = _.filter(Game.creeps, c => c.memory.role === role && (c.spawning || c.ticksToLive > getPreSpawnTime(c))).length;
        return live + _.filter(plannedSpawns, m => m.role === role).length;
    }

    function readNeeds() {
        const homeBuilders = countAssigned('builder', rooms.HOME, 'workRoom');
        const homeUpgraders = countAssigned('upgrader', rooms.HOME, 'targetRoom');
        const homeRepairers = countAssigned('repairer', rooms.HOME, 'workRoom');
        const targetBuilders = countAssigned('builder', targetRoom, 'workRoom');
        const targetRepairers = countAssigned('repairer', targetRoom, 'workRoom');
        const targetUpgraders = countAssigned('upgrader', targetRoom, 'targetRoom');
        const targetHaulers = countAssigned('hauler', targetRoom, 'workRoom');
        const targetClaimers = countAssigned('claimer', targetRoom, 'targetRoom');
        const targetRemoteMiners = countAssigned('remoteMiner', targetRoom, 'targetRoom');
        const targetRemoteHaulers = countAssigned('hauler', targetRoom, 'targetRoom');
        const miningBuilders = countAssigned('builder', rooms.MINING, 'workRoom');
        const miningUpgraders = countAssigned('upgrader', rooms.MINING, 'targetRoom');
        const miningHaulers = countAssigned('hauler', rooms.MINING, 'workRoom');
        const miningClaimers = countAssigned('claimer', rooms.MINING, 'targetRoom');
        const expansionBuilders = countAssigned('builder', rooms.EXPANSION, 'workRoom');
        const expansionUpgraders = countAssigned('upgrader', rooms.EXPANSION, 'targetRoom');
        const expansionRepairers = countAssigned('repairer', rooms.EXPANSION, 'workRoom');
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
            targetClaimers,
            targetRemoteMiners,
            targetRemoteHaulers,
            miningBuilders,
            miningUpgraders,
            miningHaulers,
            miningClaimers,
            expansionBuilders,
            expansionUpgraders,
            expansionRepairers,
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
        mineralMiner: [WORK, CARRY, MOVE],
        scout: [MOVE]
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

    // DYNAMISCHE LISTEN AUS DEM INVENTAR LESEN (Spart CPU!)
    const ownedRoomNames = Memory.inventory && Memory.inventory.rooms ? Object.keys(Memory.inventory.rooms).filter(rn => Memory.inventory.rooms[rn].my) : [];
    const dynamicMinerQueue = [];
    ownedRoomNames.forEach(rn => {
        const requiredMiners = Memory.inventory.rooms[rn].sources * 2;
        const currentMiners = countAssigned('harvester', rn, 'targetRoom');
        dynamicMinerQueue.push({
            room: rn,
            current: currentMiners,
            required: requiredMiners
        });
    });

    const dynamicMineralQueue = [];
    ownedRoomNames.forEach(rn => {
        const inv = Memory.inventory.rooms[rn];
        if (inv.rcl >= 6 && inv.extractors > 0 && inv.mineralAmount > 0) {
            const currentMiners = countAssigned('mineralMiner', rn, 'workRoom');
            dynamicMineralQueue.push({ room: rn, current: currentMiners, required: 1 });
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
        targetBuilderNeed: TARGET_BUILDER_QUOTA,
        targetRepairers: baseNeeds.targetRepairers,
        targetRepairerNeed: TARGET_REPAIRER_QUOTA,
        targetUpgraders: baseNeeds.targetUpgraders,
        targetUpgraderNeed: TARGET_UPGRADER_QUOTA, // This was just a typo fix, it's correct now.
        targetHaulers: baseNeeds.targetHaulers,
        targetClaimers: baseNeeds.targetClaimers,
        targetClaimerNeed: TARGET_CLAIMER_QUOTA,
        targetRemoteMiners: baseNeeds.targetRemoteMiners,
        targetRemoteHaulers: baseNeeds.targetRemoteHaulers,
        miningBuilders: baseNeeds.miningBuilders,
        miningUpgraders: baseNeeds.miningUpgraders,
        miningHaulers: baseNeeds.miningHaulers,
        miningClaimers: baseNeeds.miningClaimers,
        expansionBuilders: baseNeeds.expansionBuilders,
        expansionBuilderNeed: EXPANSION_BUILDER_QUOTA,
        expansionUpgraders: baseNeeds.expansionUpgraders,
        expansionUpgraderNeed: EXPANSION_UPGRADER_QUOTA,
        expansionRepairers: baseNeeds.expansionRepairers,
        expansionRepairerNeed: EXPANSION_REPAIRER_QUOTA,
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
    if (TARGET_CLAIMER_QUOTA > 0) {
        addQueueEntry(baseNeeds.targetClaimers >= TARGET_CLAIMER_QUOTA, `claimer@${targetRoom}`, baseNeeds.targetClaimers, TARGET_CLAIMER_QUOTA);
    }
    addQueueEntry(baseNeeds.targetRemoteMiners >= TARGET_REMOTE_MINER_QUOTA, `remoteMiner@${targetRoom}`, baseNeeds.targetRemoteMiners, TARGET_REMOTE_MINER_QUOTA);
    addQueueEntry(baseNeeds.targetRemoteHaulers >= TARGET_REMOTE_HAULER_QUOTA, `hauler@${targetRoom}`, baseNeeds.targetRemoteHaulers, TARGET_REMOTE_HAULER_QUOTA);
    addQueueEntry(baseNeeds.miningUpgraders >= MINING_UPGRADER_QUOTA, `upgrader@${rooms.MINING}`, baseNeeds.miningUpgraders, MINING_UPGRADER_QUOTA);
    addQueueEntry(countRole('hauler') >= roles.COUNTS.hauler, 'hauler', countRole('hauler'), roles.COUNTS.hauler);
    addQueueEntry(baseNeeds.targetHaulers >= TARGET_HAULER_QUOTA, `hauler@${targetRoom}`, baseNeeds.targetHaulers, TARGET_HAULER_QUOTA);
    addQueueEntry(baseNeeds.expansionBuilders >= EXPANSION_BUILDER_QUOTA, `builder@${expansionRoom}`, baseNeeds.expansionBuilders, EXPANSION_BUILDER_QUOTA);
    addQueueEntry(baseNeeds.expansionUpgraders >= EXPANSION_UPGRADER_QUOTA, `upgrader@${expansionRoom}`, baseNeeds.expansionUpgraders, EXPANSION_UPGRADER_QUOTA);
    addQueueEntry(baseNeeds.expansionRepairers >= EXPANSION_REPAIRER_QUOTA, `repairer@${expansionRoom}`, baseNeeds.expansionRepairers, EXPANSION_REPAIRER_QUOTA);
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
    else if (TARGET_CLAIMER_QUOTA > 0 && baseNeeds.targetClaimers < TARGET_CLAIMER_QUOTA) sRole = 'claimer';
    else if (baseNeeds.targetBuilders < TARGET_BUILDER_QUOTA) sRole = 'builder';
    else if (TARGET_REMOTE_MINER_QUOTA > 0 && baseNeeds.targetRemoteMiners < TARGET_REMOTE_MINER_QUOTA) sRole = 'remoteMiner';
    else if (TARGET_REMOTE_HAULER_QUOTA > 0 && baseNeeds.targetRemoteHaulers < TARGET_REMOTE_HAULER_QUOTA) sRole = 'hauler';
    else if (baseNeeds.miningBuilders < MINING_BUILDER_QUOTA) sRole = 'builder';
    else if (EXPANSION_BUILDER_QUOTA > 0 && baseNeeds.expansionBuilders < EXPANSION_BUILDER_QUOTA) sRole = 'builder';
    else if (baseNeeds.targetUpgraders < TARGET_UPGRADER_QUOTA) sRole = 'upgrader';
    else if (baseNeeds.miningUpgraders < MINING_UPGRADER_QUOTA) sRole = 'upgrader';
    else if (EXPANSION_UPGRADER_QUOTA > 0 && baseNeeds.expansionUpgraders < EXPANSION_UPGRADER_QUOTA) sRole = 'upgrader';
    else if (countRole('hauler') < roles.COUNTS.hauler) sRole = 'hauler';
    else if (baseNeeds.targetHaulers < TARGET_HAULER_QUOTA) sRole = 'hauler';
    else if (baseNeeds.miningHaulers < MINING_HAULER_QUOTA) sRole = 'hauler';
    else if (baseNeeds.expansionHaulers < EXPANSION_HAULER_QUOTA) sRole = 'hauler';
    else if (countRole('scavenger') < roles.COUNTS.scavenger) sRole = 'scavenger';
    else if (baseNeeds.homeRepairers < HOME_REPAIRER_QUOTA) sRole = 'repairer';
    else if (baseNeeds.targetRepairers < TARGET_REPAIRER_QUOTA) sRole = 'repairer';
    else if (EXPANSION_REPAIRER_QUOTA > 0 && baseNeeds.expansionRepairers < EXPANSION_REPAIRER_QUOTA) sRole = 'repairer';
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
    else if (countRole('scout') < roles.COUNTS.scout) sRole = 'scout';

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
    } else if (sRole === 'builder' && EXPANSION_BUILDER_QUOTA > 0 && baseNeeds.expansionBuilders < EXPANSION_BUILDER_QUOTA) {
        spawnMemory.workRoom = expansionRoom;
        }

        if (sRole === 'repairer' && baseNeeds.homeRepairers < HOME_REPAIRER_QUOTA) {
            spawnMemory.workRoom = rooms.HOME;
        } else if (sRole === 'repairer' && baseNeeds.targetRepairers < TARGET_REPAIRER_QUOTA) {
            spawnMemory.workRoom = targetRoom;
    } else if (sRole === 'repairer' && EXPANSION_REPAIRER_QUOTA > 0 && baseNeeds.expansionRepairers < EXPANSION_REPAIRER_QUOTA) {
        spawnMemory.workRoom = expansionRoom;
        }

        if (sRole === 'hauler') {
            if (countRole('hauler') < roles.COUNTS.hauler) {
                // This is a home hauler, no extra memory needed, it will default to workRoom=HOME
            } else if (baseNeeds.targetHaulers < TARGET_HAULER_QUOTA) {
                spawnMemory.workRoom = targetRoom;
        } else if (baseNeeds.miningHaulers < MINING_HAULER_QUOTA) {
            spawnMemory.workRoom = rooms.MINING;
        } else if (TARGET_REMOTE_HAULER_QUOTA > 0 && baseNeeds.targetRemoteHaulers < TARGET_REMOTE_HAULER_QUOTA) {
            spawnMemory.targetRoom = targetRoom;
            spawnMemory.homeRoom = rooms.HOME;
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
    } else if (sRole === 'upgrader' && EXPANSION_UPGRADER_QUOTA > 0 && baseNeeds.expansionUpgraders < EXPANSION_UPGRADER_QUOTA) {
        spawnMemory.targetRoom = expansionRoom;
        }

        if (sRole === 'claimer') {
            if (TARGET_CLAIMER_QUOTA > 0 && baseNeeds.targetClaimers < TARGET_CLAIMER_QUOTA) {
                spawnMemory.targetRoom = targetRoom;
                spawnMemory.claimMode = canClaimMore ? 'claim' : 'reserve'; // GCL AWARENESS
            } else if (baseNeeds.shouldReserveMining && baseNeeds.miningClaimers < MINING_CLAIMER_QUOTA) {
                spawnMemory.targetRoom = rooms.MINING;
                spawnMemory.claimMode = 'reserve';
            }
        }

        if (sRole === 'remoteMiner') {
            if (TARGET_REMOTE_MINER_QUOTA > 0 && baseNeeds.targetRemoteMiners < TARGET_REMOTE_MINER_QUOTA) {
                spawnMemory.targetRoom = targetRoom;
                spawnMemory.homeRoom = rooms.HOME;
            } else if (baseNeeds.expansionRemoteMiners < EXPANSION_MINER_QUOTA) {
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

    const recyclingCount = _.filter(Game.creeps, c => c.memory.recycle).length;

    const spawnsByRoom = {};
    allSpawns.forEach(s => {
        if (!spawnsByRoom[s.room.name]) spawnsByRoom[s.room.name] = [];
        if (s.spawning) {
            const spawningCreep = Game.creeps[s.spawning.name];
            const role = spawningCreep ? spawningCreep.memory.role : 'unknown';
            spawnsByRoom[s.room.name].push(`<span style="color:#ffb766">${role}(${s.spawning.remainingTime}t)</span>`);
        } else {
            spawnsByRoom[s.room.name].push('<span style="color:#00ffcc">IDLE</span>');
        }
    });

    function getRoomTTL(roomName) {
        const creeps = _.filter(Game.creeps, c => 
            !c.spawning && 
            (c.room.name === roomName || c.memory.workRoom === roomName || c.memory.targetRoom === roomName)
        );
        if (!creeps.length) return 'N/A';
        const ttls = creeps.map(c => c.ticksToLive).filter(t => t !== undefined);
        if (!ttls.length) return 'N/A';
        const avg = Math.round(_.sum(ttls) / ttls.length);
        const min = _.min(ttls);
        return `min ${min}, avg ${avg}`;
    }

    const fQ = (role, have, need) => {
        if (need === 0 && have === 0) return '';
        const color = have < need ? '#ffb766' : (have > need ? '#ff4d4d' : '#00ffcc');
        return `<span style="color:${color}">${role}:${have}/${need}</span>`;
    };

    const roomReports = [];
    
    const homeDynMiners = dynamicMinerQueue.filter(q => q.room === rooms.HOME);
    roomReports.push({
        name: rooms.HOME, label: 'HOME',
        nrg: homeRoom ? homeRoom.energyAvailable : 0,
        cap: homeRoom ? homeRoom.energyCapacityAvailable : 0,
        rcl: homeRCL,
        spawns: spawnsByRoom[rooms.HOME] || [],
        ttl: getRoomTTL(rooms.HOME),
        roles: [
            fQ('HV', _.sum(homeDynMiners, 'current'), _.sum(homeDynMiners, 'required')),
            fQ('BLD', baseNeeds.homeBuilders, HOME_BUILDER_QUOTA),
            fQ('UPG', baseNeeds.homeUpgraders, HOME_UPGRADER_QUOTA),
            fQ('REP', baseNeeds.homeRepairers, HOME_REPAIRER_QUOTA),
            fQ('HAUL', countRole('hauler'), roles.COUNTS.hauler),
            fQ('SCAV', countRole('scavenger'), roles.COUNTS.scavenger)
        ].filter(s => s).join(' ') || '<span style="color:#9db0c6">None</span>'
    });

    if (rooms.TARGET) {
        const rv = Game.rooms[rooms.TARGET];
        const dynM = dynamicMinerQueue.filter(q => q.room === rooms.TARGET);
        roomReports.push({
            name: rooms.TARGET, label: 'TARGET',
            nrg: rv ? rv.energyAvailable : 0, cap: rv ? rv.energyCapacityAvailable : 0,
            rcl: rv && rv.controller ? rv.controller.level : 0,
            spawns: spawnsByRoom[rooms.TARGET] || [],
            ttl: getRoomTTL(rooms.TARGET),
            roles: [
                fQ('CLM', baseNeeds.targetClaimers, TARGET_CLAIMER_QUOTA),
                fQ('HV', _.sum(dynM, 'current'), _.sum(dynM, 'required')),
                fQ('BLD', baseNeeds.targetBuilders, TARGET_BUILDER_QUOTA),
                fQ('UPG', baseNeeds.targetUpgraders, TARGET_UPGRADER_QUOTA),
                fQ('REP', baseNeeds.targetRepairers, TARGET_REPAIRER_QUOTA),
                fQ('HAUL', baseNeeds.targetHaulers, TARGET_HAULER_QUOTA),
                fQ('RMIN', baseNeeds.targetRemoteMiners, TARGET_REMOTE_MINER_QUOTA),
                fQ('RHAUL', baseNeeds.targetRemoteHaulers, TARGET_REMOTE_HAULER_QUOTA)
            ].filter(s => s).join(' ') || '<span style="color:#9db0c6">None</span>'
        });
    }

    if (rooms.EXPANSION) {
        const rv = Game.rooms[rooms.EXPANSION];
        roomReports.push({
            name: rooms.EXPANSION, label: 'EXPANSION',
            nrg: rv ? rv.energyAvailable : 0, cap: rv ? rv.energyCapacityAvailable : 0,
            rcl: rv && rv.controller ? rv.controller.level : 0,
            spawns: spawnsByRoom[rooms.EXPANSION] || [],
            ttl: getRoomTTL(rooms.EXPANSION),
            roles: [
                fQ('RMIN', baseNeeds.expansionRemoteMiners, EXPANSION_MINER_QUOTA),
                fQ('HAUL', baseNeeds.expansionHaulers, EXPANSION_HAULER_QUOTA),
                fQ('BLD', baseNeeds.expansionBuilders, EXPANSION_BUILDER_QUOTA),
                fQ('UPG', baseNeeds.expansionUpgraders, EXPANSION_UPGRADER_QUOTA),
                fQ('REP', baseNeeds.expansionRepairers, EXPANSION_REPAIRER_QUOTA)
            ].filter(s => s).join(' ') || '<span style="color:#9db0c6">None</span>'
        });
    }

    if (rooms.MINING) {
        const rv = Game.rooms[rooms.MINING];
        roomReports.push({
            name: rooms.MINING, label: 'MINING',
            nrg: rv ? rv.energyAvailable : 0, cap: rv ? rv.energyCapacityAvailable : 0,
            rcl: rv && rv.controller ? rv.controller.level : 0,
            spawns: spawnsByRoom[rooms.MINING] || [],
            ttl: getRoomTTL(rooms.MINING),
            roles: [
                fQ('CLM', baseNeeds.miningClaimers, MINING_CLAIMER_QUOTA),
                fQ('RMIN', baseNeeds.miningRemoteMiners, MINING_REMOTE_MINER_QUOTA),
                fQ('HAUL', baseNeeds.miningHaulers, MINING_HAULER_QUOTA),
                fQ('BLD', baseNeeds.miningBuilders, MINING_BUILDER_QUOTA),
                fQ('UPG', baseNeeds.miningUpgraders, MINING_UPGRADER_QUOTA)
            ].filter(s => s).join(' ') || '<span style="color:#9db0c6">None</span>'
        });
    }

    logger.report({
        recycling: recyclingCount,
        cpu: Game.cpu.getUsed(),
        bucket: Game.cpu.bucket,
        credits: Game.market ? Game.market.credits : 0,
        earned: Memory.market ? Memory.market.earned : 0,
        pop: Object.keys(Game.creeps).length,
        cap: HARD_POP_CAP,
        queue: queuePreview,
        rooms: roomReports,
        defense: {
            active: !!defenseActive,
            room: defenseTargetRoom,
            need: defenseNeed,
            current: countAssigned('defender', defenseTargetRoom, 'targetRoom'),
            ttls: _.filter(Game.creeps, c => c.memory.role === 'defender' && c.memory.targetRoom === defenseTargetRoom).map(c => c.ticksToLive || 'spwn').join(','),
            healerNeed: defenseHealerNeed,
            currentHealers: countAssigned('healer', defenseTargetRoom, 'targetRoom'),
            homeThreat: roomThreats[rooms.HOME] || 0,
            targetThreat: roomThreats[rooms.TARGET] || 0,
            expansionThreat: roomThreats[rooms.EXPANSION] || 0
        },
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

    // --- PASS 7: MARKET (Auto-Sell) ---
    market.run();

    // --- PASS 8: AUTO-EXPANSION ---
    expander.run();

    // --- PASS 9: AUTOMATED BASE PLANNING ---
    // Alle 100 Ticks prüfen. Extrem ressourcenschonend, sorgt aber für schnelles Bootstrapping.
    if (Game.time % 100 === 0) {
        Object.values(Game.rooms)
            .filter(r => r.controller && r.controller.my)
            .forEach(r => planner.run(r));
    }
};
