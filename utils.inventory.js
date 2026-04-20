/**
 * utils.inventory.js - SCOS Room Inventory
 * Entkoppelt die Raum-Analyse von der Entscheidungslogik, spart CPU und verhindert Deadlocks.
 */
module.exports = {
    run: function() {
        if (!Memory.inventory) Memory.inventory = { rooms: {}, lastRun: 0 };
        
        // Run full inventory every 20 ticks to save CPU
        if (Game.time % 20 !== 0 && Memory.inventory.lastRun !== 0) return;
        
        for (let roomName in Game.rooms) {
            this.scanRoom(Game.rooms[roomName]);
        }
        Memory.inventory.lastRun = Game.time;
    },

    scanRoom: function(room) {
        if (!Memory.inventory) Memory.inventory = { rooms: {}, lastRun: 0 };
        Memory.inventory.rooms[room.name] = {
            visible: true,
            my: room.controller ? room.controller.my : false,
            rcl: room.controller ? room.controller.level : 0,
            reservation: room.controller && room.controller.reservation ? room.controller.reservation.username : null,
            spawns: room.find(FIND_MY_SPAWNS).length,
            extensions: room.find(FIND_MY_STRUCTURES, {filter: s => s.structureType === STRUCTURE_EXTENSION}).length,
            towers: room.find(FIND_MY_STRUCTURES, {filter: s => s.structureType === STRUCTURE_TOWER}).length,
            containers: room.find(FIND_STRUCTURES, {filter: s => s.structureType === STRUCTURE_CONTAINER}).length,
            overflowingContainers: room.find(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_CONTAINER && s.store.getUsedCapacity(RESOURCE_ENERGY) > 1800
            }).length,
            storage: room.storage ? 1 : 0,
            terminal: room.terminal ? 1 : 0,
            extractors: room.find(FIND_STRUCTURES, {filter: s => s.structureType === STRUCTURE_EXTRACTOR}).length,
            labs: room.find(FIND_MY_STRUCTURES, {filter: s => s.structureType === STRUCTURE_LAB}).length,
            hostileTowers: room.find(FIND_HOSTILE_STRUCTURES, {filter: s => s.structureType === STRUCTURE_TOWER}).length,
            hostileCreeps: room.find(FIND_HOSTILE_CREEPS).length,
            sources: room.find(FIND_SOURCES).length,
            mineralAmount: room.find(FIND_MINERALS)[0] ? room.find(FIND_MINERALS)[0].amount : 0,
            mineralType: room.find(FIND_MINERALS)[0] ? room.find(FIND_MINERALS)[0].mineralType : null,
            constructionSites: room.find(FIND_CONSTRUCTION_SITES).length,
            droppedEnergy: room.find(FIND_DROPPED_RESOURCES, {filter: r => r.resourceType === RESOURCE_ENERGY && r.amount >= 50}).length,
            lastUpdated: Game.time
        };
    }
};