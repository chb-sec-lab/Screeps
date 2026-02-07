var roleDiplomat = {
    /** @param {Creep} creep **/
    run: function(creep) {
        const targetRoom = creep.memory.targetRoom;

        // 1. Check if we are in the target room
        if (creep.room.name != targetRoom) {
            const exit = creep.room.findExitTo(targetRoom);
            creep.moveTo(creep.pos.findClosestByRange(exit), {visualizePathStyle: {stroke: '#ffffff'}});
        } else {
            // 2. We are in the target room. Find the controller.
            if (creep.room.controller) {
                // Try to reserve
                // Note: signController is free and good for marking territory
                if(creep.reserveController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#ffaa00'}});
                }
                
                // Optional: Sign the controller if not already signed
                if (!creep.room.controller.sign || creep.room.controller.sign.text !== 'Annex Alpha') {
                    if(creep.signController(creep.room.controller, 'Annex Alpha') == ERR_NOT_IN_RANGE) {
                        creep.moveTo(creep.room.controller);
                    }
                }
            }
        }
    }
};

module.exports = roleDiplomat;