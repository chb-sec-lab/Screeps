/**
 * role.vanguard.js - SCOS v6.1.10
 * Updated: 2026-02-12 01:02 CET (Amsterdam)
 * Strategy: Combined Arms Staging & Full Retreat
 * Update: Retreat logic now targets the specific Assembly Point (25, 2) instead of just the border.
 */
const rooms = require('config.rooms');

module.exports = {
    run: function(creep) {
        const targetRoom = rooms.TARGET;
        const homeRoom = rooms.HOME;
        
        // --- SQUAD CONFIG ---
        const VANGUARD_RALLY_MIN = 3; 
        const MEDIC_RALLY_MIN = 1;
        const ASSEMBLY_POINT = new RoomPosition(25, 2, homeRoom);

        // --- 1. SQUAD CENSUS ---
        const vanguardsInHome = _.filter(Game.creeps, (c) => c.memory.role === 'vanguard' && c.room.name === homeRoom).length;
        const vanguardsInTarget = _.filter(Game.creeps, (c) => c.memory.role === 'vanguard' && c.room.name === targetRoom).length;
        const totalVanguards = vanguardsInHome + vanguardsInTarget;

        const medicsInHome = _.filter(Game.creeps, (c) => c.memory.role === 'medic' && c.room.name === homeRoom).length;
        const medicsInTarget = _.filter(Game.creeps, (c) => c.memory.role === 'medic' && c.room.name === targetRoom).length;
        const totalMedics = medicsInHome + medicsInTarget;

        const squadReady = (totalVanguards >= VANGUARD_RALLY_MIN && totalMedics >= MEDIC_RALLY_MIN);

        // --- 2. HOME ROOM STAGING ---
        if (creep.room.name === homeRoom) {
            if (!squadReady) {
                if (totalVanguards < VANGUARD_RALLY_MIN) creep.say(`🤝 V:${totalVanguards}/${VANGUARD_RALLY_MIN}`);
                else creep.say(`💉 M:${totalMedics}/${MEDIC_RALLY_MIN}`);
                
                creep.moveTo(ASSEMBLY_POINT, { visualizePathStyle: { stroke: '#ffff00' } });
                if (creep.hits < creep.hitsMax) creep.heal(creep);
                return;
            } else {
                creep.say('⚔️ BREACH!');
            }
        }

        // --- 3. TARGET ROOM LOGIC ---
        if (creep.room.name !== targetRoom) {
            // If we are between rooms (e.g. on the exit tile), move toward target if ready, otherwise back to assembly
            if (squadReady) {
                const exit = creep.pos.findClosestByRange(creep.room.findExitTo(targetRoom));
                creep.moveTo(exit);
            } else {
                creep.moveTo(ASSEMBLY_POINT);
            }
        } else {
            const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);
            
            // FULL RETREAT: If hostiles present but squad is broken, go all the way to ASSEMBLY_POINT
            if (hostiles.length > 0 && (vanguardsInTarget < 2 || medicsInTarget < 1)) {
                creep.say(medicsInTarget < 1 ? '🚑 No Medic!' : '🏃 Broken!');
                creep.moveTo(ASSEMBLY_POINT, { visualizePathStyle: { stroke: '#ffaa00' }, reusePath: 10 });
                if (creep.hits < creep.hitsMax) creep.heal(creep);
                return;
            }

            // TARGET PRIORITIZATION: FOCUS FIRE
            let target = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
                filter: (c) => c.getActiveBodyparts(HEAL) > 0
            });

            if (!target) {
                target = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
            }

            if (target) {
                const range = creep.pos.getRangeTo(target);
                if (range <= 3) creep.rangedAttack(target);

                if (range > 3) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ff0000' } });
                } else if (range < 3) {
                    const path = PathFinder.search(creep.pos, { pos: target.pos, range: 3 }, { flee: true }).path;
                    creep.moveByPath(path);
                }
            } else {
                const internalRally = new RoomPosition(31, 3, targetRoom);
                creep.moveTo(internalRally);
            }

            // Combat Healing
            if (creep.hits < creep.hitsMax) {
                creep.heal(creep);
            } else {
                const wounded = creep.pos.findClosestByRange(FIND_MY_CREEPS, {
                    filter: (c) => c.hits < c.hitsMax
                });
                if (wounded && creep.pos.isNearTo(wounded)) creep.heal(wounded);
            }
        }
    }
};