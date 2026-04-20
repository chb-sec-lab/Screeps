/**
 * role.remoteHauler.js - SCOS v9.1.0
 * This is a dedicated hauler for remote mining operations.
 * Its ONLY job is to move energy from a remote room to a core base.
 */
const rooms = require('config.rooms');

module.exports = {
    run: function(creep) {
        // --- State Machine ---
        if (creep.memory.working && creep.store.getUsedCapacity() === 0) {
            creep.memory.working = false;
            creep.say('Get Nrg');
        }
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            creep.say('Deliver');
        }

        const homeRoom = creep.memory.homeRoom;
        const targetRoom = creep.memory.targetRoom;
        if (!targetRoom || !homeRoom) {
            creep.say('ERR:CFG');
            return;
        }

        // --- Survival Logic ---
        // Flee from hostiles in the target room
        let danger = false;
        if (creep.room.name === targetRoom) {
            const hostileCreeps = creep.room.find(FIND_HOSTILE_CREEPS, { filter: c => c.getActiveBodyparts(ATTACK) > 0 || c.getActiveBodyparts(RANGED_ATTACK) > 0 });
            const cores = creep.room.find(FIND_HOSTILE_STRUCTURES, { filter: s => s.structureType === STRUCTURE_INVADER_CORE });
            if (hostileCreeps.length > 0 || cores.length > 0) {
                danger = true;
                creep.memory.fleeCooldown = Game.time + 50; // Remember danger to prevent bouncing
            }
        }
        if (danger || (creep.memory.fleeCooldown && Game.time < creep.memory.fleeCooldown)) {
            if (creep.room.name !== homeRoom) {
                creep.say('Flee!');
                creep.moveTo(new RoomPosition(25, 25, homeRoom), { reusePath: 10, visualizePathStyle: { stroke: '#ff0000' } });
            } else {
                creep.say('Wait:Safe');
            }
            return;
        }

        // Pre-flight healing check in home room
        if (creep.hits < creep.hitsMax && creep.room.name === homeRoom) {
            creep.say('Wait:Heal');
            return;
        }

        // --- Core Logic ---
        if (creep.memory.working) {
            // --- DELIVER MODE ---
            if (creep.room.name !== homeRoom) {
                creep.moveTo(new RoomPosition(25, 25, homeRoom), { reusePath: 10, visualizePathStyle: { stroke: '#ffffff' } });
                return;
            }
            // Delivery priorities: Spawns > Towers > Storage
            let target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: s => (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) &&
                             s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            });
            if (!target) {
                target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_TOWER && s.store.getFreeCapacity(RESOURCE_ENERGY) > 200
                });
            }
            if (!target && creep.room.storage) {
                target = creep.room.storage;
                if (target.store.getFreeCapacity(RESOURCE_ENERGY) === 0) target = null;
            }
            if (target) {
                if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { reusePath: 5, visualizePathStyle: { stroke: '#ffffff' } });
                }
            } else {
                creep.say('Idle:Full');
            }
        } else {
            // --- WITHDRAW MODE ---
            if (creep.room.name !== targetRoom) {
                creep.moveTo(new RoomPosition(25, 25, targetRoom), { reusePath: 10, visualizePathStyle: { stroke: '#ffaa00' } });
                return;
            }
            // Pickup priorities: Drops > Containers
            let target = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES, { filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 100 });
            if (!target) {
                target = creep.pos.findClosestByRange(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 200 });
            }
            if (target) {
                const res = (target.amount !== undefined) ? creep.pickup(target) : creep.withdraw(target, RESOURCE_ENERGY);
                if (res === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { reusePath: 5, visualizePathStyle: { stroke: '#ffaa00' } });
                }
            } else {
                creep.say('Wait:Nrg');
            }
        }
    }
};