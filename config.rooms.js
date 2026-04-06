/**
 * config.rooms.js - SCOS v6.0.2
 * Updated: 2026-02-13 CET (Amsterdam)
 * Role: Strategic Command Room
 */
module.exports = {
    HOME: 'W7N8',
    TARGET: 'W7N7', // 2 Sources (Planned secondary base)
    EXPANSION: 'W6N8', // 1 Source (Right)
    MINING: 'W8N8', // 1 Source (Left)

    // Global PathFinder Blacklist: Creeps will never route through these rooms
    BLACKLIST: ['W6N6'], // Invader Core

    // Toggle this to true to spawn the army and attack.
    WAR_MODE: false,

    registry: {
        'W7N8': { role: 'HOME' }
    }
};
