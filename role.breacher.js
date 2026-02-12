/**
 * role.breacher.js - SIEGE UNIT
 */
module.exports = {
    run: function(creep) {
        const targetRoom = creep.memory.target;
        if (creep.room.name !== targetRoom) {
            const exit = creep.pos.findClosestByRange(creep.room.findExitTo(targetRoom));
            creep.moveTo(exit);
            return;
        }

        let target = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_TOWER || s.structureType === STRUCTURE_SPAWN
        });
        if (!target) target = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {filter: s => s.structureType !== STRUCTURE_CONTROLLER});

        if (target) {
            if (creep.dismantle(target) === ERR_NOT_IN_RANGE) creep.moveTo(target);
        }
    }
};