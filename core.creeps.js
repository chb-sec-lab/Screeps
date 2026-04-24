/**
 * core.creeps.js - SCOS Population Lifecycle
 * Führt Memory-Bereinigungen durch und ruft die eigentlichen Rollen-Skripte auf.
 */
const rooms = require('config.rooms');
const logger = require('utils.logger');

let modules = {};
const roleNames = ['harvester', 'hauler', 'remoteHauler', 'scavenger', 'repairer', 'defender', 'vanguard', 'medic', 'breacher', 'remoteMiner', 'builder', 'claimer', 'upgrader', 'healer', 'mineralMiner', 'chemist', 'scout'];

roleNames.forEach(name => {
    try { modules[name] = require('role.' + name); } catch (e) { /* Safe Load */ }
});

module.exports = {
    run: function(activeRegistry) {
        const defenseActive = Memory.defense && Memory.defense.activeUntil && Game.time <= Memory.defense.activeUntil;
        let recyclingCount = 0;

        // Bereinigung von toten Creeps
        for (let name in Memory.creeps) {
            if (!Game.creeps[name]) delete Memory.creeps[name];
        }

        for (let name in Game.creeps) {
            const creep = Game.creeps[name];
            
            if (creep.hits < (creep.memory.lastHits || creep.hitsMax)) logger.log(`⚠️ ATTACK: ${creep.name} in ${creep.room.name}!`, 'error');
            creep.memory.lastHits = creep.hits;

            if (creep.room) creep.room.visual.text(creep.memory.role, creep.pos.x, creep.pos.y + 0.4, { font: 0.3, color: '#a2b9d1', opacity: 0.8 });

            if (creep.memory.role === 'defender' || creep.memory.role === 'healer') {
                if (!defenseActive) creep.memory.recycle = true;
                else if (creep.memory.recycle) creep.memory.recycle = false;
            }

            if (creep.memory.recycle) {
                recyclingCount++;
                this.handleRecycle(creep);
                continue; 
            }

            let memoryPatched = false;
            for (let key in creep.memory) {
                if (['E57S55', 'E57S56', 'E58S55', 'E58S56', 'W8N8'].includes(creep.memory[key])) { 
                    if (!activeRegistry[creep.memory[key]]) {
                        creep.memory[key] = Memory.empire && Memory.empire.targetRoom ? Memory.empire.targetRoom : rooms.HOME;
                        memoryPatched = true;
                    }
                }
            }
            
            if (!creep.memory.targetRoom && !creep.memory.workRoom) {
                if (['hauler', 'builder', 'repairer', 'scavenger', 'mineralMiner', 'chemist'].includes(creep.memory.role)) creep.memory.workRoom = creep.memory.homeRoom || rooms.HOME;
                if (['harvester', 'upgrader', 'claimer', 'remoteMiner', 'remoteHauler'].includes(creep.memory.role)) creep.memory.targetRoom = rooms.HOME;
            }
            if (memoryPatched) delete creep.memory._move;

            if (creep.room.name === 'E57S55') {
                creep.say('EVAC');
                const evacExit = creep.pos.findClosestByRange(creep.room.findExitTo(rooms.MINING || rooms.HOME));
                if (evacExit) creep.moveTo(evacExit, { visualizePathStyle: { stroke: '#ff0000' } });
                continue; 
            }

            if (Game.cpu.getUsed() > Game.cpu.tickLimit * 0.8) {
                creep.say('CPU');
                continue; 
            }

            if (modules[creep.memory.role]) {
                try { modules[creep.memory.role].run(creep); } catch (e) { logger.log(`Error in role ${creep.memory.role}: ${e}`, 'error'); }
            }
        }
        return recyclingCount;
    },

    handleRecycle: function(creep) {
        creep.say('Recycle');
        if (creep.store.getUsedCapacity() > 0) {
            const resType = Object.keys(creep.store)[0];
            let sink = creep.room.storage || creep.pos.findClosestByRange(FIND_STRUCTURES, { filter: s => (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_CONTAINER) && s.store && s.store.getFreeCapacity(resType) > 0 });
            if (sink && creep.transfer(sink, resType) === ERR_NOT_IN_RANGE) { if (creep.moveTo(sink) === ERR_NO_PATH) creep.drop(resType); } else { creep.drop(resType); }
            return;
        }
        let spawn = creep.pos.findClosestByRange(FIND_MY_SPAWNS) || Object.values(Game.spawns)[0];
        if (spawn && creep.room.name === spawn.room.name) { if (spawn.recycleCreep(creep) === ERR_NOT_IN_RANGE) creep.moveTo(spawn); }
        else if (spawn) { if (creep.moveTo(new RoomPosition(25, 25, spawn.room.name), { reusePath: 50 }) === ERR_NO_PATH) creep.suicide(); } else creep.suicide();
    }
};