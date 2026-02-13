/**
 * role.harvester.js - SCOS v6.2.0
 * Fix: Strict Delivery Priority (Extensions > Storage > Containers)
 */
module.exports = {
    run: function(creep) {
        if (creep.store.getFreeCapacity() > 0) {
            const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
            if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
        } else {
            // 1. Priority: Vital Infrastructure (Spawn & Extensions)
            let target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (s) => {
                    return (s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_SPAWN) &&
                           s.energy < s.energyCapacity;
                }
            });

            // 2. Secondary: Storage
            if (!target) {
                target = creep.room.storage;
                if (target && target.store.getFreeCapacity(RESOURCE_ENERGY) === 0) target = null;
            }

            // 3. Tertiary: Containers
            if (!target) {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (s) => s.structureType === STRUCTURE_CONTAINER && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                });
            }

            if (target) {
                if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                }
            } else {
                // Idle at a safe spot if nowhere to put energy
                creep.moveTo(Game.spawns['Spawn1'], { range: 3 });
            }
        }
    }
};