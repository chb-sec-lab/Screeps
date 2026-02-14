/**
 * config.roles.js - SCOS v6.2.1
 * Updated: 2026-02-12 17:45 CET
 * Status: NO_WAR_MODE (Expansion Priority)
 */
module.exports = {
    generateName: function(role) {
        return `${role}_${Math.random().toString(16).slice(2, 6).toUpperCase()}`;
    },

    COUNTS: {
        harvester:   6,
        hauler:      2,
        scavenger:   2,
        repairer:    0,
        defender:    0,
        claimer:     0,
        remoteMiner: 8, // Global fallback count (room-specific quotas are handled in main.js)
        builder:     1,
        upgrader:    3,
        vanguard:    0, // NO WAR MODE
        medic:       0, // NO WAR MODE
        breacher:    0
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
        breacher:    [WORK, WORK, MOVE, MOVE]
    }
};
