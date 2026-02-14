/**
 * role.scavenger.js - SCOS v6.1.0
 * Purpose:
 *  - State 1: Scavenge dropped/ruin/tomb energy across active rooms.
 *  - State 2: Haul-assist from buffers to urgent room sinks.
 *  - State 3: Distribute/rebalance local room energy when no urgent work exists.
 */
const rooms = require('config.rooms');

module.exports = {
    run: function (creep) {
        const roomOrder = [rooms.TARGET, rooms.EXPANSION, rooms.HOME];
        const minPickup = 20;

        function getSalvageJobInRoom(roomName) {
            const room = Game.rooms[roomName];
            if (!room) return null;

            const dropped = room.find(FIND_DROPPED_RESOURCES, {
                filter: r => r.resourceType === RESOURCE_ENERGY && r.amount >= minPickup
            });
            if (dropped.length) {
                const target = (creep.room.name === roomName) ? creep.pos.findClosestByPath(dropped) : dropped[0];
                if (target) return { roomName: roomName, type: 'drop', id: target.id };
            }

            const ruins = room.find(FIND_RUINS, {
                filter: r => r.store && r.store[RESOURCE_ENERGY] > 0
            });
            if (ruins.length) {
                const target = (creep.room.name === roomName) ? creep.pos.findClosestByPath(ruins) : ruins[0];
                if (target) return { roomName: roomName, type: 'ruin', id: target.id };
            }

            const tombs = room.find(FIND_TOMBSTONES, {
                filter: t => t.store && t.store[RESOURCE_ENERGY] > 0
            });
            if (tombs.length) {
                const target = (creep.room.name === roomName) ? creep.pos.findClosestByPath(tombs) : tombs[0];
                if (target) return { roomName: roomName, type: 'tomb', id: target.id };
            }

            return null;
        }

        function getBestSalvageJob() {
            for (const roomName of roomOrder) {
                const job = getSalvageJobInRoom(roomName);
                if (job) return job;
            }
            return null;
        }

        function findDeliveryTarget(room) {
            if (!room) return null;

            let target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s =>
                    (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) &&
                    s.store &&
                    s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            });
            if (target) return target;

            target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s =>
                    s.structureType === STRUCTURE_TOWER &&
                    s.store &&
                    s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            });
            if (target) return target;

            target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s =>
                    s.store &&
                    s.store.getFreeCapacity &&
                    s.store.getFreeCapacity(RESOURCE_ENERGY) > 0 &&
                    (
                        s.structureType === STRUCTURE_STORAGE ||
                        s.structureType === STRUCTURE_CONTAINER
                    )
            });
            return target;
        }

        function findWithdrawTarget(room) {
            if (!room) return null;
            return creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s =>
                    s.store &&
                    s.store[RESOURCE_ENERGY] > 0 &&
                    (
                        s.structureType === STRUCTURE_CONTAINER ||
                        s.structureType === STRUCTURE_STORAGE ||
                        s.structureType === STRUCTURE_LINK
                    )
            });
        }

        function hasUrgentSink(room) {
            if (!room) return false;
            const needsSpawnEnergy = room.find(FIND_STRUCTURES, {
                filter: s =>
                    (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) &&
                    s.store &&
                    s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            }).length > 0;

            if (needsSpawnEnergy) return true;

            const needsTowerEnergy = room.find(FIND_STRUCTURES, {
                filter: s =>
                    s.structureType === STRUCTURE_TOWER &&
                    s.store &&
                    s.store.getFreeCapacity(RESOURCE_ENERGY) > 0 &&
                    s.store[RESOURCE_ENERGY] < s.store.getCapacity(RESOURCE_ENERGY) * 0.9
            }).length > 0;

            return needsTowerEnergy;
        }

        function doDeliver() {
            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) return false;
            const delivery = findDeliveryTarget(creep.room);
            if (!delivery) return false;
            if (creep.transfer(delivery, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(delivery, { visualizePathStyle: { stroke: '#00ffcc' } });
            }
            return true;
        }

        function doScavenge() {
            let job = null;

            // Keep current salvage assignment if still valid.
            if (creep.memory.salvageId && creep.memory.salvageRoom) {
                const obj = Game.getObjectById(creep.memory.salvageId);
                if (obj && obj.room && obj.room.name === creep.memory.salvageRoom) {
                    if ((obj.amount && obj.amount >= minPickup) || (obj.store && obj.store[RESOURCE_ENERGY] > 0)) {
                        job = {
                            roomName: creep.memory.salvageRoom,
                            type: creep.memory.salvageType,
                            id: creep.memory.salvageId
                        };
                    }
                }
            }

            if (!job) {
                job = getBestSalvageJob();
                if (!job) {
                    creep.memory.salvageId = null;
                    creep.memory.salvageRoom = null;
                    creep.memory.salvageType = null;
                    return false;
                }
                creep.memory.salvageId = job.id;
                creep.memory.salvageRoom = job.roomName;
                creep.memory.salvageType = job.type;
            }

            if (creep.room.name !== job.roomName) {
                const exit = creep.pos.findClosestByRange(creep.room.findExitTo(job.roomName));
                if (exit) creep.moveTo(exit, { visualizePathStyle: { stroke: '#ffffff' } });
                return true;
            }

            const target = Game.getObjectById(job.id);
            if (!target) {
                creep.memory.salvageId = null;
                creep.memory.salvageRoom = null;
                creep.memory.salvageType = null;
                return false;
            }

            if (job.type === 'drop') {
                if (creep.pickup(target) === ERR_NOT_IN_RANGE) creep.moveTo(target);
            } else {
                if (creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(target);
            }
            return true;
        }

        function doHaulAssist() {
            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                return doDeliver();
            }

            if (!hasUrgentSink(creep.room)) return false;

            const withdrawTarget = findWithdrawTarget(creep.room);
            if (!withdrawTarget) return false;
            if (creep.withdraw(withdrawTarget, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(withdrawTarget, { visualizePathStyle: { stroke: '#ffffff' } });
            }
            return true;
        }

        function doDistribute() {
            if (doDeliver()) return true;

            if (!hasUrgentSink(creep.room)) return false;

            const source = findWithdrawTarget(creep.room);
            if (!source) return false;
            if (creep.withdraw(source, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, { visualizePathStyle: { stroke: '#ffffff' } });
            }
            return true;
        }

        // Loaded scavengers must unload before taking new salvage work.
        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
            if (doDeliver()) return;
            if (creep.room.name !== rooms.HOME) {
                const exit = creep.pos.findClosestByRange(creep.room.findExitTo(rooms.HOME));
                if (exit) creep.moveTo(exit, { visualizePathStyle: { stroke: '#00ffcc' } });
                return;
            }
            if (doDistribute()) return;
        }

        // Deterministic priority prevents mode thrashing and ping-pong.
        if (doScavenge()) return;
        if (doHaulAssist()) return;
        if (doDistribute()) return;

        if (creep.room.name !== rooms.HOME) {
            const exit = creep.pos.findClosestByRange(creep.room.findExitTo(rooms.HOME));
            if (exit) creep.moveTo(exit, { visualizePathStyle: { stroke: '#555555' } });
            return;
        }

        creep.say('💤');
    }
};
