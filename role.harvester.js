/**
 * Role: Harvester v3.2
 * Logic: Harvests from assigned source, delivers to Spawn/Extensions/Tower.
 */
module.exports = {
    run: function(creep) {
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.working = false;
            creep.say('Mine');
        }
        if (!creep.memory.working && creep.store.getFreeCapacity() == 0) {
            creep.memory.working = true;
            creep.say('Give');
        }

        if (creep.memory.working) {
            var targets = creep.room.find(FIND_STRUCTURES, {
                filter: (s) => {
                    return (s.structureType == STRUCTURE_EXTENSION || 
                            s.structureType == STRUCTURE_SPAWN ||
                            s.structureType == STRUCTURE_TOWER) && 
                            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            });

            if (targets.length > 0) {
                var target = creep.pos.findClosestByRange(targets);
                if (creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, {visualizePathStyle: {stroke: '#ffffff'}});
                } else if (creep.transfer(target, RESOURCE_ENERGY) != OK) {
                     delete creep.memory.targetId;
                }
            } else {
                if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(creep.room.controller);
                }
            }
        } else {
            var source = Game.getObjectById(creep.memory.targetSourceId);
            if (!source) {
                source = creep.pos.findClosestByRange(FIND_SOURCES);
            }
            
            if (creep.harvest(source) == ERR_NOT_IN_RANGE) {
                creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
            } else if (creep.harvest(source) != OK) {
                 delete creep.memory.targetSourceId;
            }
        }
    }
};