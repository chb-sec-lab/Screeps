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
        // Auto-Recycle Reset Logic
        if (creep.memory.lastIdleTick !== Game.time - 1) {
            creep.memory.idleCount = 0;
        }

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
                creep.say('Flee:Enemy');
                const exit = creep.pos.findClosestByRange(creep.room.findExitTo(deliveryRoom));
                if (exit) creep.moveTo(exit, { visualizePathStyle: { stroke: '#ff0000' } });
            } else {
                creep.say('Wait:Safe');
                if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                    creep.moveTo(new RoomPosition(25, 25, creep.room.name), { range: 22 });
                }
                creep.memory.lastIdleTick = Game.time;
                creep.memory.idleCount = (creep.memory.idleCount || 0) + 1;
                if (creep.memory.idleCount > 100) creep.memory.recycle = true;
            }
            return; // Brich alle anderen Aktionen ab!
        }

        if (remoteTargetRoom) {
            // --- PRE-FLIGHT CHECK: Wait for healing if damaged before leaving safe room ---
            if (creep.hits < creep.hitsMax && creep.room.name === deliveryRoom) {
                creep.say('Wait:Heal');
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

                creep.say('Seek Drop');
                if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                    creep.moveTo(new RoomPosition(25, 25, creep.room.name), { range: 22 });
                }
                creep.memory.lastIdleTick = Game.time;
                creep.memory.idleCount = (creep.memory.idleCount || 0) + 1;
                if (creep.memory.idleCount > 100) creep.memory.recycle = true;
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

        // --- If empty: withdraw (drops first, then containers, then storage) ---
        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
            // 1. Pick up dropped energy (crucial before containers are built)
            const dropped = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
                filter: r => r.resourceType === RESOURCE_ENERGY && r.amount >= 50
            });
            if (dropped) {
                if (creep.pickup(dropped) === ERR_NOT_IN_RANGE) creep.moveTo(dropped, { visualizePathStyle: { stroke: '#ffaa00' } });
                return;
            }

            // 2. Tombstones & Ruins
            const tomb = creep.pos.findClosestByPath(FIND_TOMBSTONES, { filter: t => t.store && t.store[RESOURCE_ENERGY] > 0 });
            if (tomb) {
                if (creep.withdraw(tomb, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(tomb, { visualizePathStyle: { stroke: '#ffaa00' } });
                return;
            }
            const ruin = creep.pos.findClosestByPath(FIND_RUINS, { filter: r => r.store && r.store[RESOURCE_ENERGY] > 0 });
            if (ruin) {
                if (creep.withdraw(ruin, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(ruin, { visualizePathStyle: { stroke: '#ffaa00' } });
                return;
            }

            // 3. Containers
            let src = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s =>
                    s.structureType === STRUCTURE_CONTAINER &&
                    s.store &&
                    s.store[RESOURCE_ENERGY] >= 100 // Verhindert Micro-Transaktionen und erlaubt den Idle-Timer!
            });

            // 3.5 Core Link (Unload beamed energy into storage)
            if (!src && storage) {
                let coreLink = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_LINK && s.store[RESOURCE_ENERGY] >= 200 && s.pos.inRangeTo(storage, 2)
                });
                if (coreLink) src = coreLink;
            }

            // 4. Storage (NUR wenn Spawns, Extensions oder Türme auch wirklich Energie brauchen!)
            if (!src && storage && storage.store[RESOURCE_ENERGY] > 0) {
                const needsRefill = creep.room.find(FIND_STRUCTURES, {
                    filter: s => 
                        ((s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0) ||
                        (s.structureType === STRUCTURE_TOWER && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && s.store[RESOURCE_ENERGY] < s.store.getCapacity(RESOURCE_ENERGY) * 0.90)
                });
                if (needsRefill.length > 0) src = storage;
            }

            if (src) {
                if (creep.withdraw(src, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(src, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
            } else {
                creep.say('Idle:Empty');
                // Anti-Ping-Pong im Idle
                if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                    creep.moveTo(new RoomPosition(25, 25, creep.room.name), { range: 22 });
                }
                creep.memory.lastIdleTick = Game.time;
                creep.memory.idleCount = (creep.memory.idleCount || 0) + 1;
                if (creep.memory.idleCount > 100) creep.memory.recycle = true;
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

        creep.say('Idle:Full');
        if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
            creep.moveTo(new RoomPosition(25, 25, creep.room.name), { range: 22 });
        }
        creep.memory.lastIdleTick = Game.time;
        creep.memory.idleCount = (creep.memory.idleCount || 0) + 1;
        if (creep.memory.idleCount > 100) creep.memory.recycle = true;
    }
};
