/**
 * config.rooms.js - SCOS v6.0.0
 * Updated: 2026-02-11 20:34 CET (Amsterdam)
 * Role: Strategic Command Room
 */
module.exports = {
    HOME: 'E58S56',
    TARGET: 'E57S56',

    // Toggle this to true to spawn the army and attack.
    // Toggle to false to recall units and stop military spending.
    WAR_MODE: true, 

    registry: {
        'E58S56': { role: 'HOME' },
        'E57S56': { role: 'TARGET' }
    }
};