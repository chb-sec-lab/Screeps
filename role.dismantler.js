/**
 * Role: Dismantler v4.0 (Rally Point)
 * Logic: Hostiles > Roads/Containers > Stomper.
 * UPDATE: Parks near the Target Exit while waiting, not at 20,20.
 */
module.exports = {
    run: function(creep) {
        // Init Memory
        if (!creep.memory.home) creep.memory.home = Game.spawns['Spawn1'].room.name;
        
        const targetRoom = creep.memory.target;
        // Determine if we are in "Mustering" mode (Target set to Home)
        const isMustering = (targetRoom === creep.memory.home);

        // --- 1. MUSTERING LOGIC (Wait at the Border) ---
        if (isMustering) {
            // Find the exit to the "Real" target (stored in config or assumed E58S55)
            // We use a temporary lookahead to find where we SHOULD be waiting.
            const realTarget = 'E58S55'; 
            const exitDir = creep.room.findExitTo(realTarget);
            const exit = creep.pos.findClosestByRange(exitDir);
            
            if (exit) {
                // Park 5 tiles away from the exit to avoid blocking it, but stay ready.
                creep.moveTo(exit, {range: 5, visualizePathStyle: {stroke: '#555555'}});
            } else {
                creep.moveTo(20, 20); // Fallback if no exit found
            }
            creep.say('Hold');
            return;
        }

        // --- 2. TRAVEL LOGIC ---
        if (creep.room.name !== targetRoom) {
            const exit = creep.pos.findClosestByRange(creep.room.findExitTo(targetRoom));
            creep.moveTo(exit, {visualizePathStyle: {stroke: '#ff0000'}});
        } else {
            // --- 3. COMBAT LOGIC (Target Room) ---
            
            // Priority 1: Hostile Structures (Excluding Controller/Ramparts)
            let target = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
                filter: (s) => s.structureType !== STRUCTURE_CONTROLLER && 
                               s.structureType !== STRUCTURE_RAMPART
            });

            // Priority 2: Clutter (Roads/Containers)
            if (!target) {
                target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: (s) => s.structureType === STRUCTURE_CONTAINER || 
                                   s.structureType === STRUCTURE_ROAD
                });
            }

            if (target) {
                if (creep.dismantle(target) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, {visualizePathStyle: {stroke: '#ff0000'}});
                }
            } else {
                // Priority 3: Stomp Construction Sites
                let site = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
                if (site) {
                    creep.moveTo(site, {visualizePathStyle: {stroke: '#ffff00'}});
                } else {
                    // Priority 4: Park at Controller
                    if (creep.room.controller && !creep.pos.inRangeTo(creep.room.controller, 3)) {
                         creep.moveTo(creep.room.controller, {range: 3});
                    }
                }
            }
        }
    }
};