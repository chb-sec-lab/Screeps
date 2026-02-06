// --- MODULE IMPORTS ---
var roleHarvester = require('role.harvester');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');
var roleClaimer = require('role.claimer');

// --- CONFIGURATION ---
const CONFIG = {
    MAX_HARVESTERS: 10,
    MAX_UPGRADERS: 5,   // Reduziert für Stabilität
    MAX_BUILDERS: 2,    // Nur spawnen, wenn Baustellen da sind
    MAX_CLAIMERS: 1,    
    
    // Body Parts
    BODY_WORKER: [WORK, WORK, CARRY, MOVE],
    BODY_UPGRADER: [WORK, CARRY, MOVE, MOVE],
    BODY_BUILDER: [WORK, WORK, CARRY, MOVE],
    BODY_CLAIMER: [CLAIM, MOVE, MOVE],
    
    TARGET_ROOM: 'E58S57' // Dein Zielraum für Expansion
};

// --- HELPER: Rate-Limited Notifications ---
function notifyOnce(key, message) {
    if (!Memory.notifications) Memory.notifications = {};
    // Nur alle 1500 Ticks (ca. 1-2 Std) benachrichtigen
    if (!Memory.notifications[key] || Game.time - Memory.notifications[key] > 1500) {
         console.log('🚨 ALERT:', message);
         Game.notify(message); // E-Mail / Steam Notification
         Memory.notifications[key] = Game.time;
    }
}

module.exports.loop = function () {

    // --- 1. MEMORY CLEANUP ---
    for (let name in Memory.creeps) {
        if (!Game.creeps[name]) {
            delete Memory.creeps[name];
            console.log('Clearing non-existing creep memory:', name);
        }
    }

    // --- 2. POPULATION CENSUS ---
    var harvesters = _.filter(Game.creeps, (c) => c.memory.role == 'harvester');
    var upgraders = _.filter(Game.creeps, (c) => c.memory.role == 'upgrader');
    var builders = _.filter(Game.creeps, (c) => c.memory.role == 'builder');
    var claimers = _.filter(Game.creeps, (c) => c.memory.role == 'claimer');

    // --- 3. OBSERVABILITY (DASHBOARD) ---
    // Alle 50 Ticks einen Statusbericht ins Log schreiben
    if (Game.time % 50 === 0) {
        console.log(`📊 STATUS | Energy: ${Game.spawns['Spawn1'].room.energyAvailable} | H:${harvesters.length} U:${upgraders.length} B:${builders.length} C:${claimers.length}`);
    }

    // --- 4. SAFETY ALERTS ---
    // Alarm, wenn gar keine Creeps mehr leben (Totalausfall)
    if (Object.keys(Game.creeps).length === 0) {
        notifyOnce('critical_collapse', 'CRITICAL: Colony has 0 creeps! Manual intervention required.');
    }

    // --- 5. SPAWNING LOGIC ---
    var spawn = Game.spawns['Spawn1'];
    // Prüfen, ob Baustellen existieren
    var constructionSites = spawn.room.find(FIND_CONSTRUCTION_SITES);

    if (!spawn.spawning) {
        
        // Prio 1: Harvester (Überleben sichern)
        if (harvesters.length < CONFIG.MAX_HARVESTERS) {
            var newName = 'Harvester' + Game.time;
            spawn.spawnCreep(CONFIG.BODY_WORKER, newName, { memory: { role: 'harvester' } });
        }
        // Prio 2: Upgrader (aber limitiert!)
        else if (upgraders.length < CONFIG.MAX_UPGRADERS) {
            var newName = 'Upgrader' + Game.time;
            spawn.spawnCreep(CONFIG.BODY_UPGRADER, newName, { memory: { role: 'upgrader' } });
        }
        // Prio 3: Builder (Nur wenn Baustellen da sind UND Limit nicht erreicht)
        else if (constructionSites.length > 0 && builders.length < CONFIG.MAX_BUILDERS) {
            var newName = 'Builder' + Game.time;
            console.log('Spawning new builder: ' + newName);
            spawn.spawnCreep(CONFIG.BODY_BUILDER, newName, { memory: { role: 'builder' } });
        }
        // Prio 4: Claimer (Expansion)
        else if (claimers.length < CONFIG.MAX_CLAIMERS && spawn.room.energyCapacityAvailable >= 700) {
            if (spawn.room.energyAvailable >= 700) {
                var newName = 'Diplomat' + Game.time;
                spawn.spawnCreep(CONFIG.BODY_CLAIMER, newName, { 
                    memory: { role: 'claimer', target: CONFIG.TARGET_ROOM } 
                });
            }
        }
    }

    // Visualisierung am Spawn
    if (spawn.spawning) {
        var spawningCreep = Game.creeps[spawn.spawning.name];
        spawn.room.visual.text('🛠️' + spawningCreep.memory.role, spawn.pos.x + 1, spawn.pos.y, {align: 'left', opacity: 0.8});
    }

    // --- 6. CREEP EXECUTION ---
    for (let name in Game.creeps) {
        var creep = Game.creeps[name];
        
        if (creep.memory.role == 'harvester') {
            roleHarvester.run(creep);
        }
        if (creep.memory.role == 'upgrader') {
            roleUpgrader.run(creep);
        }
        if (creep.memory.role == 'builder') {
            roleBuilder.run(creep);
        }
        if (creep.memory.role == 'claimer') {
            roleClaimer.run(creep);
        }
    }
};