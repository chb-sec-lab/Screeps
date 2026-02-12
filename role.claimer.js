/**
 * role.claimer.js - SCOS v6.1.2
 * Updated: 2026-02-11 23:38 CET (Amsterdam)
 * Strategy: Claim vs. Reserve vs. Neutralize (Attack)
 */

module.exports = {
    run: function(creep) {
        const targetRoom = creep.memory.target || 'E57S56';
        const homeRoom = creep.memory.home || 'E58S56';

        // --- 1. SAFETY CHECK ---
        const targetView = Game.rooms[targetRoom];
        if (targetView && targetView.find(FIND_HOSTILE_CREEPS).length > 0) {
            creep.say('💤 Warte...');
            if (creep.room.name === targetRoom) {
                const exit = creep.pos.findClosestByRange(creep.room.findExitTo(homeRoom));
                creep.moveTo(exit);
            }
            return;
        }

        // --- 2. NAVIGATION ---
        if (creep.room.name !== targetRoom) {
            const exit = creep.pos.findClosestByRange(creep.room.findExitTo(targetRoom));
            creep.moveTo(exit, { visualizePathStyle: { stroke: '#ffffff' } });
            creep.say('🚀 Reise');
            return;
        }

        // --- 3. CONTROLLER LOGIK ---
        const controller = creep.room.controller;
        if (controller) {
            // Check GCL slots every 100 ticks
            if (!creep.memory.checkTime || Game.time >= creep.memory.checkTime) {
                const ownedRooms = _.filter(Game.rooms, r => r.controller && r.controller.my).length;
                creep.memory.canClaim = (Game.gcl.level > ownedRooms);
                creep.memory.checkTime = Game.time + 100;
            }

            // Case A: Foreign Reservation detected -> ATTACK/NEUTRALIZE
            if (controller.reservation && controller.reservation.username !== creep.owner.username) {
                const result = creep.attackController(controller);
                if (result === ERR_NOT_IN_RANGE) {
                    creep.moveTo(controller, { visualizePathStyle: { stroke: '#ff0000' } });
                } else {
                    creep.say('⚔️ Räumen');
                }
                return; 
            }

            // Case B: Slots available -> CLAIM
            if (creep.memory.canClaim) {
                const result = creep.claimController(controller);
                if (result === ERR_NOT_IN_RANGE) {
                    creep.moveTo(controller, { visualizePathStyle: { stroke: '#00ffff' } });
                } else if (result === OK) {
                    creep.say('🚩 Besetzt!');
                }
            } 
            // Case C: No slots -> RESERVE
            else {
                const result = creep.reserveController(controller);
                if (result === ERR_NOT_IN_RANGE) {
                    creep.moveTo(controller, { visualizePathStyle: { stroke: '#ffff00' } });
                } else if (result === OK) {
                    // With 2xCLAIM parts, this will now net +1 tick/turn
                    creep.say('🔒 Reserviert');
                }
            }
        }
    }
};