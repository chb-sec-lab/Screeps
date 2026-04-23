/**
 * role.harvester.js - SCOS v6.2.0
 * Fix: Strict Delivery Priority (Extensions > Storage > Containers)
 */
const survival = require('utils.survival');

module.exports = {
    run: function(creep) {
        // Auto-Recycle Reset Logic
        if (creep.memory.lastIdleTick !== Game.time - 1) {
            creep.memory.idleCount = 0;
        }

        // --- UNIVERSAL SURVIVAL ---
        if (survival.fleeFromHostiles(creep)) return;

        const targetRoom = creep.memory.targetRoom;
        if (targetRoom && creep.room.name !== targetRoom) {
            creep.moveTo(new RoomPosition(25, 25, targetRoom), { visualizePathStyle: { stroke: '#ffaa00' }, reusePath: 50 });
            return;
        }
        
        // --- BORDER BOUNCE FIX ---
        if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
            creep.moveTo(new RoomPosition(25, 25, creep.room.name));
            return;
        }

        // --- State Machine ---
        if (creep.memory.working && creep.store.getUsedCapacity() === 0) {
            creep.memory.working = false;
            creep.say('Harvest');
        }
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            creep.say('Deliver');
        }

        if (!creep.memory.working) {
            // --- HARVEST LOGIC ---
            let source = creep.memory.targetSourceId ? Game.getObjectById(creep.memory.targetSourceId) : null;

            // If we don't have a source, or our source is empty, find a new one.
            if (!source || source.energy === 0) {
                source = pickBestSource(creep);
                if (source) {
                    creep.memory.targetSourceId = source.id;
                }
            }

            if (source) {
                // If the chosen source is STILL empty (meaning all sources are depleted), wait nearby.
                // This prevents the creep from getting stuck trying to harvest from an empty source.
                if (source.energy === 0) {
                    creep.say('Wait:Nrg');
                    if (!creep.pos.inRangeTo(source, 2)) {
                        creep.moveTo(source, { range: 2, visualizePathStyle: { stroke: '#555555' } });
                    }
                } else {
                    // Otherwise, harvest it.
                    if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
                    }
                }
            } else {
                // If no sources are available at all, wait near controller.
                creep.say('Idle:NoSrc');
                if (creep.room.controller) {
                    if (!creep.pos.inRangeTo(creep.room.controller, 5)) {
                        creep.moveTo(creep.room.controller, { range: 5 });
                    }
                }
            }
        } else {
            // --- DELIVERY LOGIC ---
            let target = null;

            // 1. Priority: Adjacent Links or Containers (Stationary mining)
            target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: (s) => (s.structureType === STRUCTURE_LINK || s.structureType === STRUCTURE_CONTAINER) && 
                               s.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && 
                               creep.pos.inRangeTo(s, 3)
            });

            // 2. Priority: Spawns & Extensions (Keeps the room alive)
            if (!target) {
                target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                    ignoreCreeps: true,
                    filter: (s) => (s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_SPAWN) &&
                                   s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                });
            }

            // 3. Priority: Storage
            if (!target && creep.room.storage && creep.room.storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                target = creep.room.storage;
            }

            if (target) {
                if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                }
            } else {
                // 4. Fallback: If EVERYTHING is full, help upgrade the controller to prevent idling.
                // ONLY do this in owned rooms to prevent wandering off to other rooms!
                if (creep.room.controller && creep.room.controller.my) {
                    creep.say('Aux:Upg');
                    if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#ffff00' } });
                    }
                } else {
                    creep.drop(RESOURCE_ENERGY);
                    creep.say('Drop');
                }
            }
        }
    }
};

/**
 * Finds the best source for a harvester to target.
 * This is a CPU-optimized version that caches assignments.
 * @param {Creep} creep The harvester creep.
 * @returns {Source | null}
 */
function pickBestSource(creep) {
    const sources = creep.room.find(FIND_SOURCES);
    if (!sources.length) return null;

    // Cache source assignments for this tick to avoid repeated iterations over all creeps.
    if (!global.sourceAssignments || Game.time !== global.lastSourceAssignmentTick) {
        global.sourceAssignments = {};
        _.forEach(Game.creeps, c => {
            if (c.my && c.memory.role === 'harvester' && c.memory.targetSourceId) {
                global.sourceAssignments[c.memory.targetSourceId] = (global.sourceAssignments[c.memory.targetSourceId] || 0) + 1;
            }
        });
        global.lastSourceAssignmentTick = Game.time;
    }

    let bestSource = null;
    let minAssigned = Infinity;

    for (const source of sources) {
        // Ignore depleted sources unless it's the only option
        if (source.energy === 0 && sources.some(s => s.energy > 0)) continue;

        const assigned = global.sourceAssignments[source.id] || 0;
        if (assigned < minAssigned) {
            minAssigned = assigned;
            bestSource = source;
        }
    }

    // If all sources are taken, fall back to the closest one.
    if (!bestSource) {
        bestSource = creep.pos.findClosestByRange(sources);
    }

    return bestSource;
}