/**
 * Role: Dismantler v3.2
 * Logic: Clears structures and enemies.
 */
module.exports = {
    run: function(creep) {
        const targetRoom = creep.memory.target;
        if (creep.room.name !== targetRoom) {
            const exit = creep.pos.findClosestByRange(creep.room.findExitTo(targetRoom));
            creep.moveTo(exit, {visualizePathStyle: {stroke: '#ff0000'}});
        } else {
            // 1. Hostile Structures
            let target = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
                filter: (s) => s.structureType !== STRUCTURE_CONTROLLER
            });
            // 2. Neutral Obstacles
            if (!target) {
                target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: (s) => s.structureType == STRUCTURE_WALL || s.structureType == STRUCTURE_ROAD
                });
            }
            // 3. Combat Mode
            if (!target) {
                target = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
                if (target) {
                    if (creep.attack(target) == ERR_NOT_IN_RANGE) creep.moveTo(target);
                    return;
                }
            }

            if (target) {
                if (creep.dismantle(target) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, {visualizePathStyle: {stroke: '#ff0000'}});
                }
            } else {
                creep.moveTo(creep.room.controller, {range: 3});
            }
        }
    }
};