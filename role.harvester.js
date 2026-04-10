/**
 * role.harvester.js - SCOS v6.2.0
 * Fix: Strict Delivery Priority (Extensions > Storage > Containers)
 */
module.exports = {
    run: function(creep) {
        const targetRoom = creep.memory.targetRoom;
        if (targetRoom && creep.room.name !== targetRoom) {
            const exit = creep.pos.findClosestByRange(creep.room.findExitTo(targetRoom));
            if (exit) creep.moveTo(exit, { visualizePathStyle: { stroke: '#ffaa00' } });
            return;
        }

        if (creep.store.getFreeCapacity() > 0) {
            let source = Game.getObjectById(creep.memory.targetSourceId);
            if (!source) {
                source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
            }
            
            if (source && creep.harvest(source) === ERR_NOT_IN_RANGE) {
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
                // Idle at a safe spot locally if nowhere to put energy
                creep.say('Full');
                let source = Game.getObjectById(creep.memory.targetSourceId);
                if (source) {
                    if (!creep.pos.inRangeTo(source, 3)) creep.moveTo(source, { range: 3, visualizePathStyle: { stroke: '#555555' } });
                } else if (creep.room.controller) {
                    if (!creep.pos.inRangeTo(creep.room.controller, 3)) creep.moveTo(creep.room.controller, { range: 3, visualizePathStyle: { stroke: '#555555' } });
                }
            }
        }
    }
};