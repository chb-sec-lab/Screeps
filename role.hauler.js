/**
 * role.hauler.js - SCOS v6.0.3
 * Updated: 2026-02-13 11:15 CET (Europe/Amsterdam)
 *
 * Priorities (deliver):
 *  1) Towers (keep high, target ~90%+)
 *  2) Spawn/extensions
 *  3) Storage
 *
 * Priorities (withdraw):
 *  - Prefer containers (to keep them empty), then storage
 */
const rooms = require('config.rooms');

module.exports = {
    run: function (creep) {

        if (creep.room.name !== rooms.HOME) {
            const exit = creep.pos.findClosestByRange(creep.room.findExitTo(rooms.HOME));
            creep.moveTo(exit);
            return;
        }

        const storage = creep.room.storage;

        // --- If empty: withdraw (containers first, then storage) ---
        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
            let src = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s =>
                    s.structureType === STRUCTURE_CONTAINER &&
                    s.store &&
                    s.store[RESOURCE_ENERGY] > 0
            });

            if (!src && storage && storage.store[RESOURCE_ENERGY] > 0) src = storage;

            if (src) {
                if (creep.withdraw(src, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(src);
                }
            } else {
                creep.say('🚫E');
            }
            return;
        }

        // --- If carrying: deliver by priority ---

        // 1) Towers first: keep them near full
        const towersNeed = creep.room.find(FIND_STRUCTURES, {
            filter: s =>
                s.structureType === STRUCTURE_TOWER &&
                s.store.getFreeCapacity(RESOURCE_ENERGY) > 0 &&
                s.store[RESOURCE_ENERGY] < s.store.getCapacity(RESOURCE_ENERGY) * 0.90
        });

        if (towersNeed.length) {
            const t = creep.pos.findClosestByPath(towersNeed);
            if (t && creep.transfer(t, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(t);
            return;
        }

        // 2) Spawn/extensions
        const spawnExt = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: s =>
                (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) &&
                s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });

        if (spawnExt) {
            if (creep.transfer(spawnExt, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(spawnExt);
            return;
        }

        // 3) Storage
        if (storage && storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
            if (creep.transfer(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(storage);
            return;
        }

        creep.say('💤');
    }
};
