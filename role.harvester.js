/**
 * Role: Harvester v3.8 (Sticky)
 * Logic: Harvests from assigned source. NEVER forgets source assignment.
 * Fix: Removed the memory deletion that caused "hopping".
 */
module.exports = {
    run: function(creep) {
        // 1. STATE SWITCH
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.working = false;
            creep.say('Mine');
        }
        if (!creep.memory.working && creep.store.getFreeCapacity() == 0) {
            creep.memory.working = true;
            creep.say('Give');
        }

        // 2. WORKING (Delivering)
        if (creep.memory.working) {
            // Prioritize crucial structures
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
                }
                // FIX: Removed "delete creep.memory.targetId". 
                // If transfer fails, we retry next tick. We do not panic.
            } else {
                // If base is full, help upgrade
                if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(creep.room.controller);
                }
            }
        } 
        // 3. MINING (Harvesting)
        else {
            // Failsafe: If somehow we have no source, find one nearby
            if (!creep.memory.targetSourceId) {
                let source = creep.pos.findClosestByRange(FIND_SOURCES);
                if (source) creep.memory.targetSourceId = source.id;
            }

            var source = Game.getObjectById(creep.memory.targetSourceId);
            
            if (source) {
                if (creep.harvest(source) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
                }
                // FIX: Removed the "else { delete... }" block.
                // Even if the source is empty (Regenerating), we WAIT.
                // Walking away is inefficient.
            }
        }
    }
};