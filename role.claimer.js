var roleClaimer = {
    /** @param {Creep} creep **/
    run: function(creep) {
        // Ziel: Der Controller im anderen Raum
        // Ersetze 'E12S34' durch den Namen deines Zielraums!
        var targetRoom = 'E58S55'; 

        // Wenn wir noch nicht im Zielraum sind, geh hin
        if (creep.room.name != targetRoom) {
            var exitDir = creep.room.findExitTo(targetRoom);
            var exit = creep.pos.findClosestByRange(exitDir);
            creep.moveTo(exit, {visualizePathStyle: {stroke: '#ffaa00'}});
        }
        else {
            // Wenn wir im Raum sind, geh zum Controller
            if (creep.room.controller) {
                if (creep.reserveController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#ffaa00'}});
                }
            }
        }
    }
};

module.exports = roleClaimer;