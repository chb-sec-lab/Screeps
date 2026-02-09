/**
 * Role: Defender v4.0 (Door Guardian)
 * Logic: Ranged Hybrid.
 * UPDATE: If Leader is missing in target room, waits at the door. DOES NOT SUICIDE RUN.
 */
module.exports = {
    run: function(creep) {
        // Init Memory
        if (!creep.memory.home) creep.memory.home = Game.spawns['Spawn1'].room.name;

        var targetRoom = creep.memory.target;
        const isMustering = (targetRoom === creep.memory.home);

        // --- 1. MUSTERING LOGIC ---
        if (isMustering) {
            const realTarget = 'E58S55'; 
            const exitDir = creep.room.findExitTo(realTarget);
            const exit = creep.pos.findClosestByRange(exitDir);
            if (exit) {
                // Defenders park slightly closer (Range 4) to be ready
                creep.moveTo(exit, {range: 4, visualizePathStyle: {stroke: '#555555'}});
            }
            creep.say('Hold');
            return;
        }

        // --- 2. TRANSIT LOGIC ---
        if (creep.room.name !== targetRoom) {
            var exit = creep.pos.findClosestByRange(creep.room.findExitTo(targetRoom));
            creep.moveTo(exit, {visualizePathStyle: {stroke: '#ff0000'}});
            return; 
        } 

        // --- 3. COMBAT LOGIC (In Target Room) ---
        
        // Find Leader (Dismantler)
        const leader = creep.pos.findClosestByRange(FIND_MY_CREEPS, {
            filter: (c) => c.memory.role === 'dismantler'
        });

        const hostile = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);

        // Always Auto-Fire if possible (Opportunity Fire)
        if (hostile && creep.pos.inRangeTo(hostile, 3)) {
            creep.rangedAttack(hostile);
            if (creep.pos.isNearTo(hostile)) creep.attack(hostile); 
        }
        // Always Self-Heal
        if (creep.hits < creep.hitsMax) creep.heal(creep);

        // MOVEMENT DECISIONS
        if (leader) {
            // --- SCENARIO A: Leader Present ---
            // Stick to leader.
            if (!creep.pos.inRangeTo(leader, 2)) {
                creep.moveTo(leader, {visualizePathStyle: {stroke: '#0000ff'}});
            } else if (hostile && !creep.pos.inRangeTo(hostile, 3)) {
                // Micro-step towards enemy ONLY if we stay close to leader
                 if (creep.pos.inRangeTo(leader, 2)) {
                     creep.moveTo(hostile);
                 }
            }
        } else {
            // --- SCENARIO B: Leader Missing (CRITICAL FIX) ---
            // If we are in enemy room but leader is NOT here, we probably ran in too fast.
            // DO NOT ADVANCE. Go back to the entrance we came from.
            
            const exitToHome = creep.room.findExitTo(creep.memory.home);
            const entryPoint = creep.pos.findClosestByRange(exitToHome);
            
            if (entryPoint) {
                // Hold position at the door.
                if (!creep.pos.inRangeTo(entryPoint, 3)) {
                    creep.moveTo(entryPoint, {visualizePathStyle: {stroke: '#ffffff'}});
                    creep.say('WaitLdr');
                } else {
                    // We are at the door. Just hold.
                    // If enemy comes to US, we fight (handled by auto-fire above).
                    // But we don't chase them.
                }
            }
        }
    }
};