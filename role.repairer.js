/**
 * role.repairer.js - SCOS v6.0.0
 * Purpose:
 *  - Keep infrastructure in assigned room healthy when towers are unavailable.
 *  - Maintain rampart minimum floor, then roads/containers, then other structures.
 */
const rooms = require('config.rooms');
const RAMPART_MIN_HITS = 10000;
const RAMPART_SOFT_CAP = 50000;

module.exports = {
    run: function (creep) {
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
            let target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s =>
                    s.structureType === STRUCTURE_RAMPART &&
                    s.hits < RAMPART_MIN_HITS
            });

            if (!target) {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: s =>
                        s.structureType === STRUCTURE_RAMPART &&
                        s.hits < RAMPART_SOFT_CAP &&
                        creep.room.name === rooms.HOME
                });
            }

            if (target) {
                if (creep.repair(target) === ERR_NOT_IN_RANGE) creep.moveTo(target, { visualizePathStyle: { stroke: '#00ffcc' } });
                return;
            }

            target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s =>
                    (s.structureType === STRUCTURE_ROAD || s.structureType === STRUCTURE_CONTAINER) &&
                    s.hits < s.hitsMax * 0.9
            });

            if (!target) {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: s =>
                        s.hits < s.hitsMax &&
                        s.structureType !== STRUCTURE_WALL &&
                        s.structureType !== STRUCTURE_RAMPART
                });
            }

            if (target) {
                if (creep.repair(target) === ERR_NOT_IN_RANGE) creep.moveTo(target, { visualizePathStyle: { stroke: '#00ffcc' } });
                return;
            }

            const buildSite = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
            if (buildSite) {
                if (creep.build(buildSite) === ERR_NOT_IN_RANGE) creep.moveTo(buildSite);
                return;
            }

            if (creep.room.controller) {
                if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) creep.moveTo(creep.room.controller);
            }
            return;
        }

        let energySource = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
            filter: r => r.resourceType === RESOURCE_ENERGY && r.amount >= 20
        });
        if (energySource) {
            if (creep.pickup(energySource) === ERR_NOT_IN_RANGE) creep.moveTo(energySource);
            return;
        }

        energySource = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: s =>
                s.store &&
                s.store[RESOURCE_ENERGY] > 0 &&
                (
                    s.structureType === STRUCTURE_CONTAINER ||
                    s.structureType === STRUCTURE_STORAGE ||
                    s.structureType === STRUCTURE_LINK
                )
        });
        if (energySource) {
            if (creep.withdraw(energySource, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(energySource);
            return;
        }

        const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
        if (source) {
            if (creep.harvest(source) === ERR_NOT_IN_RANGE) creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
            return;
        }

        creep.say('🚫E');
    }
};
