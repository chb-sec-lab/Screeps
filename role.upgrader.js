/**
 * Role: Upgrader
 * Description: Dumps all energy into the Room Controller to level up RCL.
 */

var roleUpgrader = {
    /** @param {Creep} creep **/
    run: function(creep) {

        // --- 1. STATE MACHINE ---
        if(creep.memory.upgrading && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.upgrading = false;
            creep.say('🔄 harvest');
        }
        if(!creep.memory.upgrading && creep.store.getFreeCapacity() == 0) {
            creep.memory.upgrading = true;
            creep.say('⚡ upgrade');
        }

        // --- 2. WORK LOGIC ---
        if(creep.memory.upgrading) {
            if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#ffffff'}});
            }
        }
        else {
            // --- 3. HARVEST LOGIC (DISTRIBUTED) ---
            var source = Game.getObjectById(creep.memory.targetSourceId);
            // Failsafe
            if(!source) source = creep.pos.findClosestByRange(FIND_SOURCES);

            if(creep.harvest(source) == ERR_NOT_IN_RANGE) {
                creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
            }
        }
    }
};

module.exports = roleUpgrader;