/**
 * Role: Healer v3.2
 * Logic: Support unit.
 */
module.exports = {
    run: function(creep) {
        const target = _.find(Game.creeps, c => 
            (c.memory.role == 'dismantler' || c.memory.role == 'defender') && 
            c.room.name == creep.room.name
        );
        
        if (target) {
            if (creep.pos.isNearTo(target)) {
                creep.heal(target);
            } else {
                creep.rangedHeal(target);
                creep.moveTo(target, {visualizePathStyle: {stroke: '#00ff00'}, range: 1});
            }
        } else if (creep.room.name !== creep.memory.target) {
            const exit = creep.pos.findClosestByRange(creep.room.findExitTo(creep.memory.target));
            creep.moveTo(exit);
        }
    }
};