/**
 * Role: Claimer v3.2
 * Logic: GCL Aware.
 */
module.exports = {
    run: function(creep) {
        const targetRoom = creep.memory.target;
        if (!targetRoom) return;

        if (creep.room.name !== targetRoom) {
            const exit = creep.pos.findClosestByRange(creep.room.findExitTo(targetRoom));
            creep.moveTo(exit, {visualizePathStyle: {stroke: '#ffaa00'}, reusePath: 20});
        } 
        else {
            if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                creep.moveTo(25, 25);
                return;
            }

            const controller = creep.room.controller;
            if (controller) {
                let result = creep.claimController(controller);
                if (result == ERR_GCL_NOT_ENOUGH) {
                    creep.reserveController(controller);
                } else if (result == ERR_NOT_IN_RANGE) {
                    creep.moveTo(controller, {visualizePathStyle: {stroke: '#ffffff'}});
                }
            }
        }
    }
};