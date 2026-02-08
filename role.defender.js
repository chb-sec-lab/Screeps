/**
 * Role: Defender v3.2
 * Logic: Tank unit.
 */
module.exports = {
    run: function(creep) {
        var targetRoom = creep.memory.target;
        if (creep.room.name !== targetRoom) {
            var exit = creep.pos.findClosestByRange(creep.room.findExitTo(targetRoom));
            creep.moveTo(exit, {visualizePathStyle: {stroke: '#ff0000'}});
        } else {
            var hostile = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
            if (hostile) {
                if (creep.attack(hostile) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(hostile, {visualizePathStyle: {stroke: '#ff0000'}});
                }
            } else {
                creep.moveTo(creep.room.controller, {range: 2});
            }
        }
    }
};