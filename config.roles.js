/**
 * config.roles.js - SCOS v6.0.0
 * Updated: 2026-02-11 20:34 CET (Amsterdam)
 * Role: Identity & Population Standards
 */
module.exports = {
    generateName: function(role) {
        const alias = {
            harvester: 'Worker', hauler: 'Supply', builder: 'Engineer',
            vanguard: 'Vanguard', medic: 'Medic', breacher: 'Breacher',
            remoteMiner: 'Outpost', claimer: 'Envoy', upgrader: 'Sage'
        };
        const id = Math.random().toString(16).slice(2, 6).toUpperCase();
        return `${alias[role] || 'Unit'}-${id}`;
    },

    // Raw Max Counts (Main.js will filter these based on WAR_MODE)
    COUNTS: {
        harvester:   5,
        hauler:      2,
        vanguard:    4, 
        medic:       2,
        breacher:    0,
        remoteMiner: 5,
        builder:     2,
        claimer:     1,
        upgrader:    1
    },

    BODIES: {
        harvester:   [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE],
        hauler:      [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE],
        vanguard:    [TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL],
        medic:       [MOVE, MOVE, MOVE, MOVE, MOVE, HEAL, HEAL, HEAL, HEAL, HEAL],
        breacher:    [TOUGH, TOUGH, WORK, WORK, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE],
        remoteMiner: [WORK, WORK, CARRY, MOVE, MOVE, MOVE],
        builder:     [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE],
        claimer:     [CLAIM, CLAIM, MOVE, MOVE],
        upgrader:    [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE],
    }
};