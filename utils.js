/**
 * src/utils.js
 * Shared Utilities für Spawning und Pathfinding der Modular Colony Architecture (MCA)
 */
const roles = require('config.roles'); // Globale Rollen-Konfiguration laden

function bodyCost(body) { 
    return _.sum(body, part => BODYPART_COST[part] || 0); 
}

const fallbackBodies = { 
    defender: [TOUGH, MOVE, ATTACK, MOVE], 
    claimer: [CLAIM, MOVE], 
    healer: [MOVE, HEAL], 
    scout: [MOVE], 
    vanguard: [TOUGH, MOVE, RANGED_ATTACK], 
    medic: [MOVE, HEAL], 
    breacher: [WORK, MOVE] 
};

module.exports = {
    getOptimalBody: function(role, energy) {
        // 1. Prüfen, ob wir uns den perfekten Standard-Körper leisten können
        const full = roles.BODIES[role];
        if (full && bodyCost(full) <= energy) return full;
        
        let body = [], cost = 0;

        // 2. Dynamischer Aufbau für Worker-Klassen (Skaliert bis max 15 Parts)
        if (['harvester', 'remoteMiner', 'mineralMiner'].includes(role)) {
            if (energy < 200) return null; // Hard-Baseline: Verhinderung beinloser Creeps (SEV-1 Fix)
            body.push(WORK, CARRY, MOVE); cost += 200;
            while (cost + 200 <= energy && body.length < 15) { 
                body.push(WORK); cost += 100; 
                if (cost + 50 <= energy) { body.push(CARRY); cost += 50; } 
                if (cost + 50 <= energy) { body.push(MOVE); cost += 50; } 
            }
            return body;
        }
        // 3. Dynamischer Aufbau für Zivile Klassen (Skaliert bis max 18 Parts)
        if (['builder', 'upgrader', 'repairer', 'janitor'].includes(role)) {
            if (energy < 200) return null; 
            body.push(WORK, CARRY, MOVE); cost += 200;
            while (cost + 200 <= energy && body.length < 18) { 
                body.push(WORK); cost += 100; 
                if (cost + 50 <= energy) { body.push(CARRY); cost += 50; } 
                if (cost + 50 <= energy) { body.push(MOVE); cost += 50; } 
            }
            return body;
        }
        // 4. Dynamischer Aufbau für Logistik Klassen (Skaliert bis max 21 Parts)
        if (['hauler', 'scavenger', 'chemist', 'remoteHauler'].includes(role)) {
            if (energy < 100) return null;
            body.push(CARRY, MOVE); cost += 100;
            while (cost + 100 <= energy && body.length < 21) { 
                body.push(CARRY); cost += 50; 
                if (cost + 50 <= energy) { body.push(MOVE); cost += 50; } 
            }
            return body;
        }

        // 5. Fallbacks für Militär & Spezial (Kein dynamisches Skalieren im Notsystem)
        const fallback = fallbackBodies[role];
        return (fallback && bodyCost(fallback) <= energy) ? fallback : null;
    }
};