/**
 * Role: Defender v5.4 (Remote Guard)
 * Logic: Hunter-Killer with Fixed Point Patrol.
 * UPDATE: Zieht aktiv in den Zielraum und hält Position bei (31, 3), wenn kein Feind da ist.
 */
module.exports = {
    run: function(creep) {
        const targetRoom = creep.memory.targetRoom || creep.memory.target || 'E57S56';
        const homeRoom = creep.memory.homeRoom || creep.memory.home || 'E58S56';

        // --- 0. PRE-FLIGHT & TACTICAL RETREAT ---
        // Pit Stop: Wenn wir im sicheren Raum sind und nicht volle HP haben -> Warten auf Tower
        if (creep.room.name === homeRoom && creep.hits < creep.hitsMax) {
            creep.say('PitStop');
            if (creep.getActiveBodyparts(HEAL) > 0) creep.heal(creep);
            return;
        }

        // Tactical Retreat: Wenn Lebenspunkte kritisch (< 40%) -> Flucht nach Hause
        if (creep.hits < creep.hitsMax * 0.4 && creep.room.name !== homeRoom) {
            creep.say('Retreat');
            if (creep.getActiveBodyparts(HEAL) > 0) creep.heal(creep);
            const exit = creep.pos.findClosestByRange(creep.room.findExitTo(homeRoom));
            if (exit) creep.moveTo(exit, {visualizePathStyle: {stroke: '#ffaa00'}});
            return;
        }

        // --- 1. TARGET ACQUISITION ---
        let target = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
            filter: c => c.getActiveBodyparts(HEAL) > 0
        });
        if (!target) {
            target = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
        }
        if (!target) {
            target = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_INVADER_CORE
            });
        }

        // --- 2. COMBAT ACTIONS ---
        if (target) {
            creep.rangedAttack(target);
            if (creep.pos.isNearTo(target)) creep.attack(target);
            creep.moveTo(target, {visualizePathStyle: {stroke: '#ff0000'}});
            creep.say('Attack');
        } else {
            // Self-Heal if wounded and no enemy
            if (creep.hits < creep.hitsMax) creep.heal(creep);

            // --- 3. PATROL / GUARD POSITION ---
            if (creep.room.name !== targetRoom) {
                // Reise zum Zielraum
                const exit = creep.pos.findClosestByRange(creep.room.findExitTo(targetRoom));
                creep.moveTo(exit, {visualizePathStyle: {stroke: '#ff0000'}});
                creep.say('Move');
            } else {
                // Im Zielraum: Halte Position in der Raummitte
                const guardPos = new RoomPosition(25, 25, targetRoom);
                if (!creep.pos.inRangeTo(guardPos, 2)) {
                    creep.moveTo(guardPos, {visualizePathStyle: {stroke: '#555555'}});
                    creep.say('Guard');
                } else {
                    creep.say('Alert');
                }
            }
        }
    }
};
