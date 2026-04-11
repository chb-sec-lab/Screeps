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
        harvester:   6,
        hauler:      0, // Disabled for early game bootstrap (no containers yet)
        scavenger:   0, // Disabled for early game bootstrap
        repairer:    0,
        defender:    0,
        claimer:     0,
        remoteMiner: 0, // Managed exclusively by room quotas in main.js
        builder:     1,
        upgrader:    4,
        vanguard:    0, // NO WAR MODE
        medic:       0, // NO WAR MODE
        breacher:    0,
        healer:      0,
        mineralMiner:0, // Managed dynamically by main.js (1 per active Extractor)
        scout:       1  // 1 global scout wandering the map
    },

    BODIES: {
        harvester:   [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE],
        hauler:      [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE],
        scavenger:   [CARRY, CARRY, CARRY, MOVE, MOVE, MOVE],
        repairer:    [WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE],
        defender:    [TOUGH, TOUGH, MOVE, MOVE, MOVE, ATTACK, ATTACK, RANGED_ATTACK],
        claimer:     [CLAIM, CLAIM, MOVE, MOVE], 
        remoteMiner: [WORK, WORK, CARRY, MOVE, MOVE, MOVE],
        builder:     [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE],
        upgrader:    [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE],
        vanguard:    [TOUGH, MOVE, MOVE, RANGED_ATTACK, HEAL], // Light version
        medic:       [MOVE, HEAL, HEAL],
        breacher:    [WORK, WORK, MOVE, MOVE],
        healer:      [MOVE, MOVE, MOVE, HEAL, HEAL, HEAL],
        mineralMiner:[WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE],
        scout:       [MOVE]
    }
};
