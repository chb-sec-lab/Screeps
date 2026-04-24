/**
 * config.rooms.js - SCOS v8.0.1
 * Updated: 2026-02-18
 * Role: Strategic Command Room / Topology Registry
 */
module.exports = {
    // --- LEGACY CONSTANTS (Required by fallback logic & audits) ---
    HOME: 'W7N8',
    TARGET: 'W7N7',
    EXPANSION: 'W6N8',
    MINING: 'W8N8',

    // Global PathFinder Blacklist: Creeps will never route through these rooms
    BLACKLIST: ['W6N6', 'W6N7'], // Invader Core, Hostile bot room

    // Diplomacy Whitelist: Players who are ignored by towers and defenders
    ALLIES: [],

    // Toggle this to true to spawn the army and attack.
    WAR_MODE: false,

    // --- THE CONTROL ROOM (Topology Registry) ---
    // Zentrale Architektur für volle Automatisierung.
    // Konfiguriere hier manuelle Overrides (z.B. 'harvesters: 4'), die das Evolution Protocol (KI) überschreiben!
    registry: {
        'W7N8': { type: 'CORE' }, // Heimatbasis (Vollautomatische KI-Skalierung)
        
        'W7N7': { type: 'CORE' }, // Sekundäre Basis (2 Sources)
        
        'W8N8': { type: 'CORE', knownSources: 1, maxBuilders: 1 }, // Westliche Basis (eng)
        
        // Outposts / Remote Mines
        'W6N8': { type: 'REMOTE', base: 'W7N8', knownSources: 1 }, 
        'W8N7': { type: 'REMOTE', base: 'W7N8', knownSources: 1 }, 
        'W9N6': { type: 'REMOTE', base: 'W7N8', knownSources: 2 } 
    }
};
