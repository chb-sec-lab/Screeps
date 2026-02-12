/**
 * role.builder.js - SCOS v6.1.1
 * Updated: 2026-02-11 23:02 CET (Amsterdam)
 * Role: Infrastructure & Cross-Room Maintenance
 * Update: Added target-room construction search.
 */
const rooms = require('config.rooms');

module.exports = {
    run: function(creep) {
        if (creep.memory.building && creep.store[RESOURCE_ENERGY] === 0) creep.memory.building = false;
        if (!creep.memory.building && creep.store.getFreeCapacity() === 0) creep.memory.building = true;

        if (creep.memory.building) {
            // 1. Critical Repair (Current Room)
            const critical = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: s => (s.structureType == STRUCTURE_ROAD || s.structureType == STRUCTURE_CONTAINER) && s.hits < (s.hitsMax * 0.7)
            });
            if (critical) {
                if (creep.repair(critical) == ERR_NOT_IN_RANGE) creep.moveTo(critical, {visualizePathStyle: {stroke: '#00ff00'}});
                return;
            }

            // 2. Construction Sites (Current Room)
            const site = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
            if (site) {
                if (creep.build(site) === ERR_NOT_IN_RANGE) creep.moveTo(site, {visualizePathStyle: {stroke: '#00ff00'}});
                return;
            }

            // 3. Expansion Search: If nothing in Home, check Target
            if (creep.room.name === rooms.HOME) {
                // Move to target room if work exists there (or to check)
                const targetExit = creep.pos.findClosestByRange(creep.room.findExitTo(rooms.TARGET));
                creep.moveTo(targetExit);
                creep.say('🚜 Expansion');
            } else {
                // If in Target and nothing to do, return Home
                const homeExit = creep.pos.findClosestByRange(creep.room.findExitTo(rooms.HOME));
                creep.moveTo(homeExit);
                creep.say('🏠 Home');
            }
        } else {
            // Energy Gathering
            const src = creep.room.storage || creep.pos.findClosestByRange(FIND_SOURCES_ACTIVE);
            if (src) {
                const action = (src instanceof Structure) ? creep.withdraw(src, RESOURCE_ENERGY) : creep.harvest(src);
                if (action === ERR_NOT_IN_RANGE) creep.moveTo(src, {visualizePathStyle: {stroke: '#ffffff'}});
            }
        }
    }
};