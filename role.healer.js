/**
 * Role: Healer v5.6 (Squad Support)
 * Logic: Defender Shadow.
 * UPDATE: Folgt dem Defender in den Zielraum und heilt aktiv bei (31, 3).
 */
module.exports = {
    run: function(creep) {
        const targetRoom = creep.memory.target || 'E57S56';
        const homeRoom = creep.memory.home || 'E58S56';

        // --- 1. TRIAGE (Healing Priority) ---
        const wounded = creep.pos.findInRange(FIND_MY_CREEPS, 3, {
            filter: c => c.hits < c.hitsMax
        });

        if (wounded.length > 0) {
            const patient = _.sortBy(wounded, c => c.hits)[0];
            if (creep.pos.isNearTo(patient)) creep.heal(patient);
            else creep.rangedHeal(patient);
            creep.say('🩹 Healing');
        } else if (creep.hits < creep.hitsMax) {
            creep.heal(creep);
        }

        // --- 2. MOVEMENT (Follow the Defender) ---
        let moveTarget = creep.pos.findClosestByRange(FIND_MY_CREEPS, {
            filter: c => c.memory.role === 'defender'
        });

        if (moveTarget) {
            if (!creep.pos.isNearTo(moveTarget)) {
                creep.moveTo(moveTarget, {visualizePathStyle: {stroke: '#00ff00'}, range: 1});
            }
        } else {
            // Falls kein Defender da ist, geh zum Guard-Point im Zielraum
            if (creep.room.name !== targetRoom) {
                const exit = creep.pos.findClosestByRange(creep.room.findExitTo(targetRoom));
                creep.moveTo(exit);
            } else {
                const guardPos = new RoomPosition(31, 3, targetRoom);
                creep.moveTo(guardPos, {range: 3});
            }
        }
    }
};