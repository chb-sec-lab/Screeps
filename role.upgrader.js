/**
 * role.upgrader - v6.0.0
 * Updated: 2026-02-11 20:34 CET (Amsterdam)
 */
module.exports = {
    run: function(creep) {
        // Auto-Recycle Reset Logic (Setzt den Idle-Timer zurück, solange er arbeitet)
        if (creep.memory.lastIdleTick !== Game.time - 1) creep.memory.idleCount = 0;

        // --- ACTIVE EVASION (KITING) ---
        const hostileCreeps = creep.room.find(FIND_HOSTILE_CREEPS, {
            filter: c => c.body.some(p => p.type === ATTACK || p.type === RANGED_ATTACK || p.type === HEAL)
        });
        const hostileCores = creep.room.find(FIND_HOSTILE_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_INVADER_CORE
        });
        const threats = [...hostileCreeps, ...hostileCores];

        if (threats.length > 0) {
            const closeThreats = threats.filter(h => creep.pos.getRangeTo(h) <= 5);
            if (closeThreats.length > 0) {
                creep.say('Kite!');
                const goals = closeThreats.map(h => ({ pos: h.pos, range: 7 }));
                const pathRes = PathFinder.search(creep.pos, goals, { flee: true, maxRooms: 2 }); // Flucht in Nachbarräume erlaubt!
                if (pathRes.path.length > 0) {
                    creep.move(creep.pos.getDirectionTo(pathRes.path[0]));
                }
                return; // Arbeit strikt blockieren, solange Gefahr droht!
            }
        }

        const targetRoom = creep.memory.targetRoom;

        if (targetRoom && creep.room.name !== targetRoom) {
            creep.moveTo(new RoomPosition(25, 25, targetRoom), { reusePath: 10, visualizePathStyle: { stroke: '#ffffff' } });
            return;
        }

        // --- BORDER BOUNCE FIX ---
        if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
            creep.moveTo(new RoomPosition(25, 25, creep.room.name), { reusePath: 5 });
            return;
        }

        if (creep.memory.upgrading && creep.store[RESOURCE_ENERGY] === 0) creep.memory.upgrading = false;
        if (!creep.memory.upgrading && creep.store.getFreeCapacity() === 0) creep.memory.upgrading = true;

        if (creep.memory.upgrading) {
            if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller, { reusePath: 5, visualizePathStyle: { stroke: '#ffff00' } });
            }
        } else {
            // --- EFFICIENT ENERGY ACQUISITION ---
            // Priority 1: Controller Link/Container (ideal for stationary upgrading)
            let source = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: s => (s.structureType === STRUCTURE_LINK || s.structureType === STRUCTURE_CONTAINER) &&
                             s.store && s.store[RESOURCE_ENERGY] > 50 &&
                             s.pos.inRangeTo(creep.room.controller, 3)
            });

            // Priority 2: Storage (main energy buffer)
            if (!source && creep.room.storage && creep.room.storage.store[RESOURCE_ENERGY] > 0) {
                source = creep.room.storage;
            }

            // Priority 3: Any other container
            if (!source) {
                source = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_CONTAINER && s.store && s.store[RESOURCE_ENERGY] > 50
                })
            }

            if (source) {
                if (creep.withdraw(source, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(source, { reusePath: 5, visualizePathStyle: { stroke: '#ffaa00' } });
                }
                return;
            }

            // Priority 4: Harvest (fallback for bootstrapping rooms)
            const natural = creep.pos.findClosestByRange(FIND_SOURCES_ACTIVE);
            if (natural) {
                if (creep.harvest(natural) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(natural, { reusePath: 5, visualizePathStyle: { stroke: '#ffaa00' } });
                }
                return;
            }
            
            creep.say('Idle:NoNrg');
            if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                creep.moveTo(new RoomPosition(25, 25, creep.room.name), { range: 22, reusePath: 5 });
            }
            creep.memory.lastIdleTick = Game.time;
            creep.memory.idleCount = (creep.memory.idleCount || 0) + 1;
            // Upgrader werden NIEMALS wegen Inaktivität recycelt. Sie warten einfach geduldig.
        }
    }
};
