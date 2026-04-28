/**
 * role.janitor.js - SCOS MCA Maintenance Unit
 * Dedicated to maintaining infrastructure planned by the RemoteManager and RoomManager.
 * Focuses strictly on Roads, Containers, and Edge-Links.
 */
const survival = require('utils.survival');

module.exports = {
    run: function (creep) {
        // --- AUTO-RECYCLE RESET ---
        if (creep.memory.lastIdleTick !== Game.time - 1) {
            creep.memory.idleCount = 0;
        }

        // --- DEADLOCK CLEARANCE ---
        if (creep.memory.unreachableTimeout && Game.time >= creep.memory.unreachableTimeout) {
            creep.memory.unreachableTargetId = null;
            creep.memory.unreachableTimeout = null;
        }
        
        // --- UNIVERSAL SURVIVAL ---
        if (survival.fleeFromHostiles(creep)) return;

        // --- ROOM ROUTING ---
        // Unterstützt 'office' (neue Architektur) oder 'workRoom' (alte SCOS-Logik)
        const workRoom = creep.memory.office || creep.memory.workRoom || creep.room.name;

        if (creep.room.name !== workRoom) {
            const exit = creep.pos.findClosestByRange(creep.room.findExitTo(workRoom));
            if (exit) creep.moveTo(exit, { visualizePathStyle: { stroke: '#ffffff' } });
            return;
        }

        // --- BORDER BOUNCE FIX ---
        if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
            creep.moveTo(new RoomPosition(25, 25, creep.room.name));
            return;
        }

        // --- STATE MACHINE ---
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.working = false;
            creep.say('Get Nrg');
        }
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            creep.say('Sweep');
        }

        // --- EXECUTION: WORK MODE ---
        if (creep.memory.working) {
            
            // 1. Absolute Emergency: Failing Containers (< 20k hits)
            let target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: s => s.id !== creep.memory.unreachableTargetId &&
                             s.structureType === STRUCTURE_CONTAINER &&
                             s.hits < 20000
            });

            // 2. High Priority: Edge-Links & Core-Links (< 90% hits)
            if (!target) {
                target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: s => s.id !== creep.memory.unreachableTargetId &&
                                 s.structureType === STRUCTURE_LINK &&
                                 s.hits < s.hitsMax * 0.9
                });
            }

            // 3. Normal Maintenance: Decaying Roads and Containers (< 80% hits to avoid over-repairing)
            if (!target) {
                target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: s => s.id !== creep.memory.unreachableTargetId &&
                                 (s.structureType === STRUCTURE_ROAD || s.structureType === STRUCTURE_CONTAINER) &&
                                 s.hits < s.hitsMax * 0.8
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

            // 4. Fallback: Help the RoomManager build newly planned Roads, Links, or Containers
            const buildSite = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES, { 
                filter: s => s.id !== creep.memory.unreachableTargetId && 
                             (s.structureType === STRUCTURE_ROAD || s.structureType === STRUCTURE_LINK || s.structureType === STRUCTURE_CONTAINER)
            });

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

            // Idle if everything is clean
            creep.say('Idle:Clean');
            creep.memory.lastIdleTick = Game.time;
            creep.memory.idleCount = (creep.memory.idleCount || 0) + 1;
            if (creep.memory.idleCount > 150) creep.memory.recycle = true;
            
        } 
        // --- EXECUTION: ENERGY MODE ---
        else {
            // 1. Pick up dropped energy first (cleaning up)
            let energySource = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES, {
                filter: r => r.id !== creep.memory.unreachableTargetId && r.resourceType === RESOURCE_ENERGY && r.amount >= 50
            });

            // 2. Withdraw from Storage, Terminal, or Containers
            if (!energySource) {
                energySource = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: s => s.id !== creep.memory.unreachableTargetId &&
                                 s.store && s.store[RESOURCE_ENERGY] >= 100 &&
                                 (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE || s.structureType === STRUCTURE_TERMINAL)
                });
            }

            if (energySource) {
                const res = energySource.amount !== undefined ? creep.pickup(energySource) : creep.withdraw(energySource, RESOURCE_ENERGY);
                if (res === ERR_NOT_IN_RANGE) {
                    if (creep.moveTo(energySource, { visualizePathStyle: { stroke: '#ffaa00' } }) === ERR_NO_PATH) {
                        creep.say('NoPath:Nrg');
                        creep.memory.unreachableTargetId = energySource.id;
                        creep.memory.unreachableTimeout = Game.time + 10;
                    }
                }
                return;
            }

            // Idle if no energy is available
            creep.say('Idle:NoNrg');
            if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                creep.moveTo(new RoomPosition(25, 25, creep.room.name), { range: 22 });
            }
            creep.memory.lastIdleTick = Game.time;
            creep.memory.idleCount = (creep.memory.idleCount || 0) + 1;
            if (creep.memory.idleCount > 150) creep.memory.recycle = true;
        }
    }
};