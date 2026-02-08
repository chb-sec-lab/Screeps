var roleClaimer = {
    run: function(creep) {
        var targetRoom = creep.memory.target; 
        if (!targetRoom) return;

        if (creep.room.name != targetRoom) {
            var exitDir = creep.room.findExitTo(targetRoom);
            var exit = creep.pos.findClosestByRange(exitDir);
            creep.moveTo(exit, {visualizePathStyle: {stroke: '#ffaa00'}});
        } else {
            if (creep.room.controller) {
                if (creep.reserveController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#ffffff'}});
                }
            }
        }
    }
};
module.exports = roleClaimer;