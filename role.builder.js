var roleBuilder = {
    /** @param {Creep} creep **/
    run: function(creep) {
        // Zustandswechsel: Sammeln vs. Bauen
        if(creep.memory.working && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.working = false;
            creep.say('🔄 harvest');
        }
        if(!creep.memory.working && creep.store.getFreeCapacity() == 0) {
            creep.memory.working = true;
            creep.say('🚧 build');
        }

        if(creep.memory.working) {
            // Suche nach Baustellen
            var targets = creep.room.find(FIND_CONSTRUCTION_SITES);
            if(targets.length > 0) {
                // Nimm die erste Baustelle (oder die nächste)
                if(creep.build(targets) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(targets, {visualizePathStyle: {stroke: '#ffffff'}});
                }
            } else {
                // Wenn nichts zu bauen ist: Parken oder Upgraden (als Fallback)
                // Für jetzt: Hilf beim Upgraden, damit er nicht nutzlos rumsteht
                if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#ffffff'}});
                }
            }
        }
        else {
            // Energie besorgen (Quellen oder später Storage)
            var sources = creep.room.find(FIND_SOURCES);
            if(creep.harvest(sources) == ERR_NOT_IN_RANGE) {
                creep.moveTo(sources, {visualizePathStyle: {stroke: '#ffaa00'}});
            }
        }
    }
};

module.exports = roleBuilder;