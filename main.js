/**
 * SCOS Kernel v3.2 - Expedition & Clearing
 * ---------------------------------------
 * Mission: Clear E58S55 clutter and maintain reservation.
 * Logic: Prioritized spawning for a coordinated expedition.
 * Version: 3.2
 */

const roleHarvester = require('role.harvester');
const roleUpgrader = require('role.upgrader');
const roleBuilder = require('role.builder');
const roleClaimer = require('role.claimer');
const roleDismantler = require('role.dismantler');
const roleHealer = require('role.healer');
const roleDefender = require('role.defender');

const CONFIG = {
    MAX_HARVESTERS: 10,
    MAX_UPGRADERS: 3,
    MAX_BUILDERS: 3,
    MAX_CLAIMERS: 1,
    MAX_DISMANTLERS: 1, 
    MAX_HEALERS: 1,
    MAX_DEFENDERS: 1,

    TARGET_ROOM: 'E58S55',
    
    // Body Presets (Balanced for 1250 Cap)
    BODY_WORKER: [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE],
    BODY_DISMANTLER: [TOUGH, TOUGH, TOUGH, WORK, WORK, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE], 
    BODY_HEALER: [MOVE, MOVE, MOVE, MOVE, HEAL, HEAL, HEAL, HEAL], 
    BODY_TANK: [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK],
    BODY_SONIC_CLAIMER: [CLAIM, MOVE, MOVE, MOVE, MOVE, MOVE] 
};

