/**
 * Role: Harvester
 * Description: Harvests energy and delivers it to Spawns and Extensions.
 * Smart Logic: Uses 'targetSourceId' from memory to avoid traffic jams.
 */

var roleHarvester = {
    /** @param {Creep} creep **/
    run: function(creep) {
        
        // --- 1. STATE MACHINE ---
        // If empty, start harvesting
        if (creep.store.getUsedCapacity() === 0) {
            creep.memory.working = false;
            creep.say('🔄 harvest');
        }
        // If full, start delivering
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            creep.say('⚡ deliver');
        }

        // --- 2. WORK LOGIC ---
        if (creep.memory.working) {
            // Find extensions or spawn that need energy
            var targets = creep.room.find(FIND_STRUCTURES, {
                filter: (s) => {
                    return (s.structureType == STRUCTURE_EXTENSION ||
                            s.structureType == STRUCTURE_SPAWN) &&
                            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            });

            if (targets.length > 0) {
                // Go to the closest one
                var closest = creep.pos.findClosestByRange(targets);
                if (creep.transfer(closest, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(closest, {visualizePathStyle: {stroke: '#ffffff'}});
                }
            } else {
                // If everything is full, upgrade controller so we don't idle
                if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#ffffff'}});
                }
            }
        } 
        else {
            // --- 3. HARVEST LOGIC (DISTRIBUTED) ---
            // Read the Source ID assigned by main.js
            var source = Game.getObjectById(creep.memory.targetSourceId);
            
            // FAILSAFE: If no ID found (old creep), find closest
            if(!source) {
                source = creep.pos.findClosestByRange(FIND_SOURCES);
            }

            if (creep.harvest(source) == ERR_NOT_IN_RANGE) {
                creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
            }
        }
    }
};

module.exports = roleHarvester;