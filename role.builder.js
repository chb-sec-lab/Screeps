/**
 * Role: Builder v3.8 (Scavenger)
 * Logic: Scavenges dropped energy -> Builds -> Repairs -> Upgrades.
 * Fix: Picks up dropped energy to speed up build times.
 */
module.exports = {
    run: function(creep) {
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.working = false;
            creep.say('Get');
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
                // Nothing to build? Repair or Upgrade.
                if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(creep.room.controller);
                }
            }
        } else {
            // OPTIMIZATION: Check for dropped resources first!
            // This is much faster than mining if harvesters are messy.
            const dropped = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
            if (dropped && creep.pos.inRangeTo(dropped, 5)) {
                if (creep.pickup(dropped) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(dropped, {visualizePathStyle: {stroke: '#ffaa00'}});
                }
                return; // Exit here if we found something
            }

            // Fallback to Mining
            var source = Game.getObjectById(creep.memory.targetSourceId);
            if (!source) source = creep.pos.findClosestByRange(FIND_SOURCES);

            if (creep.harvest(source) == ERR_NOT_IN_RANGE) {
                creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
            }
        }
    }
};