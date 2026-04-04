/**
 * role.hauler.js - SCOS v6.0.3
 * Updated: 2026-02-13 11:15 CET (Europe/Amsterdam)
 *
 * Priorities (deliver):
 *  1) Towers (keep high, target ~90%+)
 *  2) Spawn/extensions
 *  3) Storage
 *
 * Priorities (withdraw):
 *  - Prefer containers (to keep them empty), then storage
 */
const rooms = require('config.rooms');

module.exports = {
    run: function (creep) {
        const remoteTargetRoom = creep.memory.targetRoom || null;
        const deliveryRoom = creep.memory.homeRoom || rooms.HOME;
        const localWorkRoom = creep.memory.workRoom || rooms.HOME;

        // --- 1. FEIND-VERMEIDUNG (EIGENSCHUTZ) ---
        let danger = false;
        if (creep.room.name !== deliveryRoom && creep.room.name !== localWorkRoom) {
            const hostiles = creep.room.find(FIND_HOSTILE_CREEPS, {
                filter: c => c.getActiveBodyparts(ATTACK) > 0 || c.getActiveBodyparts(RANGED_ATTACK) > 0 || c.getActiveBodyparts(HEAL) > 0
            });
            const cores = creep.room.find(FIND_HOSTILE_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_INVADER_CORE
            });
            if (hostiles.length > 0 || cores.length > 0) {
                danger = true;
                creep.memory.fleeCooldown = Game.time + 50; // Remember danger!
            }
        }

        if (danger || (creep.memory.fleeCooldown && Game.time < creep.memory.fleeCooldown)) {
            if (creep.room.name !== deliveryRoom && creep.room.name !== localWorkRoom) {
                creep.say('📢 Flee!');
                const exit = creep.pos.findClosestByRange(creep.room.findExitTo(deliveryRoom));
                if (exit) creep.moveTo(exit, { visualizePathStyle: { stroke: '#ff0000' } });
            } else {
                creep.say('💤 Safe');
            }
            return; // Brich alle anderen Aktionen ab!
        }

        if (remoteTargetRoom) {
            // --- PRE-FLIGHT CHECK: Wait for healing if damaged before leaving safe room ---
            if (creep.hits < creep.hitsMax && creep.room.name === deliveryRoom) {
                creep.say('🩹 Pit Stop');
                return; // Warte im sicheren Raum, bis der Tower dich vollgeheilt hat
            }

            // Assigned remote hauler: loot in target room, deliver in home room.
            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
                if (creep.room.name !== remoteTargetRoom) {
                    const exit = creep.pos.findClosestByRange(creep.room.findExitTo(remoteTargetRoom));
                    if (exit) creep.moveTo(exit);
                    return;
                }

                const dropped = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
                    filter: r => r.resourceType === RESOURCE_ENERGY && r.amount >= 100
                });
                if (dropped) {
                    if (creep.pickup(dropped) === ERR_NOT_IN_RANGE) creep.moveTo(dropped);
                    return;
                }

                const ruin = creep.pos.findClosestByPath(FIND_RUINS, {
                    filter: r => r.store && r.store[RESOURCE_ENERGY] > 0
                });
                if (ruin) {
                    if (creep.withdraw(ruin, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(ruin);
                    return;
                }

                const tomb = creep.pos.findClosestByPath(FIND_TOMBSTONES, {
                    filter: t => t.store && t.store[RESOURCE_ENERGY] > 0
                });
                if (tomb) {
                    if (creep.withdraw(tomb, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(tomb);
                    return;
                }

                const container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_CONTAINER && s.store && s.store[RESOURCE_ENERGY] >= 200
                });
                if (container) {
                    if (creep.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(container);
                    return;
                }

                creep.say('🧭 Loot?');
                return;
            }

            if (creep.room.name !== deliveryRoom) {
                const exit = creep.pos.findClosestByRange(creep.room.findExitTo(deliveryRoom));
                if (exit) creep.moveTo(exit);
                return;
            }
        } else if (creep.room.name !== localWorkRoom) {
            const exit = creep.pos.findClosestByRange(creep.room.findExitTo(localWorkRoom));
            if (exit) creep.moveTo(exit);
            return;
        }

        const storage = creep.room.storage;

        // --- If empty: withdraw (containers first, then storage) ---
        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
            let src = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s =>
                    s.structureType === STRUCTURE_CONTAINER &&
                    s.store &&
                    s.store[RESOURCE_ENERGY] > 0
            });

            if (!src && storage && storage.store[RESOURCE_ENERGY] > 0) src = storage;

            if (src) {
                if (creep.withdraw(src, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(src);
                }
            } else {
                creep.say('🚫E');
            }
            return;
        }

        // --- If carrying: deliver by priority ---

        // 1) Towers first: keep them near full
        const towersNeed = creep.room.find(FIND_STRUCTURES, {
            filter: s =>
                s.structureType === STRUCTURE_TOWER &&
                s.store.getFreeCapacity(RESOURCE_ENERGY) > 0 &&
                s.store[RESOURCE_ENERGY] < s.store.getCapacity(RESOURCE_ENERGY) * 0.90
        });

        if (towersNeed.length) {
            const t = creep.pos.findClosestByPath(towersNeed);
            if (t && creep.transfer(t, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(t);
            return;
        }

        // 2) Spawn/extensions
        const spawnExt = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: s =>
                (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) &&
                s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });

        if (spawnExt) {
            if (creep.transfer(spawnExt, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(spawnExt);
            return;
        }

        // 3) Storage
        if (storage && storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
            if (creep.transfer(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(storage);
            return;
        }

        creep.say('💤');
    }
};
