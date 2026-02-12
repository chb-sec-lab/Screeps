/**
 * role.hauler.js - SCOS v6.0.1
 * Updated: 2026-02-11 21:25 CET (Amsterdam)
 */
const rooms = require('config.rooms');
module.exports = {
    run: function(creep) {
        if (creep.room.name !== rooms.HOME) {
            creep.moveTo(creep.pos.findClosestByRange(creep.room.findExitTo(rooms.HOME)));
            return;
        }
        if (creep.store.getUsedCapacity() === 0) {
            const storage = creep.room.storage;
            if (storage && storage.store[RESOURCE_ENERGY] > 0) {
                if (creep.withdraw(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(storage);
            }
        } else {
            const dest = creep.pos.findClosestByRange(FIND_STRUCTURES, { 
                filter: s => (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0 
            });
            if (dest) { if (creep.transfer(dest, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(dest); }
        }
    }
};