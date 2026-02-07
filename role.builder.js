/**
 * Role: Builder
 * Description: Builds construction sites -> Repairs structures -> Upgrades (Fallback)
 */

var roleBuilder = {
    /** @param {Creep} creep **/
    run: function(creep) {

        // --- 1. STATE MACHINE ---
        if(creep.memory.working && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.working = false;
            creep.say('🔄 harvest');
        }
        if(!creep.memory.working && creep.store.getFreeCapacity() == 0) {
            creep.memory.working = true;
            creep.say('🚧 build');
        }

        // --- 2. WORK LOGIC ---
        if(creep.memory.working) {
            // Priority A: Construction Sites
            var constructionSite = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
            
            if(constructionSite) {
                if(creep.build(constructionSite) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(constructionSite, {visualizePathStyle: {stroke: '#ffffff'}});
                }
            } else {
                // Priority B: Repair (Roads/Containers < 80%)
                var repairTarget = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: (s) => s.hits < s.hitsMax * 0.8 && s.structureType != STRUCTURE_WALL
                });

                if (repairTarget) {
                    if (creep.repair(repairTarget) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(repairTarget, {visualizePathStyle: {stroke: '#ffffff'}});
                    }
                } else {
                    // Fallback to Upgrade
                    if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(creep.room.controller);
                    }
                }
            }
        }
        // --- 3. HARVEST LOGIC (DISTRIBUTED) ---
        else {
            var source = Game.getObjectById(creep.memory.targetSourceId);
            if(!source) source = creep.pos.findClosestByRange(FIND_SOURCES);

            if(creep.harvest(source) == ERR_NOT_IN_RANGE) {
                creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
            }
        }
    }
};

module.exports = roleBuilder;