/**
 * role.mineralMiner.js - SCOS v6.3.0
 * Role: Dedicated Mineral Extractor
 * Behavior: Harvests minerals from Extractors and deposits them directly into the room's Terminal or Storage.
 */
module.exports = {
    run: function(creep) {
        const workRoom = creep.memory.workRoom || creep.room.name;
        
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

        // Travel to designated room
        if (creep.room.name !== workRoom) {
            const exit = creep.pos.findClosestByRange(creep.room.findExitTo(workRoom));
            if (exit) creep.moveTo(exit, {visualizePathStyle: {stroke: '#00ffff'}});
            return;
        }

        // State machine
        if (creep.memory.mining && creep.store.getFreeCapacity() === 0) creep.memory.mining = false;
        if (!creep.memory.mining && creep.store.getUsedCapacity() === 0) creep.memory.mining = true;

        if (creep.memory.mining) {
            const mineral = creep.room.find(FIND_MINERALS)[0];
            if (mineral) {
                if (mineral.amount === 0) {
                    creep.say('Depleted');
                    // Ein Creep lebt 1500 Ticks, Regeneration dauert 50.000 Ticks. Schlafen ist mathematisch sinnlos!
                    // Zwinge ihn sofort in den Schredder. Das Universal Recycle Command (main.js) entleert seinen Rucksack automatisch auf dem Weg.
                    creep.memory.recycle = true;
                    return;
                }
                
                const res = creep.harvest(mineral);
                if (res === ERR_NOT_IN_RANGE) {
                    creep.moveTo(mineral, {visualizePathStyle: {stroke: '#00ffff'}});
                }
            }
        } else {
            // Deposit in Terminal first, then Storage
            let target = creep.room.terminal;
            if (!target || target.store.getFreeCapacity() < 1000) target = creep.room.storage;

            if (target) {
                const resType = Object.keys(creep.store)[0]; // Dynamically get what mineral we are carrying
                if (resType && creep.transfer(target, resType) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, {visualizePathStyle: {stroke: '#ffffff'}});
                }
            } else {
                creep.say('Idle:Full');
            }
        }
    }
};