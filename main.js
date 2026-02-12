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
    const spawn = Game.spawns['Spawn1'];
    if (spawn && !spawn.spawning) {
        let sRole = null;
        const armyOn = (rooms.WAR_MODE === true);

        if (census.harvester < 2) sRole = 'harvester';
        else if (census.hauler < roles.COUNTS.hauler) sRole = 'hauler';
        else if (census.harvester < roles.COUNTS.harvester) sRole = 'harvester';
        else if (armyOn && census.vanguard < roles.COUNTS.vanguard) sRole = 'vanguard';
        else if (armyOn && census.medic < roles.COUNTS.medic) sRole = 'medic';
        else if (census.remoteMiner < roles.COUNTS.remoteMiner) sRole = 'remoteMiner';
        else if (census.builder < roles.COUNTS.builder) sRole = 'builder';
        else if (census.claimer < roles.COUNTS.claimer) sRole = 'claimer';
        else if (census.upgrader < roles.COUNTS.upgrader) sRole = 'upgrader';

        if (sRole) {
            const name = roles.generateName(sRole);
            if (spawn.spawnCreep(roles.BODIES[sRole], name, {memory: {role: sRole}}) === OK) {
                logger.log(`🐣 Spawning: ${name}`, 'success');
            }
        }
    }

    logger.report({ energy: homeRoom ? homeRoom.energyAvailable : 0, cap: homeRoom ? homeRoom.energyCapacityAvailable : 0, census: census });
};