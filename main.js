/**
 * SCOS Kernel v3.9 - Clear Logging & Phalanx Integration
 * ---------------------------------------
 * Logic: Sticky Harvesting, Burst Mode, Phalanx Squads.
 * Updates: 
 * - Console output is now plain text, structured tables.
 * - Integration of Phalanx logic (Dismantler/Defender/Healer coordination).
 */

const roleHarvester = require('role.harvester');
const roleUpgrader = require('role.upgrader');
const roleBuilder = require('role.builder');
const roleClaimer = require('role.claimer');
const roleDismantler = require('role.dismantler');
const roleHealer = require('role.healer');
const roleDefender = require('role.defender');
const roleRemoteMiner = require('role.remoteMiner');

const CONFIG = {
    MAX_HARVESTERS: 8,
    MAX_UPGRADERS: 3,
    MAX_BUILDERS: 3, 
    MAX_CLAIMERS: 1,
    MAX_DISMANTLERS: 1, 
    MAX_HEALERS: 2,
    MAX_DEFENDERS: 3,
    MAX_REMOTE_MINERS: 2,

    TARGET_ROOM: 'E58S55',
    HOME_ROOM: 'E58S54',
    
    // Balanced for Tier 3 Economy (Extension usage required)
    BODY_WORKER: [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE], 
    BODY_DISMANTLER: [TOUGH, TOUGH, TOUGH, WORK, WORK, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE], 
    BODY_HEALER: [MOVE, MOVE, MOVE, MOVE, HEAL, HEAL, HEAL, HEAL], 
    BODY_TANK: [TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL],
    BODY_SONIC_CLAIMER: [CLAIM, MOVE, MOVE, MOVE, MOVE, MOVE],
    BODY_REMOTE_MINER: [WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE]
};

