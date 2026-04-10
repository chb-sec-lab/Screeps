/**
 * config.rooms.js - SCOS v6.0.2
 * Updated: 2026-02-13 CET (Amsterdam)
 * Role: Strategic Command Room
 */
module.exports = {
    HOME: 'W7N8',
    TARGET: 'W8N8', // 2 Sources (Planned secondary base)
    EXPANSION: 'W6N8', // 1 Source (Right)
    MINING: 'W7N7', // 1 Source (Left)

    // Global PathFinder Blacklist: Creeps will never route through these rooms
    BLACKLIST: ['W6N6'], // Invader Core

    // Toggle this to true to spawn the army and attack.
    WAR_MODE: false,

    // --- THE CONTROL ROOM (Topology Registry) ---
    // Die zentrale Architektur für volle Automatisierung.
    // Künftige Kernels lesen dieses Objekt aus, um Basen (CORE) und Außenposten (REMOTE) zu steuern.
    registry: {
        'W7N8': { type: 'CORE' },                         // Heimatbasis
        'W8N8': { type: 'CORE' },                         // Zukünftige Zweitbasis (momentan TARGET)
        'W6N8': { type: 'REMOTE', base: 'W7N8' },         // Expansion (Mine)
        'W7N7': { type: 'REMOTE', base: 'W7N8' }          // Mining (Mine)
    }
};
