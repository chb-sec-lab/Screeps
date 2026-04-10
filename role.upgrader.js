/**
 * role.upgrader - v6.0.0
 * Updated: 2026-02-11 20:34 CET (Amsterdam)
 */
module.exports = {
    run: function(creep) {
        const targetRoom = creep.memory.targetRoom;

        if (targetRoom && creep.room.name !== targetRoom) {
            creep.moveTo(new RoomPosition(25, 25, targetRoom), { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
            return;
        }

        // --- BORDER BOUNCE FIX ---
        if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
            creep.moveTo(new RoomPosition(25, 25, creep.room.name));
            return;
        }

        if (creep.memory.upgrading && creep.store[RESOURCE_ENERGY] === 0) creep.memory.upgrading = false;
        if (!creep.memory.upgrading && creep.store.getFreeCapacity() === 0) creep.memory.upgrading = true;

        if (creep.memory.upgrading) {
            if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) creep.moveTo(creep.room.controller);
        } else {
            let src = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s =>
                    s.store &&
                    s.store[RESOURCE_ENERGY] > 0 &&
                    (
                        s.structureType === STRUCTURE_STORAGE ||
                        s.structureType === STRUCTURE_CONTAINER ||
                        s.structureType === STRUCTURE_LINK
                    )
            });

            if (!src) {
                src = creep.pos.findClosestByPath(FIND_RUINS, {
                    filter: r => r.store && r.store[RESOURCE_ENERGY] > 0
                });
            }

            if (!src) {
                src = creep.pos.findClosestByPath(FIND_TOMBSTONES, {
                    filter: t => t.store && t.store[RESOURCE_ENERGY] > 0
                });
            }

            if (!src) {
                src = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
                    filter: r => r.resourceType === RESOURCE_ENERGY && r.amount >= 25
                });
            }

            if (src) {
                const action = (src.amount !== undefined) ? creep.pickup(src) : creep.withdraw(src, RESOURCE_ENERGY);
                if (action === ERR_NOT_IN_RANGE) creep.moveTo(src);
                return;
            }

            const natural = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
            if (natural) {
                if (creep.harvest(natural) === ERR_NOT_IN_RANGE) creep.moveTo(natural);
            }
        }
    }
};
