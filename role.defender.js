/**
 * Role: Defender v5.4 (Remote Guard)
 * Logic: Hunter-Killer with Fixed Point Patrol.
 * UPDATE: Zieht aktiv in den Zielraum und hält Position bei (31, 3), wenn kein Feind da ist.
 */
module.exports = {
    run: function(creep) {
        const targetRoom = creep.memory.target || 'E57S56';
        const homeRoom = creep.memory.home || 'E58S56';

        // --- 1. TARGET ACQUISITION ---
        let target = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
            filter: c => c.getActiveBodyparts(HEAL) > 0
        });
        if (!target) {
            target = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
        }

        // --- 2. COMBAT ACTIONS ---
        if (target) {
            creep.rangedAttack(target);
            if (creep.pos.isNearTo(target)) creep.attack(target);
            creep.moveTo(target, {visualizePathStyle: {stroke: '#ff0000'}});
            creep.say('⚔️ Attack');
        } else {
            // Self-Heal if wounded and no enemy
            if (creep.hits < creep.hitsMax) creep.heal(creep);

            // --- 3. PATROL / GUARD POSITION ---
            if (creep.room.name !== targetRoom) {
                // Reise zum Zielraum
                const exit = creep.pos.findClosestByRange(creep.room.findExitTo(targetRoom));
                creep.moveTo(exit, {visualizePathStyle: {stroke: '#ff0000'}});
                creep.say('🚀 EnRoute');
            } else {
                // Im Zielraum: Halte Position bei (31, 3)
                const guardPos = new RoomPosition(31, 3, targetRoom);
                if (!creep.pos.inRangeTo(guardPos, 2)) {
                    creep.moveTo(guardPos, {visualizePathStyle: {stroke: '#555555'}});
                    creep.say('🛡️ Guarding');
                } else {
                    creep.say('💤 Alert');
                }
            }
        }
    }
};