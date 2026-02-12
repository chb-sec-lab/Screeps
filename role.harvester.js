/**
 * role.harvester.js - SCOS v6.0.1
 * Updated: 2026-02-11 21:25 CET (Amsterdam)
 * Fix: Fallback for unassigned sources.
 */
module.exports = {
    run: function(creep) {
        if (creep.store.getFreeCapacity() > 0) {
            let source = Game.getObjectById(creep.memory.targetSourceId);
            if (!source) source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
            
            if (source) {
                if (creep.harvest(source) === ERR_NOT_IN_RANGE) creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
            }
        } else {
            const dest = creep.room.storage || creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: s => (s.structureType == STRUCTURE_SPAWN || s.structureType == STRUCTURE_EXTENSION) && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            });
            if (dest) {
                if (creep.transfer(dest, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(dest);
            }
        }
    }
};