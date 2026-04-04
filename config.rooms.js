/**
 * config.rooms.js - SCOS v6.0.2
 * Updated: 2026-02-13 CET (Amsterdam)
 * Role: Strategic Command Room
 */
module.exports = {
    HOME: 'E58S56',
    TARGET: 'E57S56',

    // EXPANSION redirected to MINING room to avoid E57S55 Invader Core trap
    EXPANSION: 'E58S55',
    MINING: 'E58S55',

    // Global PathFinder Blacklist: Creeps will never route through these rooms
    BLACKLIST: ['E57S55'],

    // Toggle this to true to spawn the army and attack.
    WAR_MODE: false,

    registry: {
        'E58S56': { role: 'HOME' },
        'E57S56': { role: 'TARGET' },
        // 'E57S55': { role: 'EXPANSION' }, // Abandoned due to heavy Invader Core activity
        'E58S55': { role: 'MINING' }
    }
};
