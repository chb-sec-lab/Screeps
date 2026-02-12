/**
 * role.remoteMiner.js - SCOS v6.1.6
 * Updated: 2026-02-12 00:20 CET (Amsterdam)
 * Role: Remote Harvester/Walker with Vision-Corrected Safety Logic
 * Update: Miners now enter immediately if vision confirms room is clear (ignoring hysteresis).
 */
const rooms = require('config.rooms');

module.exports = {
    run: function(creep) {
        const targetRoom = rooms.TARGET;
        const homeRoom = rooms.HOME;

        // --- 1. HOSTILE INTELLIGENCE & STABLE PARKING ---
        const targetView = Game.rooms[targetRoom];
        
        // We only care about hostile creeps that can actually hurt us (Combat Parts)
        const hostileCreeps = targetView ? targetView.find(FIND_HOSTILE_CREEPS, {
            filter: (c) => c.getActiveBodyparts(ATTACK) > 0 || 
                           c.getActiveBodyparts(RANGED_ATTACK) > 0 || 
                           c.getActiveBodyparts(HEAL) > 0
        }) : [];
        
        const hostilesInSight = hostileCreeps.length > 0;
        
        // Memory-based "Stickiness" for when vision is lost
        if (hostilesInSight) {
            creep.memory.lastDangerTick = Game.time;
        }

        // Hysteresis logic: Only stay out if we see them OR if we lost vision recently while they were there.
        // REFINEMENT: If we HAVE vision (targetView) and see NO combatants, it is NOT dangerous anymore.
        let isDangerous = false;
        if (hostilesInSight) {
            isDangerous = true;
        } else if (!targetView) {
            // No vision? Check if it was dangerous recently (last 50 ticks)
            const recentlyDangerous = creep.memory.lastDangerTick && (Game.time - creep.memory.lastDangerTick < 50);
            if (recentlyDangerous) isDangerous = true;
        }

        if (isDangerous) {
            creep.say(hostilesInSight ? '📢 GEFAHR!' : '⌛ Abwarten');
            
            // 1a. If in the danger zone, flee to home
            if (creep.room.name === targetRoom) {
                const exit = creep.pos.findClosestByRange(creep.room.findExitTo(homeRoom));
                creep.moveTo(exit, { visualizePathStyle: { stroke: '#ff0000' } });
            } 
            // 1b. If already home, move to the designated parking lot (Range 3 around 3, 11)
            else {
                const parkingSpot = new RoomPosition(3, 11, homeRoom);
                if (!creep.pos.inRangeTo(parkingSpot, 3)) {
                    creep.moveTo(parkingSpot, { visualizePathStyle: { stroke: '#555555' } });
                    creep.say('🅿️ Parking');
                } else {
                    creep.say('💤 Standby');
                }
            }
            return; // Stop operations until danger is cleared
        }

        // --- 2. MINING & HAULING LOGIC ---
        if (creep.store.getFreeCapacity() > 0) {
            // Need Energy: Go to Target Room
            if (creep.room.name !== targetRoom) {
                const exit = creep.pos.findClosestByRange(creep.room.findExitTo(targetRoom));
                creep.moveTo(exit, { visualizePathStyle: { stroke: '#ffffff' } });
            } else {
                // In Target Room: Find Source
                const source = creep.pos.findClosestByRange(FIND_SOURCES_ACTIVE);
                if (source) {
                    if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
                    }
                }
            }
        } else {
            // Full: Go to Home Room
            if (creep.room.name !== homeRoom) {
                const exit = creep.pos.findClosestByRange(creep.room.findExitTo(homeRoom));
                creep.moveTo(exit, { visualizePathStyle: { stroke: '#00ff00' } });
            } else {
                // In Home Room: Deliver to Storage or Spawn
                const target = creep.room.storage || creep.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: (s) => (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) &&
                                    s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                });
                if (target) {
                    if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(target, { visualizePathStyle: { stroke: '#00ff00' } });
                    }
                }
            }
        }
    }
};