/**
 * Role: Healer v5.6 (Squad Support)
 * Logic: Defender Shadow.
 * UPDATE: Folgt dem Defender in den Zielraum und heilt aktiv bei (31, 3).
 */
const rooms = require('config.rooms');

module.exports = {
    run: function(creep) {
        const targetRoom = creep.memory.target || rooms.TARGET;
        const homeRoom = creep.memory.home || rooms.HOME;

        // --- 1. TRIAGE (Healing Priority) ---
        const wounded = creep.pos.findInRange(FIND_MY_CREEPS, 3, {
            filter: c => c.hits < c.hitsMax
        });

        if (wounded.length > 0) {
            const patient = _.sortBy(wounded, c => c.hits)[0];
            if (creep.pos.isNearTo(patient)) creep.heal(patient);
            else creep.rangedHeal(patient);
            creep.say('Healing');
        } else if (creep.hits < creep.hitsMax) {
            creep.heal(creep);
        }

        // --- BORDER BOUNCE FIX ---
        if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
            creep.moveTo(new RoomPosition(25, 25, creep.room.name));
            return;
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
                creep.moveTo(new RoomPosition(25, 25, targetRoom), {reusePath: 50});
            } else {
                const guardPos = new RoomPosition(25, 25, targetRoom);
                creep.moveTo(guardPos, {range: 3});
            }
        }
    }
};