/**
 * config.rooms.js - SCOS v6.0.2
 * Updated: 2026-02-13 CET (Amsterdam)
 * Role: Strategic Command Room
 */
module.exports = {
    // Global PathFinder Blacklist: Creeps will never route through these rooms
    BLACKLIST: ['W6N6'], // Invader Core

    // Diplomacy Whitelist: Players who are ignored by towers and defenders
    ALLIES: [],

    // Toggle this to true to spawn the army and attack.
    WAR_MODE: false,

    // --- THE CONTROL ROOM (Topology Registry) ---
    // Die zentrale Architektur für volle Automatisierung.
    // Künftige Kernels lesen dieses Objekt aus, um Basen (CORE) und Außenposten (REMOTE) zu steuern.
    registry: {
        'W7N8': { type: 'CORE' }, // Heimatbasis (Wird nun vollautomatisch durch JIT & Fact-Based Scaling skaliert)
        'W6N8': { type: 'REMOTE', base: 'W7N8', knownSources: 1 }, // New Colony Target
        'W8N8': { type: 'CORE' }, // Was EXPANSION, now a full CORE base
        'W7N7': { type: 'CORE' }, // Was MINING, now a full CORE base
        'W6N7': { type: 'REMOTE', base: 'W7N8' }, // Neue Mine
        'W8N7': { type: 'REMOTE', base: 'W7N8' }  // Border/Connection Room (Reserve & Mine)
    }
};
