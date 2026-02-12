/**
 * role.medic.js - SCOS v6.1.2
 * Updated: 2026-02-12 01:10 CET (Amsterdam)
 * Strategy: Cross-Room Tactical Shadowing
 * Fix: Medic will now cross borders independently if leaders are in the Target room.
 */
const rooms = require('config.rooms');

module.exports = {
    run: function(creep) {
        const targetRoom = rooms.TARGET;
        const homeRoom = rooms.HOME;

        // --- 1. PRIORITY: TRIAGE ---
        // Heal anyone wounded in immediate range, regardless of room.
        const patient = creep.pos.findClosestByRange(FIND_MY_CREEPS, { 
            filter: c => c.hits < c.hitsMax 
        });
        
        if (patient) {
            if (creep.heal(patient) === ERR_NOT_IN_RANGE) {
                creep.rangedHeal(patient);
            }
            creep.moveTo(patient, {range: 1, visualizePathStyle: {stroke: '#00ff00'}});
            creep.say('🚑 Help!');
            return;
        }

        // --- 2. PRIORITY: GLOBAL SHADOWING ---
        // Find a leader (Vanguard) anywhere in the operation area
        let leader = creep.pos.findClosestByRange(FIND_MY_CREEPS, { 
            filter: c => (c.memory.role === 'vanguard') && c.room.name === creep.room.name
        });

        // FIX: If no leader in current room, look for one in the target room globally
        if (!leader) {
            leader = _.find(Game.creeps, (c) => c.memory.role === 'vanguard' && c.room.name === targetRoom);
        }

        if (leader) {
            // If leader is in a different room, move toward that room
            if (leader.room.name !== creep.room.name) {
                const exit = creep.pos.findClosestByRange(creep.room.findExitTo(leader.room.name));
                creep.moveTo(exit, {visualizePathStyle: {stroke: '#00ffff'}});
                creep.say('🏃 Catchup');
            } else {
                // Tactical Shadow: Stay behind the leader
                let targetY = leader.pos.y + 1;
                if (targetY > 48) targetY = 48;
                if (targetY < 2) targetY = 2;

                const tacticalPos = new RoomPosition(leader.pos.x, targetY, leader.room.name);
                if (!creep.pos.isEqualTo(tacticalPos)) {
                    creep.moveTo(tacticalPos, {range: 0});
                }
                creep.say('🛰️ Shadow');
            }
        } else {
            // --- 3. PRIORITY: RALLY ---
            // No leaders found anywhere? Go to the assembly point in Home.
            const assemblyPoint = new RoomPosition(25, 2, homeRoom);
            if (creep.room.name !== homeRoom) {
                creep.moveTo(assemblyPoint);
                creep.say('🏠 Retreat');
            } else {
                if (!creep.pos.inRangeTo(assemblyPoint, 3)) {
                    creep.moveTo(assemblyPoint);
                    creep.say('🅿️ Rally');
                } else {
                    creep.say('🛡️ Idle');
                }
            }
        }
    }
};