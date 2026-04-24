/**
 * core.defense.js - SCOS Defense Manager
 * Isoliertes Modul zur Bewertung von Bedrohungen und Skalierung der Verteidigung.
 */
const rooms = require('config.rooms');

module.exports = {
    run: function(activeRegistry) {
        if (!Memory.defense) Memory.defense = {};
        const ALLIES = rooms.ALLIES || [];

        function getHostileCount(room) {
            if (!room) return 0;
            const creeps = room.find(FIND_HOSTILE_CREEPS, {
                filter: c => !ALLIES.includes(c.owner.username) && (c.getActiveBodyparts(ATTACK) > 0 || c.getActiveBodyparts(RANGED_ATTACK) > 0 || c.getActiveBodyparts(HEAL) > 0)
            }).length;
            const cores = room.find(FIND_HOSTILE_STRUCTURES, { filter: s => s.structureType === STRUCTURE_INVADER_CORE }).length;
            return creeps + cores;
        }

        const roomThreats = {};
        let hasLiveThreat = false;
        let urgentRoom = rooms.HOME;
        let urgentThreat = 0;

        Object.keys(activeRegistry).forEach(roomName => {
            const threat = getHostileCount(Game.rooms[roomName]);
            roomThreats[roomName] = threat;
            if (threat > 0) hasLiveThreat = true;
            if (threat > urgentThreat) { urgentThreat = threat; urgentRoom = roomName; }
        });

        if (hasLiveThreat) {
            Memory.defense.activeUntil = Game.time + 200; // DEFENSE_COOLDOWN_TICKS
            Memory.defense.targetRoom = urgentRoom;
            Memory.defense.need = Math.min(3, Math.max(1, urgentThreat));
            Memory.defense.healerNeed = urgentThreat >= 2 ? 1 : 0;
        }
        return roomThreats;
    }
};