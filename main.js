/**
 * Main Loop - Phase 2 (Load Balancer & Stability)
 * * CHANGES:
 * 1. Smart Spawning: Assigns a specific Source ID to every new creep.
 * 2. Census: Logs detailed stats to the console.
 * 3. Resilience: Auto-recovers if all creeps die.
 */

var roleHarvester = require('role.harvester');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');
var roleClaimer = require('role.claimer');

const CONFIG = {
    // Limits (Keep these the same!)
    MAX_HARVESTERS: 8,
    MAX_UPGRADERS: 3,
    MAX_BUILDERS: 3,
    MAX_CLAIMERS: 1,

    // NEW "LEVEL 2" BODIES (Requires ~550 Energy)
    // Stronger Harvester: Mined 2x faster
    BODY_WORKER: [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE], // Cost: 550
    
    // Stronger Upgrader: Upgrades 2x faster
    BODY_UPGRADER: [WORK, WORK, CARRY, CARRY, MOVE, MOVE],           // Cost: 400
    
    // Stronger Builder: Builds 2x faster
    BODY_BUILDER: [WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE],      // Cost: 450
    
    // Diplomat (Unchanged, requires 700)
    BODY_CLAIMER: [CLAIM, MOVE, MOVE],                               // Cost: 700

    TARGET_ROOM: 'E58S55'
};

module.exports.loop = function () {

    // --- 1. MEMORY CLEANUP ---
    // Clears memory of dead creeps to save CPU
    for (let name in Memory.creeps) {
        if (!Game.creeps[name]) {
            delete Memory.creeps[name];
        }
    }

    // --- 2. TOWER DEFENSE ---
    var spawn = Game.spawns['Spawn1'];
    if (spawn) {
        var towers = spawn.room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } });
        towers.forEach(tower => {
            var hostiles = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
            if (hostiles) {
                tower.attack(hostiles);
            } else if (tower.store.getUsedCapacity(RESOURCE_ENERGY) > 500) {
                // Only repair if we have excess energy
                var damaged = tower.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: (s) => s.hits < s.hitsMax && s.structureType != STRUCTURE_WALL
                });
                if (damaged) tower.repair(damaged);
            }
        });
    }

    // --- 3. CENSUS & LOGGING ---
    var harvesters = _.filter(Game.creeps, (c) => c.memory.role == 'harvester');
    var upgraders = _.filter(Game.creeps, (c) => c.memory.role == 'upgrader');
    var builders = _.filter(Game.creeps, (c) => c.memory.role == 'builder');
    var claimers = _.filter(Game.creeps, (c) => c.memory.role == 'claimer');

    // Log status every 10 ticks
    if (Game.time % 10 === 0 && spawn) {
        console.log(`[${Game.time}] 🔋 Energy: ${spawn.room.energyAvailable}/${spawn.room.energyCapacityAvailable} ` +
            `| H: ${harvesters.length}/${CONFIG.MAX_HARVESTERS} ` +
            `| U: ${upgraders.length}/${CONFIG.MAX_UPGRADERS} ` +
            `| B: ${builders.length}/${CONFIG.MAX_BUILDERS} ` +
            `| C: ${claimers.length}/${CONFIG.MAX_CLAIMERS}`);
    }

    // --- 4. SMART SPAWNING SYSTEM ---
    
    /**
     * Helper: Find the source with the fewest creeps assigned to it.
     */
    function getLeastUsedSource(room) {
        let sources = room.find(FIND_SOURCES);
        // Sort sources by how many living creeps have this source ID in memory
        return _.sortBy(sources, s => {
            return _.filter(Game.creeps, c => c.memory.targetSourceId === s.id).length;
        })[0];
    }

    if (spawn && !spawn.spawning) {
        let body = null;
        let role = null;
        let memory = {};

        // PRIORITY 1: Emergency Recovery (If < 2 Harvesters, spawn cheap one)
        if (harvesters.length < 2) {
            role = 'harvester';
            body = [WORK, CARRY, MOVE]; 
        }
        // PRIORITY 2: Emergency Upgrader (Prevent Controller Downgrade)
        else if (upgraders.length === 0) {
            role = 'upgrader';
            body = [WORK, CARRY, MOVE];
        }
        // PRIORITY 3: Builders (Only if sites exist)
        else if (spawn.room.find(FIND_CONSTRUCTION_SITES).length > 0 && builders.length < CONFIG.MAX_BUILDERS) {
            role = 'builder';
            body = CONFIG.BODY_BUILDER;
        }
        // PRIORITY 4: Fill Harvesters
        else if (harvesters.length < CONFIG.MAX_HARVESTERS) {
            role = 'harvester';
            body = CONFIG.BODY_WORKER;
        }
        // PRIORITY 5: Fill Upgraders
        else if (upgraders.length < CONFIG.MAX_UPGRADERS) {
            role = 'upgrader';
            body = CONFIG.BODY_UPGRADER;
        }
        // PRIORITY 6: Expansion
        else if (claimers.length < CONFIG.MAX_CLAIMERS && spawn.room.energyCapacityAvailable >= 700) {
            if (spawn.room.energyAvailable >= 700) {
                role = 'claimer';
                body = CONFIG.BODY_CLAIMER;
                memory = { target: CONFIG.TARGET_ROOM };
            }
        }

        // EXECUTE SPAWN
        if (role && body) {
            // Assign a persistent Source ID to workers so they don't bunch up
            if (role !== 'claimer') {
                let bestSource = getLeastUsedSource(spawn.room);
                memory.targetSourceId = bestSource.id;
            }
            
            memory.role = role;
            let newName = role.charAt(0).toUpperCase() + role.slice(1) + '_' + Game.time;
            
            console.log(`🛠️ Spawning ${newName} (Source: ${memory.targetSourceId ? memory.targetSourceId.substr(-4) : 'None'})`);
            spawn.spawnCreep(body, newName, { memory: memory });
        }
    }

    // --- 5. EXECUTE ROLES ---
    for (let name in Game.creeps) {
        var creep = Game.creeps[name];
        if (creep.memory.role == 'harvester') roleHarvester.run(creep);
        if (creep.memory.role == 'upgrader') roleUpgrader.run(creep);
        if (creep.memory.role == 'builder') roleBuilder.run(creep);
        if (creep.memory.role == 'claimer') roleClaimer.run(creep);
    }
};