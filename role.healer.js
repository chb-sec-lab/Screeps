/**
 * Role: Healer v4.0 (Disciplined Medic)
 * Logic: Follows Leader. Waits at door if Leader is missing.
 */
module.exports = {
    run: function(creep) {
        if (!creep.memory.home) creep.memory.home = Game.spawns['Spawn1'].room.name;
        
        const targetRoom = creep.memory.target;
        const isMustering = (targetRoom === creep.memory.home);

        // --- 1. MUSTERING ---
        if (isMustering) {
            const realTarget = 'E58S55'; 
            const exitDir = creep.room.findExitTo(realTarget);
            const exit = creep.pos.findClosestByRange(exitDir);
            if (exit) creep.moveTo(exit, {range: 5});
            return;
        }

        // --- 2. TRANSIT ---
        if (creep.room.name !== targetRoom) {
            const exit = creep.pos.findClosestByRange(creep.room.findExitTo(targetRoom));
            creep.moveTo(exit, {visualizePathStyle: {stroke: '#00ff00'}});
            if (creep.hits < creep.hitsMax) creep.heal(creep); // Self heal on the move
            return;
        }

        // --- 3. TRIAGE (Healing Logic) ---
        const wounded = creep.pos.findInRange(FIND_MY_CREEPS, 3, {
            filter: (c) => c.hits < c.hitsMax
        });
        
        if (wounded.length > 0) {
            const patient = _.sortBy(wounded, c => c.hits)[0];
            if (creep.pos.isNearTo(patient)) creep.heal(patient);
            else creep.rangedHeal(patient);
        } else {
            // Pre-heal leader or self
            const leader = creep.pos.findClosestByRange(FIND_MY_CREEPS, {filter: c => c.memory.role === 'dismantler'});
            if (leader && creep.pos.isNearTo(leader)) creep.heal(leader);
            else if (creep.hits < creep.hitsMax) creep.heal(creep);
        }

        // --- 4. MOVEMENT (Formation) ---
        let leader = creep.pos.findClosestByRange(FIND_MY_CREEPS, {
            filter: (c) => c.memory.role === 'dismantler'
        });

        if (leader) {
            if (!creep.pos.isNearTo(leader)) {
                creep.moveTo(leader, {visualizePathStyle: {stroke: '#00ff00'}});
            }
        } else {
            // Leader Missing? Retreat to Door (Same as Defender)
            const exitToHome = creep.room.findExitTo(creep.memory.home);
            const entryPoint = creep.pos.findClosestByRange(exitToHome);
            if (entryPoint && !creep.pos.inRangeTo(entryPoint, 3)) {
                creep.moveTo(entryPoint);
                creep.say('WaitLdr');
            }
        }
    }
};