/**
 * main.js - SCOS Kernel v6.1.1
 * Updated: 2026-02-11 23:02 CET (Amsterdam)
 * Role: Orchestrator / Tower Priority / Battle Logging
 * Update: Added claimer and upgrader to spawning chain.
 */
const rooms = require('config.rooms');
const roles = require('config.roles');
const logger = require('utils.logger');

let modules = {};
const roleNames = ['harvester', 'hauler', 'scavenger', 'repairer', 'defender', 'vanguard', 'medic', 'breacher', 'remoteMiner', 'builder', 'claimer', 'upgrader'];

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

    // --- DEFENSE STATUS (Home + Target) ---
    if (!Memory.defense) Memory.defense = {};

    function getHostileCount(room) {
        if (!room) return 0;
        return room.find(FIND_HOSTILE_CREEPS, {
            filter: c =>
                c.getActiveBodyparts(ATTACK) > 0 ||
                c.getActiveBodyparts(RANGED_ATTACK) > 0 ||
                c.getActiveBodyparts(HEAL) > 0
        }).length;
    }

    const homeThreat = getHostileCount(homeRoom);
    const targetThreat = getHostileCount(targetRoomView);
    const hasLiveThreat = homeThreat > 0 || targetThreat > 0;

    if (hasLiveThreat) {
        const urgentRoom = (homeThreat >= targetThreat) ? rooms.HOME : rooms.TARGET;
        const urgentThreat = Math.max(homeThreat, targetThreat);

        Memory.defense.activeUntil = Game.time + 75;
        Memory.defense.targetRoom = urgentRoom;
        Memory.defense.need = Math.min(3, Math.max(1, Math.ceil(urgentThreat / 2)));
    }

    const defenseActive = Memory.defense.activeUntil && Game.time <= Memory.defense.activeUntil;
    const defenseTargetRoom = defenseActive ? (Memory.defense.targetRoom || rooms.TARGET) : null;
    const defenseNeed = defenseActive ? (Memory.defense.need || 1) : 0;

    // --- PASS 1: CENSUS & SOURCE TRACKING ---
    const sourceAssignments = {};
    if (homeRoom) homeRoom.find(FIND_SOURCES).forEach(s => sourceAssignments[s.id] = 0);

    for (let name in Game.creeps) {
        const creep = Game.creeps[name];
        census[creep.memory.role]++;
        if (creep.memory.role === 'harvester' && creep.memory.targetSourceId) {
            sourceAssignments[creep.memory.targetSourceId]++;
        }
        
        // Attack Detection
        if (creep.hits < (creep.memory.lastHits || creep.hitsMax)) {
            logger.log(`⚠️ ATTACK: ${creep.name} in ${creep.room.name}!`, 'error');
        }
        creep.memory.lastHits = creep.hits;
    }

    // --- PASS 2: EXECUTION ---
    for (let name in Game.creeps) {
        const creep = Game.creeps[name];
        creep.memory.home = rooms.HOME;
        creep.memory.target = rooms.TARGET;

        // Auto-fix Harvesters without source
        if (creep.memory.role === 'harvester' && !creep.memory.targetSourceId && homeRoom) {
            const best = _.sortBy(homeRoom.find(FIND_SOURCES), s => sourceAssignments[s.id])[0];
            if (best) {
                creep.memory.targetSourceId = best.id;
                sourceAssignments[best.id]++;
            }
        }

        if (modules[creep.memory.role]) {
            try { modules[creep.memory.role].run(creep); } catch (e) { }
        }
    }

    // --- PASS 3: INFRASTRUCTURE (TOWERS: Priority Streets) ---
    if (homeRoom) {
        const towers = homeRoom.find(FIND_MY_STRUCTURES, {filter: {structureType: STRUCTURE_TOWER}});
        towers.forEach(t => {
            const enemy = t.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
            if (enemy) {
                t.attack(enemy);
            } else if (t.store.getUsedCapacity(RESOURCE_ENERGY) > 400) {
                // Priority Repair: Roads (Streets) & Containers
                let rep = t.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: s => (s.structureType == STRUCTURE_ROAD || s.structureType == STRUCTURE_CONTAINER) && s.hits < s.hitsMax
                });
                if (!rep) {
                    rep = t.pos.findClosestByRange(FIND_STRUCTURES, {
                        filter: s => s.hits < s.hitsMax && s.structureType != STRUCTURE_WALL && s.structureType != STRUCTURE_RAMPART
                    });
                }
                if (rep) t.repair(rep);
            }
        });
    }

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
        const targetBuilders = countAssigned('builder', targetRoom, 'workRoom');
        const targetRepairers = countAssigned('repairer', targetRoom, 'workRoom');
        const targetUpgraders = countAssigned('upgrader', targetRoom, 'targetRoom');
        const expansionClaimers = countAssigned('claimer', expansionRoom, 'targetRoom');
        const expansionRemoteMiners = countAssigned('remoteMiner', expansionRoom, 'targetRoom');
        const expansionHaulers = countAssigned('hauler', expansionRoom, 'targetRoom');
        const defenseDefenders = defenseTargetRoom ? countAssigned('defender', defenseTargetRoom, 'targetRoom') : 0;
        const expansionController = Game.rooms[expansionRoom] && Game.rooms[expansionRoom].controller;
        const shouldReserveExpansion = !expansionController || !expansionController.my;
        return {
            targetBuilders,
            targetRepairers,
            targetUpgraders,
            expansionClaimers,
            expansionRemoteMiners,
            expansionHaulers,
            defenseDefenders,
            shouldReserveExpansion
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
        claimer: [CLAIM, MOVE]
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
    roomAssignments = {
        targetBuilders: baseNeeds.targetBuilders,
        targetRepairers: baseNeeds.targetRepairers,
        targetUpgraders: baseNeeds.targetUpgraders,
        expansionClaimers: baseNeeds.expansionClaimers,
        expansionRemoteMiners: baseNeeds.expansionRemoteMiners,
        expansionHaulers: baseNeeds.expansionHaulers,
        defenseDefenders: baseNeeds.defenseDefenders
    };

    function addQueueEntry(ok, label, have, need) {
        if (!ok) queuePreview.push(`${label}:${have}/${need}`);
    }

    addQueueEntry(countRole('harvester') >= 2, 'harvester.min', countRole('harvester'), 2);
    addQueueEntry(countRole('hauler') >= roles.COUNTS.hauler, 'hauler', countRole('hauler'), roles.COUNTS.hauler);
    addQueueEntry(countRole('scavenger') >= roles.COUNTS.scavenger, 'scavenger', countRole('scavenger'), roles.COUNTS.scavenger);
    if (defenseActive) {
        addQueueEntry(baseNeeds.defenseDefenders >= defenseNeed, `defender@${defenseTargetRoom}`, baseNeeds.defenseDefenders, defenseNeed);
    }
    addQueueEntry(baseNeeds.expansionHaulers >= 1, `hauler@${expansionRoom}`, baseNeeds.expansionHaulers, 1);
    addQueueEntry(countRole('harvester') >= roles.COUNTS.harvester, 'harvester.target', countRole('harvester'), roles.COUNTS.harvester);
    if (armyOn) {
        addQueueEntry(countRole('vanguard') >= roles.COUNTS.vanguard, 'vanguard', countRole('vanguard'), roles.COUNTS.vanguard);
        addQueueEntry(countRole('medic') >= roles.COUNTS.medic, 'medic', countRole('medic'), roles.COUNTS.medic);
    }
    addQueueEntry(baseNeeds.targetBuilders >= 2, `builder@${targetRoom}`, baseNeeds.targetBuilders, 2);
    addQueueEntry(baseNeeds.targetRepairers >= 2, `repairer@${targetRoom}`, baseNeeds.targetRepairers, 2);
    addQueueEntry(baseNeeds.targetUpgraders >= 1, `upgrader@${targetRoom}`, baseNeeds.targetUpgraders, 1);
    if (baseNeeds.shouldReserveExpansion) {
        addQueueEntry(baseNeeds.expansionClaimers >= 1, `claimer@${expansionRoom}`, baseNeeds.expansionClaimers, 1);
    }
    addQueueEntry(baseNeeds.expansionRemoteMiners >= 4, `remoteMiner@${expansionRoom}`, baseNeeds.expansionRemoteMiners, 4);
    addQueueEntry(countRole('remoteMiner') >= roles.COUNTS.remoteMiner, 'remoteMiner', countRole('remoteMiner'), roles.COUNTS.remoteMiner);
    addQueueEntry(countRole('builder') >= roles.COUNTS.builder, 'builder', countRole('builder'), roles.COUNTS.builder);
    addQueueEntry(countRole('claimer') >= roles.COUNTS.claimer, 'claimer', countRole('claimer'), roles.COUNTS.claimer);
    addQueueEntry(countRole('upgrader') >= roles.COUNTS.upgrader, 'upgrader', countRole('upgrader'), roles.COUNTS.upgrader);

    const idleSpawns = allSpawns.filter(s => !s.spawning);
    if (idleSpawns.length === 0 && allSpawns.length > 0) queuePreview = ['spawn busy'];

    for (const spawn of idleSpawns) {
        let sRole = null;
        let spawnMemory = null;
        const needs = readNeeds();

        if (countRole('harvester') < 2) sRole = 'harvester';
        else if (countRole('hauler') < roles.COUNTS.hauler) sRole = 'hauler';
        else if (defenseActive && needs.defenseDefenders < defenseNeed) sRole = 'defender';
        else if (countRole('scavenger') < roles.COUNTS.scavenger) sRole = 'scavenger';
        else if (needs.expansionHaulers < 1) sRole = 'hauler';
        else if (countRole('harvester') < roles.COUNTS.harvester) sRole = 'harvester';
        else if (armyOn && countRole('vanguard') < roles.COUNTS.vanguard) sRole = 'vanguard';
        else if (armyOn && countRole('medic') < roles.COUNTS.medic) sRole = 'medic';
        else if (needs.targetBuilders < 2) sRole = 'builder';
        else if (needs.targetRepairers < 2) sRole = 'repairer';
        else if (needs.targetUpgraders < 1) sRole = 'upgrader';
        else if (needs.shouldReserveExpansion && needs.expansionClaimers < 1) sRole = 'claimer';
        else if (needs.expansionRemoteMiners < 4) sRole = 'remoteMiner';
        else if (countRole('remoteMiner') < roles.COUNTS.remoteMiner) sRole = 'remoteMiner';
        else if (countRole('builder') < roles.COUNTS.builder) sRole = 'builder';
        else if (countRole('claimer') < roles.COUNTS.claimer) sRole = 'claimer';
        else if (countRole('upgrader') < roles.COUNTS.upgrader) sRole = 'upgrader';

        if (!sRole) continue;

        const name = roles.generateName(sRole);
        spawnMemory = { role: sRole };

        if (sRole === 'builder' && needs.targetBuilders < 2) {
            spawnMemory.workRoom = targetRoom;
        }

        if (sRole === 'repairer' && needs.targetRepairers < 2) {
            spawnMemory.workRoom = targetRoom;
        }

        if (sRole === 'hauler' && needs.expansionHaulers < 1 && countRole('hauler') >= roles.COUNTS.hauler) {
            spawnMemory.targetRoom = expansionRoom;
            spawnMemory.homeRoom = rooms.HOME;
        }

        if (sRole === 'defender' && defenseActive && needs.defenseDefenders < defenseNeed) {
            spawnMemory.targetRoom = defenseTargetRoom;
            spawnMemory.homeRoom = rooms.HOME;
        }

        if (sRole === 'upgrader' && needs.targetUpgraders < 1) {
            spawnMemory.targetRoom = targetRoom;
        }

        if (sRole === 'claimer' && needs.shouldReserveExpansion && needs.expansionClaimers < 1) {
            spawnMemory.targetRoom = expansionRoom;
            spawnMemory.claimMode = 'reserve';
        }

        if (sRole === 'remoteMiner' && needs.expansionRemoteMiners < 4) {
            spawnMemory.targetRoom = expansionRoom;
            spawnMemory.homeRoom = rooms.HOME;
        }

        const body = resolveSpawnBody(spawn, sRole);
        if (!body) {
            continue;
        }

        const spawnRes = spawn.spawnCreep(body, name, { memory: spawnMemory });
        if (spawnRes === OK) {
            plannedSpawns.push(spawnMemory);
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
            homeThreat: homeThreat,
            targetThreat: targetThreat
        },
        queue: queuePreview
    });
};
