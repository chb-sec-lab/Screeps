/**
 * role.dismantler - v6.0.0 [STRATEGIC BREACHER]
 * Updated: 2026-02-11 20:34 CET (Amsterdam)
 */
const rooms = require('config.rooms');

module.exports = {
    run: function(creep) {
        if (creep.room.name !== creep.memory.target) {
            const exit = creep.pos.findClosestByRange(creep.room.findExitTo(creep.memory.target));
            creep.moveTo(exit);
            return;
        }

        const ALLIES = rooms.ALLIES || [];
        const isHostile = s => s.owner && !ALLIES.includes(s.owner.username);

        // HIERARCHY: Spawns -> Towers -> Extensions -> Others
        let target = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, { filter: s => isHostile(s) && s.structureType === STRUCTURE_SPAWN });
        if (!target) target = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, { filter: s => isHostile(s) && s.structureType === STRUCTURE_TOWER });
        if (!target) target = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, { filter: s => isHostile(s) && s.structureType === STRUCTURE_EXTENSION });
        if (!target) target = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, { filter: s => isHostile(s) && s.structureType !== STRUCTURE_CONTROLLER });

        if (target) {
            if (creep.dismantle(target) === ERR_NOT_IN_RANGE) creep.moveTo(target, {visualizePathStyle: {stroke: '#ff0000'}});
            creep.say('Breach');
        }
    }
};