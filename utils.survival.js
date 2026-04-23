/**
 * utils.survival.js - SCOS Universal Survival Toolkit
 * Provides centralized evasion and self-preservation logic for all creep roles.
 */
module.exports = {
    /**
     * Universal kiting logic. If a threat is nearby, the creep will flee.
     * @param {Creep} creep The creep to check.
     * @returns {boolean} True if the creep is fleeing, false otherwise.
     */
    fleeFromHostiles: function(creep) {
        const hostileCreeps = creep.room.find(FIND_HOSTILE_CREEPS, {
            filter: c => c.body.some(p => p.type === ATTACK || p.type === RANGED_ATTACK || p.type === HEAL)
        });
        const hostileCores = creep.room.find(FIND_HOSTILE_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_INVADER_CORE
        });
        const threats = [...hostileCreeps, ...hostileCores];

        if (threats.length > 0) {
            const closeThreats = threats.filter(h => creep.pos.getRangeTo(h) <= 5);
            if (closeThreats.length > 0) {
                creep.say('Kite!');
                const goals = closeThreats.map(h => ({ pos: h.pos, range: 7 }));
                const pathRes = PathFinder.search(creep.pos, goals, { flee: true, maxRooms: 2 });
                if (pathRes.path.length > 0) creep.move(creep.pos.getDirectionTo(pathRes.path[0]));
                return true; // Is fleeing
            }
        }
        return false; // Not fleeing
    }
};