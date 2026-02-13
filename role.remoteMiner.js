/**
 * role.remoteMiner.js - SCOS v6.1.9
 * Updated: 2026-02-13 CET (Amsterdam)
 * Role: Remote Harvester/Walker with Vision-Corrected Safety Logic
 * Fix:
 *  - Stop "spinning": source is LOCKED and only reassigned after sustained overcrowding + cooldown
 *  - Home delivery: FIRST found Container OR Storage OR Spawn/Extension (with free capacity)
 */
const rooms = require('config.rooms');

module.exports = {
    run: function (creep) {
        const targetRoom = rooms.TARGET;
        const homeRoom = rooms.HOME;

        // ----------------
        // TUNABLE SETTINGS
        // ----------------
        const MAX_MINERS_PER_SOURCE = 2;      // allow 2 miners per source (set 3 if you want)
        const OVERBOOK_TICKS = 8;             // must be overcrowded this many ticks in a row to switch
        const REASSIGN_COOLDOWN_TICKS = 25;   // once we switch, wait before switching again

        // --- 1. HOSTILE INTELLIGENCE & STABLE PARKING ---
        const targetView = Game.rooms[targetRoom];

        const hostileCreeps = targetView ? targetView.find(FIND_HOSTILE_CREEPS, {
            filter: (c) =>
                c.getActiveBodyparts(ATTACK) > 0 ||
                c.getActiveBodyparts(RANGED_ATTACK) > 0 ||
                c.getActiveBodyparts(HEAL) > 0
        }) : [];

        const hostilesInSight = hostileCreeps.length > 0;

        if (hostilesInSight) {
            creep.memory.lastDangerTick = Game.time;
        }

        let isDangerous = false;
        if (hostilesInSight) {
            isDangerous = true;
        } else if (!targetView) {
            const recentlyDangerous =
                creep.memory.lastDangerTick && (Game.time - creep.memory.lastDangerTick < 50);
            if (recentlyDangerous) isDangerous = true;
        }

        if (isDangerous) {
            creep.say(hostilesInSight ? '📢 GEFAHR!' : '⌛ Abwarten');

            if (creep.room.name === targetRoom) {
                const exit = creep.pos.findClosestByRange(creep.room.findExitTo(homeRoom));
                creep.moveTo(exit, { visualizePathStyle: { stroke: '#ff0000' } });
            } else {
                const parkingSpot = new RoomPosition(3, 11, homeRoom);
                if (!creep.pos.inRangeTo(parkingSpot, 3)) {
                    creep.moveTo(parkingSpot, { visualizePathStyle: { stroke: '#555555' } });
                    creep.say('🅿️ Parking');
                } else {
                    creep.say('💤 Standby');
                }
            }
            return;
        }

        // ---------------------------
        // Helpers: source balancing
        // ---------------------------

        // Count how many remote miners are assigned to a given sourceId
        // NOTE: If you don't set creep.memory.role, remove that line below.
        function countAssignedMiners(sourceId) {
            return _.sum(Game.creeps, c =>
                c.my &&
                c.memory &&
                c.memory.role === creep.memory.role && // remove if you don't use roles in memory
                c.memory.sourceId === sourceId
            );
        }

        function getSourcesInRoom(room) {
            const active = room.find(FIND_SOURCES_ACTIVE);
            return active.length ? active : room.find(FIND_SOURCES);
        }

        function pickLeastAssignedSource(room) {
            const sources = getSourcesInRoom(room);
            if (!sources.length) return null;

            // choose by lowest assigned count, tie-break by range
            let best = null;
            let bestCount = Infinity;
            let bestRange = Infinity;

            for (const s of sources) {
                const cnt = countAssignedMiners(s.id);
                const r = creep.pos.getRangeTo(s);
                if (cnt < bestCount || (cnt === bestCount && r < bestRange)) {
                    best = s;
                    bestCount = cnt;
                    bestRange = r;
                }
            }
            return best;
        }

        // --------------------------------
        // 2. MINING & HAULING LOGIC
        // --------------------------------
        if (creep.store.getFreeCapacity() > 0) {
            // Need Energy: Go to Target Room
            if (creep.room.name !== targetRoom) {
                const exit = creep.pos.findClosestByRange(creep.room.findExitTo(targetRoom));
                creep.moveTo(exit, { visualizePathStyle: { stroke: '#ffffff' } });
                return;
            }

            // In Target Room: lock a source and harvest it
            // Ensure we have a source lock
            let source = creep.memory.sourceId ? Game.getObjectById(creep.memory.sourceId) : null;

            // If invalid, pick one and lock it
            if (!source) {
                source = pickLeastAssignedSource(creep.room);
                creep.memory.sourceId = source ? source.id : null;
                creep.memory.overbookCount = 0;
            }

            if (!source) {
                creep.say('❓NoSrc');
                return;
            }

            // Overbooking logic with hysteresis + cooldown to prevent oscillation/spinning
            const assigned = countAssignedMiners(source.id);

            const cooldownUntil = creep.memory.reassignCooldownUntil || 0;
            const canReassign = Game.time >= cooldownUntil;

            if (assigned > MAX_MINERS_PER_SOURCE && canReassign) {
                // count consecutive ticks overcrowded
                creep.memory.overbookCount = (creep.memory.overbookCount || 0) + 1;

                if (creep.memory.overbookCount >= OVERBOOK_TICKS) {
                    const bestAlt = pickLeastAssignedSource(creep.room);

                    // Only switch if alternative is actually better (less assigned than current)
                    if (bestAlt && bestAlt.id !== source.id) {
                        const altAssigned = countAssignedMiners(bestAlt.id);

                        if (altAssigned < assigned) {
                            creep.memory.sourceId = bestAlt.id;
                            creep.memory.reassignCooldownUntil = Game.time + REASSIGN_COOLDOWN_TICKS;
                            creep.memory.overbookCount = 0;
                            source = bestAlt;
                            creep.say('🔁 Src');
                        } else {
                            // No real improvement: stay put, reset counter slowly
                            creep.memory.overbookCount = Math.max(0, creep.memory.overbookCount - 1);
                        }
                    } else {
                        // No alternative: stay put
                        creep.memory.overbookCount = Math.max(0, creep.memory.overbookCount - 1);
                    }
                }
            } else {
                // Not overcrowded (or in cooldown): reset counter
                creep.memory.overbookCount = 0;
            }

            // Harvest (this is what they should keep doing)
            const harvestResult = creep.harvest(source);
            if (harvestResult === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
            return;

        } else {
            // Full: Go to Home Room
            if (creep.room.name !== homeRoom) {
                const exit = creep.pos.findClosestByRange(creep.room.findExitTo(homeRoom));
                creep.moveTo(exit, { visualizePathStyle: { stroke: '#00ff00' } });
                return;
            }

            // In Home Room: Deliver to FIRST found of:
            // Container OR Storage OR Spawn/Extension (must have free capacity)
            const targets = creep.room.find(FIND_STRUCTURES, {
                filter: (s) =>
                    (
                        s.structureType === STRUCTURE_CONTAINER ||
                        s.structureType === STRUCTURE_STORAGE ||
                        s.structureType === STRUCTURE_SPAWN ||
                        s.structureType === STRUCTURE_EXTENSION
                    ) &&
                    s.store &&
                    s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            });

            let target = targets.length ? targets[0] : null;

            if (!target) {
                target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: (s) =>
                        (
                            s.structureType === STRUCTURE_CONTAINER ||
                            s.structureType === STRUCTURE_STORAGE ||
                            s.structureType === STRUCTURE_SPAWN ||
                            s.structureType === STRUCTURE_EXTENSION
                        ) &&
                        s.store &&
                        s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                });
            }

            if (target) {
                if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#00ff00' } });
                }
            } else {
                creep.say('🚫 NoTarget');
            }
            return;
        }
    }
};