module.exports.loop = function () {

    // 1. MEMORY CLEANUP
    for (let name in Memory.creeps) {
        if (!Game.creeps[name]) delete Memory.creeps[name];
    }

    // 2. TOWER DEFENSE
    const towers = _.filter(Game.structures, s => s.structureType == STRUCTURE_TOWER);
    for(let tower of towers) {
        let hostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
        if(hostile) {
            tower.attack(hostile);
        } else if (tower.store.getUsedCapacity(RESOURCE_ENERGY) > 500) {
            let damaged = tower.pos.findClosestByRange(FIND_STRUCTURES, s => s.hits < s.hitsMax && s.structureType != STRUCTURE_WALL);
            if(damaged) tower.repair(damaged);
        }
    }

    // 3. CENSUS & LOGGING (Text Only)
    if (Game.time % 10 === 0) {
        const h = _.filter(Game.creeps, c => c.memory.role == 'harvester').length;
        const u = _.filter(Game.creeps, c => c.memory.role == 'upgrader').length;
        const b = _.filter(Game.creeps, c => c.memory.role == 'builder').length;
        
        const mis_def = _.filter(Game.creeps, c => c.memory.role == 'defender').length;
        const mis_heal = _.filter(Game.creeps, c => c.memory.role == 'healer').length;
        const mis_dism = _.filter(Game.creeps, c => c.memory.role == 'dismantler').length;
        const mis_claim = _.filter(Game.creeps, c => c.memory.role == 'claimer').length;

        const spawn = Game.spawns['Spawn1'];
        const rcl = spawn.room.controller;
        
        console.log(`[${Game.time}] [NRG] ${spawn.room.energyAvailable}/${spawn.room.energyCapacityAvailable}`);
        console.log(`   +-- [ECO] H:${h}/${CONFIG.MAX_HARVESTERS} U:${u}/${CONFIG.MAX_UPGRADERS} B:${b}/${CONFIG.MAX_BUILDERS}`);
        console.log(`   +-- [OPS] DEF:${mis_def} MED:${mis_heal} DSM:${mis_dism} CLM:${mis_claim}`);
        
        if (spawn.spawning) {
            const spawningCreep = Game.creeps[spawn.spawning.name];
            console.log(`   +-- [SPN] Spawning: ${spawningCreep ? spawningCreep.memory.role : 'unknown'} (${spawn.spawning.remainingTime}t)`);
        }
    }

    // 4. SPAWNING LOGIC
    const spawn = Game.spawns['Spawn1'];
    if (spawn && !spawn.spawning) {
        let role = null; let body = null; let memory = {};

        const h = _.filter(Game.creeps, c => c.memory.role == 'harvester').length;
        const d = _.filter(Game.creeps, c => c.memory.role == 'dismantler').length;
        const med = _.filter(Game.creeps, c => c.memory.role == 'healer').length;
        const def = _.filter(Game.creeps, c => c.memory.role == 'defender').length;
        const clm = _.filter(Game.creeps, c => c.memory.role == 'claimer').length;

        // P1: Crash Recovery
        if (h < 4) {
            role = 'harvester'; body = [WORK, CARRY, MOVE];
        }
        // P2: Economic Stability
        else if (h < CONFIG.MAX_HARVESTERS) {
            role = 'harvester'; body = CONFIG.BODY_WORKER;
        }
        // P3: Expedition (Sequence: Clear -> Support -> Defend -> Claim)
        else if (d < CONFIG.MAX_DISMANTLERS && spawn.room.energyAvailable >= 1150) {
            role = 'dismantler'; body = CONFIG.BODY_DISMANTLER; memory.target = CONFIG.TARGET_ROOM;
        }
        else if (med < CONFIG.MAX_HEALERS && spawn.room.energyAvailable >= 1200) {
            role = 'healer'; body = CONFIG.BODY_HEALER; memory.target = CONFIG.TARGET_ROOM;
        }
        else if (def < CONFIG.MAX_DEFENDERS && spawn.room.energyAvailable >= 1180) {
            role = 'defender'; body = CONFIG.BODY_TANK; memory.target = CONFIG.TARGET_ROOM;
        }
        else if (clm < CONFIG.MAX_CLAIMERS && spawn.room.energyAvailable >= 850) {
            role = 'claimer'; body = CONFIG.BODY_SONIC_CLAIMER; memory.target = CONFIG.TARGET_ROOM;
        }
        
        // P4: Maintenance
        else if (_.filter(Game.creeps, c => c.memory.role == 'upgrader').length < CONFIG.MAX_UPGRADERS) {
            role = 'upgrader'; body = CONFIG.BODY_WORKER;
        }
        else if (_.filter(Game.creeps, c => c.memory.role == 'builder').length < CONFIG.MAX_BUILDERS && spawn.room.find(FIND_CONSTRUCTION_SITES).length > 0) {
            role = 'builder'; body = CONFIG.BODY_WORKER;
        }

        if (role) {
            memory.role = role;
            // Pre-assign source to harvesters
            if (role === 'harvester') {
                let sources = spawn.room.find(FIND_SOURCES);
                let counts = {};
                sources.forEach(s => counts[s.id] = 0);
                _.filter(Game.creeps, c => c.memory.targetSourceId).forEach(c => {
                    if (counts[c.memory.targetSourceId] !== undefined) counts[c.memory.targetSourceId]++;
                });
                let bestSource = _.sortBy(sources, s => counts[s.id])[0];
                memory.targetSourceId = bestSource.id;
            }
            
            if (spawn.spawnCreep(body, role + '_' + Game.time, { memory: memory }) === OK) {
                console.log(`[SYS] Spawning ${role}`);
            }
        }
    }

    // 5. EXECUTION & LOAD BALANCING
    for (let name in Game.creeps) {
        let creep = Game.creeps[name];
        
        // AUTO-BALANCE: If harvester has no source, assign one immediately
        if (creep.memory.role === 'harvester' && !creep.memory.targetSourceId) {
            let sources = creep.room.find(FIND_SOURCES);
            let counts = {};
            sources.forEach(s => counts[s.id] = 0);
            _.filter(Game.creeps, c => c.memory.targetSourceId).forEach(c => {
                if (counts[c.memory.targetSourceId] !== undefined) counts[c.memory.targetSourceId]++;
            });
            let bestSource = _.sortBy(sources, s => counts[s.id])[0];
            creep.memory.targetSourceId = bestSource.id;
        }

        if (creep.memory.role == 'harvester') roleHarvester.run(creep);
        if (creep.memory.role == 'upgrader') roleUpgrader.run(creep);
        if (creep.memory.role == 'builder') roleBuilder.run(creep);
        if (creep.memory.role == 'claimer') roleClaimer.run(creep);
        if (creep.memory.role == 'dismantler') roleDismantler.run(creep);
        if (creep.memory.role == 'healer') roleHealer.run(creep);
        if (creep.memory.role == 'defender') roleDefender.run(creep);
    }
};