/**
 * role.scout.js - SCOS Mapper
 * Deckt neue Räume auf und trägt sie in Memory.inventory ein.
 */
const inventory = require('utils.inventory');
const rooms = require('config.rooms');

module.exports = {
    run: function(creep) {
        // Auto-Recycle Reset Logic
        if (creep.memory.lastIdleTick !== Game.time - 1) creep.memory.idleCount = 0;

        // --- ÜBERLEBENS-REFLEX (Flee) ---
        if (creep.hits < creep.hitsMax) {
            creep.say('FLEE!');
            if (Memory.inventory && Memory.inventory.rooms[creep.room.name]) {
                Memory.inventory.rooms[creep.room.name].dangerUntil = Game.time + 1500; // Raum für ~1 Stunde sperren
            }
            
            // Fliehe zum nächsten Ausgang, um den Raum sofort zu verlassen
            const exit = creep.pos.findClosestByPath(FIND_EXIT) || creep.pos.findClosestByRange(FIND_EXIT);
            if (exit) creep.moveTo(exit, { visualizePathStyle: {stroke: '#ff0000'} });
            
            creep.memory.targetRoom = null; // Ziel löschen, damit er nach der Flucht neu plant
            return;
        }

        // 1. Raum abscannen
        if (creep.memory.lastRoom !== creep.room.name) {
            inventory.scanRoom(creep.room);
            creep.memory.lastRoom = creep.room.name;
            creep.say('Scan');
        }

        // BORDER BOUNCE FIX
        if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
            creep.moveTo(new RoomPosition(25, 25, creep.room.name));
            return;
        }

        // 2. Nächstes Ziel suchen (ältester Scan)
        if (!creep.memory.targetRoom || creep.room.name === creep.memory.targetRoom) {
            const exits = Game.map.describeExits(creep.room.name);
            let bestRoom = null;
            let oldestScan = Infinity;

            for (const dir in exits) {
                const nextRoom = exits[dir];
                if (rooms.BLACKLIST && rooms.BLACKLIST.includes(nextRoom)) continue;

                const roomData = Memory.inventory && Memory.inventory.rooms[nextRoom];
                if (roomData) {
                    // Gefährliche Räume überspringen
                    if (roomData.dangerUntil && Game.time < roomData.dangerUntil) continue;
                    if (roomData.hostileTowers > 0 && !roomData.my && (Game.time - roomData.lastUpdated < 10000)) continue;
                }

                const scanTime = roomData ? roomData.lastUpdated : 0;
                
                if (scanTime < oldestScan) {
                    oldestScan = scanTime;
                    bestRoom = nextRoom;
                }
            }
            if (bestRoom) creep.memory.targetRoom = bestRoom;
        }

        if (creep.memory.targetRoom) {
            creep.moveTo(new RoomPosition(25, 25, creep.memory.targetRoom), { visualizePathStyle: {stroke: '#ff00ff'}, reusePath: 50 });
        }
    }
};