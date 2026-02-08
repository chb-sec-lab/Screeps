/**
 * Role: Builder v3.2
 * Logic: Builds > Repairs > Upgrades.
 */
module.exports = {
    run: function(creep) {
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.working = false;
            creep.say('Mine');
        }
        if (!creep.memory.working && creep.store.getFreeCapacity() == 0) {
            creep.memory.working = true;
            creep.say('Build');
        }

        if (creep.memory.working) {
            var targets = creep.room.find(FIND_CONSTRUCTION_SITES);
            if (targets.length > 0) {
                var target = creep.pos.findClosestByRange(targets);
                if (creep.build(target) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, {visualizePathStyle: {stroke: '#ffffff'}});
                }
            } else {
                if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(creep.room.controller);
                }
            }
        } else {
            var source = Game.getObjectById(creep.memory.targetSourceId);
            if (!source) source = creep.pos.findClosestByRange(FIND_SOURCES);

            if (creep.harvest(source) == ERR_NOT_IN_RANGE) {
                creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
            } else if (creep.harvest(source) != OK) {
                 delete creep.memory.targetSourceId;
            }
        }
    }
};