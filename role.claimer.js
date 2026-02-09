/**
 * Role: Claimer v4.2 (Survivalist)
 * Logic: Waits for Squad. Reserves Controller.
 * UPDATE: Flees immediately if armed enemies are close.
 */
module.exports = {
    run: function(creep) {
        if (!creep.memory.home) creep.memory.home = Game.spawns['Spawn1'].room.name;
        
        const targetRoom = creep.memory.target;
        const isMustering = (targetRoom === creep.memory.home);

        // --- 1. MUSTERING (Wait for Army) ---
        if (isMustering) {
            // Wait near the exit, but stay behind the army (Range 6 is safe)
            const realTarget = 'E58S55'; 
            const exitDir = creep.room.findExitTo(realTarget);
            const exit = creep.pos.findClosestByRange(exitDir);
            if (exit) creep.moveTo(exit, {range: 6, visualizePathStyle: {stroke: '#ffffff'}});
            creep.say('WaitCmd');
            return;
        }

        // --- 2. TRANSIT ---
        if (creep.room.name !== targetRoom) {
            const exit = creep.pos.findClosestByRange(creep.room.findExitTo(targetRoom));
            creep.moveTo(exit, {visualizePathStyle: {stroke: '#ffaa00'}, reusePath: 20});
            return;
        } 

        // --- 3. TARGET ROOM SURVIVAL ---
        
        // SCAN: Are there armed enemies nearby?
        const dangerousHostiles = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 5, {
            filter: c => c.getActiveBodyparts(ATTACK) > 0 || c.getActiveBodyparts(RANGED_ATTACK) > 0
        });

        // FLEE: If enemies are close, run back to Home immediately.
        if (dangerousHostiles.length > 0) {
            const exitToHome = creep.room.findExitTo(creep.memory.home);
            const exit = creep.pos.findClosestByRange(exitToHome);
            creep.moveTo(exit, {visualizePathStyle: {stroke: '#ff0000'}, reusePath: 0});
            creep.say('RUN!');
            return;
        }

        // COVER: If no immediate danger, stick to the Tank (Dismantler)
        const leader = creep.pos.findClosestByRange(FIND_MY_CREEPS, {filter: c => c.memory.role === 'dismantler'});
        const hostilesInRoom = creep.room.find(FIND_HOSTILE_CREEPS);

        // If there are enemies anywhere in the room, stay glued to the Tank
        if (hostilesInRoom.length > 0 && leader) {
            if (creep.pos.getRangeTo(leader) > 3) {
                creep.moveTo(leader, {visualizePathStyle: {stroke: '#ffffff'}});
                creep.say('Cover');
                return;
            }
        }

        // --- 4. MISSION: CONTROLLER ---
        // Only if safe-ish
        if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
            creep.moveTo(25, 25);
            return;
        }

        const controller = creep.room.controller;
        if (controller) {
            let result = creep.claimController(controller);
            if (result == ERR_GCL_NOT_ENOUGH) {
                creep.reserveController(controller);
            } else if (result == ERR_NOT_IN_RANGE) {
                creep.moveTo(controller, {visualizePathStyle: {stroke: '#ffffff'}});
            }
        }
    }
};