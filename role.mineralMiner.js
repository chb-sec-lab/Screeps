/**
 * role.mineralMiner.js - SCOS v6.3.0
 * Role: Dedicated Mineral Extractor
 * Behavior: Harvests minerals from Extractors and deposits them directly into the room's Terminal or Storage.
 */
module.exports = {
    run: function(creep) {
        const workRoom = creep.memory.workRoom || creep.room.name;
        
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
                    creep.say('💤 Empty');
                    return; // Mineral depleted, wait for regeneration
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
                creep.say('🚫 No Sink');
            }
        }
    }
};