/**
 * config.rooms.js - SCOS v6.0.2
 * Updated: 2026-02-13 CET (Amsterdam)
 * Role: Strategic Command Room
 */
module.exports = {
    // Global PathFinder Blacklist: Creeps will never route through these rooms
    BLACKLIST: ['W6N6', 'W6N7'], // Invader Core, Hostile bot room

    // Diplomacy Whitelist: Players who are ignored by towers and defenders
    ALLIES: [],

    // Toggle this to true to spawn the army and attack.
    WAR_MODE: false,

    // --- THE CONTROL ROOM (Topology Registry) ---
    // Die zentrale Architektur für volle Automatisierung.
    // Künftige Kernels lesen dieses Objekt aus, um Basen (CORE) und Außenposten (REMOTE) zu steuern.
    registry: {
        'W7N8': { type: 'CORE' }, // Heimatbasis (Wird nun vollautomatisch durch JIT & Fact-Based Scaling skaliert)
        'W7N7': { type: 'CORE' }, // Your primary expansion target
        // Example of a strategic override: 'maxBuilders' limits the number of builders the OS will send,
        // even if JIT logic requests more. Useful for narrow canyons or tight layouts.
        'W6N8': { type: 'REMOTE', base: 'W7N8', knownSources: 1 }, // Eastern remote mine (1 source)
        'W8N8': { type: 'CORE', knownSources: 1, maxBuilders: 1 }, // Western base (1 source, narrow)
        'W8N7': { type: 'REMOTE', base: 'W7N8', knownSources: 1 }, // Western remote mine (1 source)
        'W9N6': { type: 'REMOTE', base: 'W7N8', knownSources: 2 }  // New southern remote mine (2 sources)
    }
};
