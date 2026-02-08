/**
 * SCOS Kernel - Phase 2.2 (Hardened)
 * ---------------------------------
 * DESCRIPTION:
 * The central controller for the colony. Manages memory cleanup, 
 * automated tower defense, population census, and smart spawning logic.
 *
 * DESIGN PRINCIPLE:
 * Factual naming, observability (clean logging), and prioritized 
 * emergency recovery.
 */

// --- MODULE IMPORTS ---
// Importing role-specific logic modules to maintain Separation of Concerns.
var roleHarvester = require('role.harvester');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');
var roleClaimer = require('role.claimer');

/**
 * CONFIGURATION SETTINGS
 * ----------------------
 * Defines population targets and standardized body compositions (Hardware).
 */
const CONFIG = {
    // Population limits for the current RCL
    MAX_HARVESTERS: 8,
    MAX_UPGRADERS: 3,
    MAX_BUILDERS: 3,
    MAX_CLAIMERS: 1,

    // Body part definitions (Cost balanced for RCL 5 energy capacity)
    BODY_WORKER: [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE], // 550 Energy
    BODY_UPGRADER: [WORK, WORK, CARRY, CARRY, MOVE, MOVE],           // 400 Energy
    BODY_BUILDER: [WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE],      // 450 Energy
    BODY_CLAIMER: [CLAIM, MOVE, MOVE],                               // 700 Energy

    // The target room identifier for expansion/reservation
    TARGET_ROOM: 'E58S55'
};

/**
 * MAIN LOOP
 * ---------
 * Executed every game tick.
 */
module.exports.loop = function () {

    /**
     * 1. MEMORY MANAGEMENT
     * --------------------
     * Automatically clears memory of deceased creeps to prevent data bloat 
     * and naming collisions.
     */
    for (let name in Memory.creeps) {
        if (!Game.creeps[name]) {
            delete Memory.creeps[name];
        }
    }

    /**
     * 2. TOWER OPERATIONS
     * -------------------
     * Automated Defense & Maintenance.
     * Priority 1: Fire at hostile intruders within range.
     * Priority 2: Repair structures (excluding walls) if energy levels are > 500.
     */
    const towers = _.filter(Game.structures, s => s.structureType == STRUCTURE_TOWER);
    for(let tower of towers) {
        let hostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
        if(hostile) {
            // Combat mode: Immediate fire
            tower.attack(hostile);
        } else if (tower.store.getUsedCapacity(RESOURCE_ENERGY) > 500) {
            // Maintenance mode: Repair damaged roads/containers
            let damaged = tower.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: (s) => s.hits < s.hitsMax && s.structureType != STRUCTURE_WALL
            });
            if(damaged) tower.repair(damaged);
        }
    }

    /**
     * 3. CENSUS LOGGING
     * -----------------
     * Tracks current population vs. targets.
     * Logs to console every 20 ticks to reduce output noise.
     */
    const harvesters = _.filter(Game.creeps, (c) => c.memory.role == 'harvester');
    const upgraders = _.filter(Game.creeps, (c) => c.memory.role == 'upgrader');
    const builders = _.filter(Game.creeps, (c) => c.memory.role == 'builder');
    const claimers = _.filter(Game.creeps, (c) => c.memory.role == 'claimer');

    if (Game.time % 20 === 0) {
        console.log(`[${Game.time}] 🔋 ${Game.spawns['Spawn1'].room.energyAvailable} NRG | H:${harvesters.length} U:${upgraders.length} B:${builders.length} C:${claimers.length}`);
    }

    /**
     * 4. SMART SPAWNING
     * -----------------
     * A prioritized queue that ensures the economy restarts if it crashes.
     */
    const spawn = Game.spawns['Spawn1'];
    if (spawn && !spawn.spawning) {
        let role = null;
        let body = null;
        let memory = {};

        // PRIORITY 1: Emergency Harvesters (Economy Restart)
        if (harvesters.length < 2) { 
            role = 'harvester'; body = [WORK, CARRY, MOVE]; 
        }
        // PRIORITY 2: Emergency Upgrader (Prevent GCL Decay)
        else if (upgraders.length === 0) { 
            role = 'upgrader'; body = [WORK, CARRY, MOVE]; 
        }
        // PRIORITY 3: Builders (Construction Sites)
        else if (spawn.room.find(FIND_CONSTRUCTION_SITES).length > 0 && builders.length < CONFIG.MAX_BUILDERS) {
            role = 'builder'; body = CONFIG.BODY_BUILDER;
        }
        // PRIORITY 4: Full-size Harvesters (Optimization)
        else if (harvesters.length < CONFIG.MAX_HARVESTERS) {
            role = 'harvester'; body = CONFIG.BODY_WORKER;
        }
        // PRIORITY 5: Full-size Upgraders
        else if (upgraders.length < CONFIG.MAX_UPGRADERS) {
            role = 'upgrader'; body = CONFIG.BODY_UPGRADER;
        }
        // PRIORITY 6: Expansion (Claimer)
        else if (claimers.length < CONFIG.MAX_CLAIMERS && spawn.room.energyCapacityAvailable >= 700) {
            role = 'claimer'; body = CONFIG.BODY_CLAIMER; memory = { target: CONFIG.TARGET_ROOM };
        }

        // EXECUTION: Start the spawn if a role was selected
        if (role && body) {
            // For workers, assign a specific source to balance load and prevent traffic.
            if (role !== 'claimer') {
                let sources = spawn.room.find(FIND_SOURCES);
                let bestSource = _.sortBy(sources, s => _.filter(Game.creeps, c => c.memory.targetSourceId === s.id).length)[0];
                memory.targetSourceId = bestSource.id;
            }
            
            memory.role = role;
            let name = role.charAt(0).toUpperCase() + role.slice(1) + '_' + Game.time;
            
            // Validation: Only log if the spawn was successful (prevents console spam).
            if (spawn.spawnCreep(body, name, { memory: memory }) === OK) {
                console.log(`🛠️ Spawning: ${name}`);
            }
        }
    }

    /**
     * 5. AGENT EXECUTION
     * ------------------
     * Iterates through all living creeps and executes their role-specific logic.
     */
    for (let name in Game.creeps) {
        let creep = Game.creeps[name];
        if (creep.memory.role == 'harvester') roleHarvester.run(creep);
        if (creep.memory.role == 'upgrader') roleUpgrader.run(creep);
        if (creep.memory.role == 'builder') roleBuilder.run(creep);
        if (creep.memory.role == 'claimer') roleClaimer.run(creep);
    }
};