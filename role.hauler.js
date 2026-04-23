/**
 * role.hauler.js - SCOS v9.0.0 "The Forever Fix"
 * This is a hyper-simplified, robust hauler based on the Single Responsibility Principle.
 * Its ONLY job is to move energy within its assigned room. It is predictable and stable.
 * It does NOT handle remote hauling, minerals, or global exports.
 */
const rooms = require('config.rooms');
const survival = require('utils.survival');

module.exports = {
    run: function (creep) {
        // --- Universal Reset & Survival Logic ---
        if (creep.memory.lastIdleTick !== Game.time - 1) {
            creep.memory.idleCount = 0;
        }

        // Clear unreachable target if the timeout has expired
        if (creep.memory.unreachableTimeout && Game.time >= creep.memory.unreachableTimeout) {
            creep.memory.unreachableTargetId = null;
            creep.memory.unreachableTimeout = null;
            creep.memory.idleCount = 0;
        }

        // --- UNIVERSAL SURVIVAL ---
        if (survival.fleeFromHostiles(creep)) return;

        const workRoom = creep.memory.workRoom || creep.room.name;
        if (creep.room.name !== workRoom) {
            creep.moveTo(new RoomPosition(25, 25, workRoom), { reusePath: 10, visualizePathStyle: { stroke: '#ffffff' } });
            return;
        }

        // --- Simple State Machine ---
        if (creep.memory.working && creep.store.getUsedCapacity() === 0) {
            creep.memory.working = false;
            creep.say('Get Nrg');
        }
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            creep.say('Work');
        }

        // --- Core Logic ---
        if (creep.memory.working) {
            // --- DELIVER ENERGY ---
            // P1: Spawns & Extensions (to prevent economic death)
            let target = creep.pos.findClosestByRange(FIND_STRUCTURES, { filter: s => s.id !== creep.memory.unreachableTargetId &&
                (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) &&
                 s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            });

            // P2: Towers (for defense)
            if (!target) {
                target = creep.pos.findClosestByRange(FIND_STRUCTURES, { filter: s => s.id !== creep.memory.unreachableTargetId &&
                    s.structureType === STRUCTURE_TOWER && s.store.getFreeCapacity(RESOURCE_ENERGY) > 200
                });
            }

            // P3: Controller Container/Link (for upgraders)
            if (!target && creep.room.controller) {
                target = creep.pos.findClosestByRange(FIND_STRUCTURES, { filter: s => s.id !== creep.memory.unreachableTargetId &&
                    (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_LINK) &&
                     s.pos.inRangeTo(creep.room.controller, 3) &&
                     s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                });
            }

            // P4: Storage (final dump)
            if (!target) {
                target = creep.room.storage;
                if (target && (target.id === creep.memory.unreachableTargetId || target.store.getFreeCapacity(RESOURCE_ENERGY) === 0)) target = null;
            }

            if (target) {
                if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    const moveResult = creep.moveTo(target, { reusePath: 5, visualizePathStyle: { stroke: '#ffffff' } });
                    if (moveResult === ERR_NO_PATH) {
                        creep.say('NoPath!');
                        creep.memory.unreachableTargetId = target.id;
                        creep.memory.unreachableTimeout = Game.time + 10;
                    }
                }
            } else {
                idle(creep, 'Full');
            }
        } else {
            // --- WITHDRAW ENERGY ---
            // P1: Fullest Container (to keep miners working)
            const containers = creep.room.find(FIND_STRUCTURES, { filter: s => s.id !== creep.memory.unreachableTargetId &&
                s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 200
            });
            let target = null;
            if (containers.length > 0) {
                // Use Array.prototype.reduce for a concise and safe way to find the fullest container,
                // avoiding potentially unreliable Lodash helpers in the Screeps runtime.
                target = containers.reduce((fullest, c) => 
                    (!fullest || c.store.getUsedCapacity(RESOURCE_ENERGY) > fullest.store.getUsedCapacity(RESOURCE_ENERGY)) ? c : fullest, 
                null);
            }

            // P2: Storage (if containers are low)
            // FIX: Only withdraw from storage if there is an urgent need (Spawns, Extensions, Towers).
            // This prevents haulers from getting stuck in a loop when all sinks are full.
            // This is a direct implementation of the lesson from alert log 2026-02-17T00:30:00Z.
            if (!target && creep.room.storage && creep.room.storage.store[RESOURCE_ENERGY] > 0 && creep.room.storage.id !== creep.memory.unreachableTargetId) {
                if (hasUrgentSink(creep.room)) {
                    target = creep.room.storage;
                }
            }

            // P3: Dropped resources/ruins (cleanup)
            if (!target) {
                target = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES, { filter: r => r.id !== creep.memory.unreachableTargetId &&
                    r.resourceType === RESOURCE_ENERGY && r.amount > 100
                });
            }

            if (target) {
                const res = (target.amount !== undefined) ? creep.pickup(target) : creep.withdraw(target, RESOURCE_ENERGY);
                if (res === ERR_NOT_IN_RANGE) {
                    const moveResult = creep.moveTo(target, { reusePath: 5, visualizePathStyle: { stroke: '#ffaa00' } });
                    if (moveResult === ERR_NO_PATH) {
                        creep.say('NoPath!');
                        creep.memory.unreachableTargetId = target.id;
                        creep.memory.unreachableTimeout = Game.time + 10;
                    }
                }
            } else {
                idle(creep, 'Empty');
            }
        }
    }
};

function idle(creep, state) {
    creep.say(`Idle:${state}`);
    // Anti-border-bounce logic
    if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
        creep.moveTo(new RoomPosition(25, 25, creep.room.name), { range: 22, reusePath: 5 });
    }
    creep.memory.lastIdleTick = Game.time;
    creep.memory.idleCount = (creep.memory.idleCount || 0) + 1;
    // Auto-recycle if idle for too long
    if (creep.memory.idleCount > 100) creep.memory.recycle = true;
}

function hasUrgentSink(room) {
    if (!room) return false;
    // P1: Spawns & Extensions
    const needsSpawnEnergy = room.find(FIND_STRUCTURES, {
        filter: s =>
            (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) &&
            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    }).length > 0;
    if (needsSpawnEnergy) return true;

    // P2: Towers
    const needsTowerEnergy = room.find(FIND_STRUCTURES, {
        filter: s =>
            s.structureType === STRUCTURE_TOWER &&
            s.store.getFreeCapacity(RESOURCE_ENERGY) > 200 // Only if it needs a decent amount
    }).length > 0;
    return needsTowerEnergy;
}
