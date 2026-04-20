/**
 * role.remoteMiner.js - SCOS v8.0.0
 * Role: Autonomous remote mining outpost operator.
 * Behavior:
 *  - Travels to a target room.
 *  - Harvests a source and maintains its own container.
 *  - Builds and repairs the container as needed.
 *  - Does NOT leave the room to deliver energy. That is a hauler's job.
 */
const rooms = require('config.rooms');

module.exports = {
    run: function (creep) {
        const targetRoom = creep.memory.targetRoom || rooms.TARGET;
        const homeRoom = creep.memory.homeRoom || rooms.HOME;

        // --- 1. SURVIVAL: HOSTILE INTELLIGENCE & STABLE PARKING ---
        const targetView = Game.rooms[targetRoom];

        const hostileCreeps = targetView ? targetView.find(FIND_HOSTILE_CREEPS, {
            filter: (c) =>
                c.getActiveBodyparts(ATTACK) > 0 ||
                c.getActiveBodyparts(RANGED_ATTACK) > 0 ||
                c.getActiveBodyparts(HEAL) > 0
        }) : [];

        const hostileCores = targetView ? targetView.find(FIND_HOSTILE_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_INVADER_CORE
        }) : [];

        const hostilesInSight = hostileCreeps.length > 0 || hostileCores.length > 0;

        if (hostilesInSight) {
            creep.memory.lastDangerTick = Game.time;
        }

        // FIX "Amnesia": Remember danger for 50 ticks so they don't bounce at the border
        const isDangerous = hostilesInSight || (creep.memory.lastDangerTick && (Game.time - creep.memory.lastDangerTick < 50));

        if (isDangerous) {
            creep.say(hostilesInSight ? 'DANGER!' : 'Wait');
            if (creep.room.name === targetRoom) {
                const exit = creep.pos.findClosestByRange(creep.room.findExitTo(homeRoom));
                creep.moveTo(exit, { visualizePathStyle: { stroke: '#ff0000' } });
            } else {
                // Hold position in safe room to avoid "border dancing".
                creep.say('Standby');
                if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                    creep.moveTo(new RoomPosition(25, 25, creep.room.name), { range: 22 });
                }
            }
            return;
        }

        // --- 2. STATE MACHINE ---
        if (creep.memory.working && creep.store.getUsedCapacity() === 0) {
            creep.memory.working = false;
            creep.say('Harvest');
        }
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            creep.say('Work');
        }

        // --- 3. EXECUTION LOGIC ---
        if (!creep.memory.working) {
            // --- HARVEST MODE ---
            if (creep.room.name !== targetRoom) {
                if (creep.hits < creep.hitsMax && creep.room.name === homeRoom) {
                    creep.say('Wait:Heal');
                    return;
                }
                creep.moveTo(new RoomPosition(25, 25, targetRoom), { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
                return;
            }

            let source = creep.memory.sourceId ? Game.getObjectById(creep.memory.sourceId) : null;
            if (!source) {
                // If orchestrator didn't assign a source, find the first one and lock it.
                const sources = creep.room.find(FIND_SOURCES);
                if (sources.length > 0) source = sources[0];
                creep.memory.sourceId = source ? source.id : null;
            }

            if (!source) {
                creep.say('Wait:NoSrc');
                return;
            }

            const harvestResult = creep.harvest(source);
            if (harvestResult === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
            } else if (harvestResult === ERR_NOT_OWNER) {
                creep.say('Flee:Core');
                creep.memory.lastDangerTick = Game.time;
                const exit = creep.pos.findClosestByRange(creep.room.findExitTo(homeRoom));
                if (exit) creep.moveTo(exit, { visualizePathStyle: { stroke: '#ff0000' } });
            }
        } else {
            // --- WORK MODE (DEPOSIT, BUILD, REPAIR) ---
            if (creep.room.name !== targetRoom) {
                creep.moveTo(new RoomPosition(25, 25, targetRoom), { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
                return;
            }

            const source = creep.memory.sourceId ? Game.getObjectById(creep.memory.sourceId) : null;
            if (!source) {
                creep.say('No Source');
                return;
            }

            // Find or create a container near the source
            let container = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_CONTAINER && s.pos.inRangeTo(source, 2)
            });

            if (container) {
                // Container exists: repair or deposit
                if (container.hits < container.hitsMax * 0.8) {
                    if (creep.repair(container) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(container, { visualizePathStyle: { stroke: '#00ffcc' } });
                    }
                } else {
                    if (creep.transfer(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(container, { visualizePathStyle: { stroke: '#00ffcc' } });
                    }
                }
            } else {
                // No container: build one
                let site = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES, {
                    filter: s => s.structureType === STRUCTURE_CONTAINER && s.pos.inRangeTo(source, 2)
                });

                if (site) {
                    if (creep.build(site) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(site, { visualizePathStyle: { stroke: '#ffffff' } });
                    }
                } else {
                    // No site, create one. Find a valid spot next to the source.
                    const path = creep.room.findPath(creep.pos, source.pos, { ignoreCreeps: true, range: 1 });
                    if (path.length > 0) {
                        const pos = path[path.length - 1];
                        creep.room.createConstructionSite(pos.x, pos.y, STRUCTURE_CONTAINER);
                    }
                }
            }
        }
    }
};
