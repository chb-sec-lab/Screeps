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
const roleNames = ['harvester', 'hauler', 'vanguard', 'medic', 'breacher', 'remoteMiner', 'builder', 'claimer', 'upgrader'];

roleNames.forEach(name => {
    try { modules[name] = require('role.' + name); } catch (e) { /* Safe Load */ }
});

module.exports.loop = function () {
    for (let name in Memory.creeps) if (!Game.creeps[name]) delete Memory.creeps[name];

    const census = {};
    roleNames.forEach(r => census[r] = 0);
    const homeRoom = Game.rooms[rooms.HOME];
    const spawn = Game.spawns['Spawn1'];

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

    // --- PASS 4: SPAWNING ---
    let queuePreview = [];
    let roomAssignments = {};
    let spawnAction = null;

    if (spawn && !spawn.spawning) {
        let sRole = null;
        let spawnMemory = null;
        const armyOn = (rooms.WAR_MODE === true);
        const targetRoom = rooms.TARGET;
        const expansionRoom = rooms.EXPANSION;

        function countAssigned(role, roomName, memoryKey) {
            return _.filter(Game.creeps, c =>
                c.memory.role === role &&
                (c.memory[memoryKey] === roomName || (!c.memory[memoryKey] && c.room.name === roomName))
            ).length;
        }

        const targetBuilders = countAssigned('builder', targetRoom, 'workRoom');
        const targetUpgraders = countAssigned('upgrader', targetRoom, 'targetRoom');
        const expansionClaimers = countAssigned('claimer', expansionRoom, 'targetRoom');
        const expansionRemoteMiners = countAssigned('remoteMiner', expansionRoom, 'targetRoom');

        const expansionController = Game.rooms[expansionRoom] && Game.rooms[expansionRoom].controller;
        const shouldReserveExpansion = !expansionController || !expansionController.my;

        roomAssignments = {
            targetBuilders: targetBuilders,
            targetUpgraders: targetUpgraders,
            expansionClaimers: expansionClaimers,
            expansionRemoteMiners: expansionRemoteMiners
        };

        function addQueueEntry(ok, label, have, need) {
            if (!ok) queuePreview.push(`${label}:${have}/${need}`);
        }

        addQueueEntry(census.harvester >= 2, 'harvester.min', census.harvester, 2);
        addQueueEntry(census.hauler >= roles.COUNTS.hauler, 'hauler', census.hauler, roles.COUNTS.hauler);
        addQueueEntry(census.harvester >= roles.COUNTS.harvester, 'harvester.target', census.harvester, roles.COUNTS.harvester);
        if (armyOn) {
            addQueueEntry(census.vanguard >= roles.COUNTS.vanguard, 'vanguard', census.vanguard, roles.COUNTS.vanguard);
            addQueueEntry(census.medic >= roles.COUNTS.medic, 'medic', census.medic, roles.COUNTS.medic);
        }
        addQueueEntry(targetBuilders >= 2, `builder@${targetRoom}`, targetBuilders, 2);
        addQueueEntry(targetUpgraders >= 1, `upgrader@${targetRoom}`, targetUpgraders, 1);
        if (shouldReserveExpansion) {
            addQueueEntry(expansionClaimers >= 1, `claimer@${expansionRoom}`, expansionClaimers, 1);
        }
        addQueueEntry(expansionRemoteMiners >= 4, `remoteMiner@${expansionRoom}`, expansionRemoteMiners, 4);
        addQueueEntry(census.remoteMiner >= roles.COUNTS.remoteMiner, 'remoteMiner', census.remoteMiner, roles.COUNTS.remoteMiner);
        addQueueEntry(census.builder >= roles.COUNTS.builder, 'builder', census.builder, roles.COUNTS.builder);
        addQueueEntry(census.claimer >= roles.COUNTS.claimer, 'claimer', census.claimer, roles.COUNTS.claimer);
        addQueueEntry(census.upgrader >= roles.COUNTS.upgrader, 'upgrader', census.upgrader, roles.COUNTS.upgrader);

        if (census.harvester < 2) sRole = 'harvester';
        else if (census.hauler < roles.COUNTS.hauler) sRole = 'hauler';
        else if (census.harvester < roles.COUNTS.harvester) sRole = 'harvester';
        else if (armyOn && census.vanguard < roles.COUNTS.vanguard) sRole = 'vanguard';
        else if (armyOn && census.medic < roles.COUNTS.medic) sRole = 'medic';
        else if (targetBuilders < 2) sRole = 'builder';
        else if (targetUpgraders < 1) sRole = 'upgrader';
        else if (shouldReserveExpansion && expansionClaimers < 1) sRole = 'claimer';
        else if (expansionRemoteMiners < 4) sRole = 'remoteMiner';
        else if (census.remoteMiner < roles.COUNTS.remoteMiner) sRole = 'remoteMiner';
        else if (census.builder < roles.COUNTS.builder) sRole = 'builder';
        else if (census.claimer < roles.COUNTS.claimer) sRole = 'claimer';
        else if (census.upgrader < roles.COUNTS.upgrader) sRole = 'upgrader';

        if (sRole) {
            const name = roles.generateName(sRole);
            spawnMemory = { role: sRole };

            if (sRole === 'builder' && targetBuilders < 2) {
                spawnMemory.workRoom = targetRoom;
            }

            if (sRole === 'upgrader' && targetUpgraders < 1) {
                spawnMemory.targetRoom = targetRoom;
            }

            if (sRole === 'claimer' && shouldReserveExpansion && expansionClaimers < 1) {
                spawnMemory.targetRoom = expansionRoom;
                spawnMemory.claimMode = 'reserve';
            }

            if (sRole === 'remoteMiner' && expansionRemoteMiners < 4) {
                spawnMemory.targetRoom = expansionRoom;
                spawnMemory.homeRoom = rooms.HOME;
            }

            const spawnRes = spawn.spawnCreep(roles.BODIES[sRole], name, { memory: spawnMemory });
            if (spawnRes === OK) {
                spawnAction = `${sRole} -> ${spawnMemory.targetRoom || spawnMemory.workRoom || rooms.HOME}`;
                logger.log(`🐣 Spawning: ${name}`, 'success');
            } else {
                logger.log(`Spawn blocked: role=${sRole} code=${spawnRes}`, 'warn');
            }
        }
    } else if (spawn) {
        queuePreview = ['spawn busy'];
        roomAssignments = {
            targetBuilders: _.filter(Game.creeps, c => c.memory.role === 'builder' && c.memory.workRoom === rooms.TARGET).length,
            targetUpgraders: _.filter(Game.creeps, c => c.memory.role === 'upgrader' && c.memory.targetRoom === rooms.TARGET).length,
            expansionClaimers: _.filter(Game.creeps, c => c.memory.role === 'claimer' && c.memory.targetRoom === rooms.EXPANSION).length,
            expansionRemoteMiners: _.filter(Game.creeps, c => c.memory.role === 'remoteMiner' && c.memory.targetRoom === rooms.EXPANSION).length
        };
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
        spawn: spawn ? {
            busy: !!spawn.spawning,
            name: spawn.spawning ? spawn.spawning.name : null,
            remainingTime: spawn.spawning ? spawn.spawning.remainingTime : 0,
            action: spawnAction
        } : null,
        queue: queuePreview
    });
};
