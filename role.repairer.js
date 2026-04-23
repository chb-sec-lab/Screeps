/**
 * role.repairer.js - SCOS v6.0.0
 * Purpose:
 *  - Keep infrastructure in assigned room healthy when towers are unavailable.
 *  - Maintain rampart minimum floor, then roads/containers, then other structures.
 */
const rooms = require('config.rooms');
const survival = require('utils.survival');
const RAMPART_MIN_HITS = 50000;
const RAMPART_SOFT_CAP = 100000;

module.exports = {
    run: function (creep) {
        // Auto-Recycle Reset Logic
        if (creep.memory.lastIdleTick !== Game.time - 1) {
            creep.memory.idleCount = 0;
        }

        // Clear unreachable target if the timeout has expired
        if (creep.memory.unreachableTimeout && Game.time >= creep.memory.unreachableTimeout) {
            creep.memory.unreachableTargetId = null;
            creep.memory.unreachableTimeout = null;
        }
        
        // --- UNIVERSAL SURVIVAL ---
        if (survival.fleeFromHostiles(creep)) return;

        const workRoom = creep.memory.workRoom || rooms.TARGET;

        if (creep.room.name !== workRoom) {
            const exit = creep.pos.findClosestByRange(creep.room.findExitTo(workRoom));
            if (exit) creep.moveTo(exit, { visualizePathStyle: { stroke: '#ffffff' } });
            return;
        }

        const working = creep.memory.working === true;
        if (working && creep.store[RESOURCE_ENERGY] === 0) creep.memory.working = false;
        if (!working && creep.store.getFreeCapacity() === 0) creep.memory.working = true;

        if (creep.memory.working) {
            // 1. Critical Defense (Absolute Priority)
            let target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: s => s.id !== creep.memory.unreachableTargetId && s.structureType === STRUCTURE_RAMPART && s.hits < RAMPART_MIN_HITS
            });

            // 2. Decaying Infrastructure (Roads & Containers)
            // 80% threshold ensures 100% repair energy efficiency (no max-HP overflow waste)
            if (!target) {
                target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: s =>
                        s.id !== creep.memory.unreachableTargetId &&
                        (s.structureType === STRUCTURE_ROAD || s.structureType === STRUCTURE_CONTAINER) &&
                        s.hits < s.hitsMax * 0.8
                });
            }

            // 3. Rampart Soft Cap (Buffer building during peace time)
            if (!target) {
                target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: s =>
                        s.id !== creep.memory.unreachableTargetId &&
                        s.structureType === STRUCTURE_RAMPART &&
                        s.hits < RAMPART_SOFT_CAP &&
                        creep.room.name === rooms.HOME
                });
            }

            // 4. Everything else (except Walls/Ramparts)
            if (!target) {
                target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: s =>
                        s.id !== creep.memory.unreachableTargetId &&
                        s.hits < s.hitsMax &&
                        s.structureType !== STRUCTURE_WALL &&
                        s.structureType !== STRUCTURE_RAMPART
                });
            }

            if (target) {
                if (creep.repair(target) === ERR_NOT_IN_RANGE) {
                    if (creep.moveTo(target, { visualizePathStyle: { stroke: '#00ffcc' } }) === ERR_NO_PATH) {
                        creep.say('NoPath:Rep');
                        creep.memory.unreachableTargetId = target.id;
                        creep.memory.unreachableTimeout = Game.time + 10;
                    }
                }
                return;
            }

            const buildSite = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES, { filter: s => s.id !== creep.memory.unreachableTargetId });
            if (buildSite) {
                if (creep.build(buildSite) === ERR_NOT_IN_RANGE) {
                    if (creep.moveTo(buildSite) === ERR_NO_PATH) {
                        creep.say('NoPath:Bld');
                        creep.memory.unreachableTargetId = buildSite.id;
                        creep.memory.unreachableTimeout = Game.time + 10;
                    }
                }
                return;
            }

            if (creep.room.controller) {
                if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                    if (creep.moveTo(creep.room.controller) === ERR_NO_PATH) {
                        creep.say('NoPath:Ctrl');
                        creep.memory.unreachableTargetId = creep.room.controller.id;
                        creep.memory.unreachableTimeout = Game.time + 10;
                    }
                }
            }
            return;
        }

        let energySource = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES, {
            filter: r => r.id !== creep.memory.unreachableTargetId && r.resourceType === RESOURCE_ENERGY && r.amount >= 20
        });
        if (energySource) {
            if (creep.pickup(energySource) === ERR_NOT_IN_RANGE) {
                if (creep.moveTo(energySource) === ERR_NO_PATH) {
                    creep.say('NoPath:Drp');
                    creep.memory.unreachableTargetId = energySource.id;
                    creep.memory.unreachableTimeout = Game.time + 10;
                }
            }
            return;
        }

        energySource = creep.pos.findClosestByRange(FIND_STRUCTURES, {
            filter: s =>
                s.id !== creep.memory.unreachableTargetId &&
                s.store &&
                s.store[RESOURCE_ENERGY] >= 50 &&
                (
                    s.structureType === STRUCTURE_CONTAINER ||
                    s.structureType === STRUCTURE_STORAGE ||
                    s.structureType === STRUCTURE_LINK
                )
        });
        if (energySource) {
            if (creep.withdraw(energySource, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                if (creep.moveTo(energySource) === ERR_NO_PATH) {
                    creep.say('NoPath:Wdr');
                    creep.memory.unreachableTargetId = energySource.id;
                    creep.memory.unreachableTimeout = Game.time + 10;
                }
            }
            return;
        }

        const source = creep.pos.findClosestByRange(FIND_SOURCES_ACTIVE, { filter: s => s.id !== creep.memory.unreachableTargetId });
        if (source) {
            if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                if (creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } }) === ERR_NO_PATH) {
                    creep.say('NoPath:Src');
                    creep.memory.unreachableTargetId = source.id;
                    creep.memory.unreachableTimeout = Game.time + 10;
                }
            }
            return;
        }

        creep.say('Idle:NoNrg');
        creep.memory.lastIdleTick = Game.time;
        creep.memory.idleCount = (creep.memory.idleCount || 0) + 1;
        if (creep.memory.idleCount > 500) creep.memory.recycle = true;
    }
};
