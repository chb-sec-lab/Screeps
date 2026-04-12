/**
 * utils.expansion.js - SCOS Auto-Expander
 * Evaluates Memory.inventory to find the best next colony and sets it as TARGET.
 */
const logger = require('utils.logger');
const rooms = require('config.rooms');

module.exports = {
    run: function() {
        // Evaluieren nur alle 1000 Ticks, um CPU zu sparen
        if (Game.time % 1000 !== 0) return;

        if (!Memory.empire) Memory.empire = {};
        if (!Memory.empire.wishlist) Memory.empire.wishlist = [];
        const inv = Memory.inventory;
        if (!inv || !inv.rooms) return;

        const ownedRooms = Object.keys(inv.rooms).filter(rn => inv.rooms[rn].my);
        
        // Wenn wir GCL-Cap erreicht haben, können wir nicht expandieren
        if (ownedRooms.length >= Game.gcl.level) return;

        // Aktuelles Target überprüfen
        let currentTarget = Memory.empire.targetRoom || rooms.TARGET;
        if (currentTarget) {
            const targetData = inv.rooms[currentTarget];
            if (targetData && !targetData.my) {
                return; // Wir arbeiten noch an diesem Target, nicht abbrechen!
            }
        }

        // Wir haben freies GCL und kein aktives (ungeclaimtes) Target! Suche neues Ziel.
        let bestRoom = null;
        let bestScore = -Infinity;

        const WISHLIST_BONUS = 10000;
        const myMinerals = ownedRooms.map(rn => inv.rooms[rn].mineralType).filter(m => m);

        for (const roomName in inv.rooms) {
            const r = inv.rooms[roomName];

            if (r.my) continue; // Gehört uns schon
            if (r.owner || r.reservation) continue; // Gehört jemand anderem
            if (r.hostileTowers > 0 || (r.dangerUntil && Game.time < r.dangerUntil)) continue; // Zu gefährlich
            if (rooms.BLACKLIST && rooms.BLACKLIST.includes(roomName)) continue; // Blacklist
            if (r.sources === 0) continue; // Ohne Energie nutzlos

            let score = 0;
            score += r.sources * 5000; // 2 Quellen sind der Jackpot
            
            if (r.mineralType && !myMinerals.includes(r.mineralType)) {
                score += 2000; // Bonus für neue Mineralien
            }

            const dist = Game.map.getRoomLinearDistance(rooms.HOME, roomName);
            if (dist > 4) continue; // Zu weit weg
            score -= dist * 500; // Bestrafung für lange Laufwege

            // Gib Räumen auf der Wunschliste einen massiven Bonus
            if (Memory.empire.wishlist.includes(roomName)) {
                score += WISHLIST_BONUS;
            }

            if (score > bestScore) { bestScore = score; bestRoom = roomName; }
        }

        if (bestRoom && bestRoom !== currentTarget) {
            Memory.empire.targetRoom = bestRoom;
            logger.log(`🚀 AUTO-EXPAND: Selected new target colony ${bestRoom} (Score: ${bestScore})`, 'success');
        }
    }
};