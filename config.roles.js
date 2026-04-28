/**
 * config.roles.js - SCOS v6.2.2
 * Updated: 2026-02-15
 * Status: NO_WAR_MODE (Expansion Priority)
 */
module.exports = {
    generateName: function(role) {
        return `${role}_${Math.random().toString(16).slice(2, 6).toUpperCase()}`;
    },

    COUNTS: {
        // --- WIRTSCHAFTS-ROLLEN (Auskommentiert = KI übernimmt automatisch!) ---
        // harvester:   6,
        // hauler:      0,
        // scavenger:   0,
        // repairer:    0,
        // builder:     1,
        // upgrader:    4,
        // claimer:     0,
        // remoteMiner: 0, 
        // remoteHauler:0, 
        // janitor:     0,
        
        // --- MILITÄR & SPEZIAL-ROLLEN (Globale Steuerung) ---
        defender:    0,
        vanguard:    0, // NO WAR MODE
        medic:       0, // NO WAR MODE
        breacher:    0,
        healer:      0,
        resourceHauler:0, // New role: Mineral/compound transport & inter-colony transfers
        scout:       1  // 1 global scout wandering the map
    },

    BODIES: {
        // Upgraded to 5 WORK parts to perfectly match source regeneration (10e/tick),
        // enabling the "Fact-Based Scaling" protocol in main.js to function correctly.
        harvester:   [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE],
        hauler:      [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE],
        scavenger:   [CARRY, CARRY, CARRY, MOVE, MOVE, MOVE],
        repairer:    [WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE],
        defender:    [TOUGH, TOUGH, MOVE, MOVE, MOVE, ATTACK, ATTACK, RANGED_ATTACK],
        claimer:     [CLAIM, MOVE, MOVE], 
        remoteMiner: [WORK, WORK, CARRY, MOVE, MOVE, MOVE],
        builder:     [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE],
        upgrader:    [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE],
        vanguard:    [TOUGH, MOVE, MOVE, RANGED_ATTACK, HEAL], // Light version
        medic:       [MOVE, HEAL, HEAL],
        breacher:    [WORK, WORK, MOVE, MOVE],
        healer:      [MOVE, MOVE, MOVE, HEAL, HEAL, HEAL],
        mineralMiner:[WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE],
        chemist:     [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE], // 200 Carry capacity, fast on roads
        remoteHauler:[CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE], // Similar to local hauler, but for remote
        resourceHauler:[CARRY, CARRY, CARRY, CARRY, MOVE, MOVE],
        janitor:     [WORK, CARRY, CARRY, MOVE, MOVE], // MCA Maintenance
        scout:       [MOVE]
    }
};