module.exports.loop = function () {

    // 1. MEMORY CLEANUP
    for (let name in Memory.creeps) {
        if (!Game.creeps[name]) delete Memory.creeps[name];
    }

    // 2. SINGLE-PASS CENSUS
    const census = {
        harvester: 0, upgrader: 0, builder: 0,
        claimer: 0, dismantler: 0, healer: 0, defender: 0,
        remoteMiner: 0, total: 0
    };

    const harvestersWithSource = {}; 
    const spawn = Game.spawns['Spawn1'];
    const homeRoomName = spawn ? spawn.room.name : CONFIG.HOME_ROOM;

    for (let name in Game.creeps) {
        let creep = Game.creeps[name];
        census.total++;
        if (census[creep.memory.role] !== undefined) {
            census[creep.memory.role]++;
        }
        
        if (creep.memory.role === 'harvester' && creep.memory.targetSourceId) {
            harvestersWithSource[creep.memory.targetSourceId] = (harvestersWithSource[creep.memory.targetSourceId] || 0) + 1;
        }

        // --- SQUAD SYNCHRONIZATION ---
        if (['dismantler', 'healer', 'defender'].includes(creep.memory.role)) {
            const isSquadReady = (census.dismantler >= 1 && census.healer >= 1 && census.defender >= 1);
            
            if (isSquadReady) {
                creep.memory.target = CONFIG.TARGET_ROOM;
                // Visuals on map are still useful, keep them subtle
                new RoomVisual(creep.room.name).text("ATTACK", creep.pos.x, creep.pos.y - 0.5, {color: 'red', font: 0.4});
            } else {
                creep.memory.target = homeRoomName; 
                new RoomVisual(creep.room.name).text("WAIT", creep.pos.x, creep.pos.y - 0.5, {color: 'cyan', font: 0.4});
            }
        }

        // 3. EXECUTION 
        try {
            if (creep.memory.role == 'harvester') roleHarvester.run(creep);
            if (creep.memory.role == 'upgrader') roleUpgrader.run(creep);
            if (creep.memory.role == 'builder') roleBuilder.run(creep);
            if (creep.memory.role == 'claimer') roleClaimer.run(creep);
            if (creep.memory.role == 'dismantler') roleDismantler.run(creep);
            if (creep.memory.role == 'healer') roleHealer.run(creep);
            if (creep.memory.role == 'defender') roleDefender.run(creep);
            if (creep.memory.role == 'remoteMiner') roleRemoteMiner.run(creep);
        } catch (e) {
            console.log(`ERROR: Creep ${name} failed: ${e.stack}`);
        }
    }

    // 4. TOWER DEFENSE
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

    // 5. USER-FRIENDLY LOGGING
    if (Game.time % 10 === 0 && spawn) {
        const energy = spawn.room.energyAvailable;
        const cap = spawn.room.energyCapacityAvailable;
        const pct = Math.floor((energy / cap) * 100);
        
        console.log(`----- Tick ${Game.time} Report -----`);
        console.log(`Energy Level  : ${energy} / ${cap} (${pct}%)`);
        
        console.log(`Economy Units : Harvesters[${census.harvester}/${CONFIG.MAX_HARVESTERS}] Builders[${census.builder}/${CONFIG.MAX_BUILDERS}] Upgraders[${census.upgrader}/${CONFIG.MAX_UPGRADERS}]`);
        console.log(`Remote Mining : Miners[${census.remoteMiner}/${CONFIG.MAX_REMOTE_MINERS}]`);
        
        // Squad Status Logic
        let squadStatus = "Inactive";
        if (census.dismantler > 0 || census.defender > 0 || census.healer > 0) {
            if (census.dismantler >= 1 && census.healer >= 1 && census.defender >= 1) {
                squadStatus = "PHALANX FORMED - ATTACKING";
            } else {
                squadStatus = "MUSTERING - Waiting for reinforcements";
            }
        }
        console.log(`Military      : Dismantler[${census.dismantler}] Defender[${census.defender}] Healer[${census.healer}] | Status: ${squadStatus}`);
        
        if (spawn.spawning) {
            const spawningCreep = Game.creeps[spawn.spawning.name];
            console.log(`Construction  : Spawning ${spawningCreep ? spawningCreep.memory.role : 'unknown'}... (${spawn.spawning.remainingTime} ticks remaining)`);
        }
        console.log(`-----------------------------------`);
    }

    // 6. SPAWNING LOGIC (Burst Mode)
    if (spawn && !spawn.spawning) {
        let role = null; let body = null; let memory = {};
        
        const energy = spawn.room.energyAvailable;
        const capacity = spawn.room.energyCapacityAvailable;
        const BURST_THRESHOLD = capacity * 0.90; 

        // Priority 1: Crash Recovery
        if (census.harvester < 4) {
            role = 'harvester'; body = [WORK, CARRY, MOVE];
        }
        // Priority 2: Economic Base
        else if (census.harvester < CONFIG.MAX_HARVESTERS) {
            role = 'harvester'; body = CONFIG.BODY_WORKER;
        }
        // Priority 3: Infrastructure
        else if (census.builder < CONFIG.MAX_BUILDERS && spawn.room.find(FIND_CONSTRUCTION_SITES).length > 0) {
            role = 'builder'; body = CONFIG.BODY_WORKER;
        }
        // Priority 4: Military (Phalanx)
        else if (census.dismantler < CONFIG.MAX_DISMANTLERS) {
            if (energy >= BURST_THRESHOLD || (census.dismantler > 0 || census.defender > 0)) {
                 if (energy >= 1150) { role = 'dismantler'; body = CONFIG.BODY_DISMANTLER; memory.target = CONFIG.TARGET_ROOM; }
            }
        }
        else if (census.healer < CONFIG.MAX_HEALERS) {
             if (energy >= 1200) { role = 'healer'; body = CONFIG.BODY_HEALER; memory.target = CONFIG.TARGET_ROOM; }
        }
        else if (census.defender < CONFIG.MAX_DEFENDERS) {
             if (energy >= 1180) { role = 'defender'; body = CONFIG.BODY_TANK; memory.target = CONFIG.TARGET_ROOM; }
        }
        // Priority 5: Expansion
        else if (census.claimer < CONFIG.MAX_CLAIMERS && (census.defender > 0)) {
            if (energy >= 850) { role = 'claimer'; body = CONFIG.BODY_SONIC_CLAIMER; memory.target = CONFIG.TARGET_ROOM; }
        }
        // Priority 6: Remote Economy
        else if (census.remoteMiner < CONFIG.MAX_REMOTE_MINERS) {
            if (energy >= 700) { role = 'remoteMiner'; body = CONFIG.BODY_REMOTE_MINER; memory.target = CONFIG.TARGET_ROOM; }
        }
        // Priority 7: Upgrades
        else if (census.upgrader < CONFIG.MAX_UPGRADERS) {
            role = 'upgrader'; body = CONFIG.BODY_WORKER;
        }

        if (role) {
            memory.role = role;
            memory.home = homeRoomName;
            
            if (role === 'harvester') {
                let sources = spawn.room.find(FIND_SOURCES);
                let bestSource = _.sortBy(sources, s => (harvestersWithSource[s.id] || 0))[0];
                if (bestSource) {
                    memory.targetSourceId = bestSource.id;
                    harvestersWithSource[bestSource.id] = (harvestersWithSource[bestSource.id] || 0) + 1;
                }
            }
            
            if (spawn.spawnCreep(body, role + '_' + Game.time, { memory: memory }) === OK) {
                console.log(`[SYSTEM] Started spawning: ${role}`);
            }
        }
    }
};