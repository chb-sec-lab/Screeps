/**
 * Role: Remote Miner
 * Logic: Travel -> Harvest Remote -> Return -> Deposit.
 */
module.exports = {
    run: function(creep) {
        // Init memory
        if (!creep.memory.home) creep.memory.home = Game.spawns['Spawn1'].room.name;
        if (!creep.memory.target) creep.memory.target = 'E58S55'; 

        // State Toggle
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.working = false;
            creep.say('Expe');
        }
        if (!creep.memory.working && creep.store.getFreeCapacity() == 0) {
            creep.memory.working = true;
            creep.say('Return');
        }

        if (creep.memory.working) {
            // --- RETURNING HOME ---
            if (creep.room.name !== creep.memory.home) {
                 const exit = creep.pos.findClosestByRange(creep.room.findExitTo(creep.memory.home));
                 creep.moveTo(exit, {visualizePathStyle: {stroke: '#ffffff'}});
            } else {
                // --- DEPOSITING ---
                // Prioritize Spawns/Extensions, then Tower, then Upgrading
                var targets = creep.room.find(FIND_STRUCTURES, {
                    filter: (structure) => {
                        return (structure.structureType == STRUCTURE_EXTENSION ||
                                structure.structureType == STRUCTURE_SPAWN ||
                                structure.structureType == STRUCTURE_TOWER) &&
                                structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                    }
                });

                if (targets.length > 0) {
                    var target = creep.pos.findClosestByRange(targets);
                    if (creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(target, {visualizePathStyle: {stroke: '#ffffff'}});
                    }
                } else {
                    // If base is full, upgrade controller
                     if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(creep.room.controller);
                    }
                }
            }
        } else {
            // --- GOING TO REMOTE ---
            if (creep.room.name !== creep.memory.target) {
                const exit = creep.pos.findClosestByRange(creep.room.findExitTo(creep.memory.target));
                creep.moveTo(exit, {visualizePathStyle: {stroke: '#ffaa00'}});
            } else {
                // --- MINING ---
                const source = creep.pos.findClosestByRange(FIND_SOURCES, {
                    filter: s => s.energy > 0
                });
                if (source) {
                    if (creep.harvest(source) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
                    }
                } else {
                    creep.say('NoSrc');
                }
            }
        }
    }
};