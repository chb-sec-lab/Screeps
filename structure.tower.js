/**
 * structure.tower.js - SCOS v6.2.5
 * Updated: 2026-02-13 11:15 CET (Europe/Amsterdam)
 *
 * Priorities:
 *  1) Attack hostiles
 *  2) Heal friendly creeps
 *  3) Emergency: save containers (low hits)
 *  4) Rampart floor upkeep (allowed even at medium energy)
 *  5) Normal repairs only when tower is high energy
 */
module.exports = {
    run: function (tower) {
        
        // --- DIPLOMACY WHITELIST ---
        const ALLIES = [];

        // 1) DEFENSE
        const hostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
            filter: c => !ALLIES.includes(c.owner.username)
        });
        if (hostile) {
            tower.attack(hostile);
            return;
        }

        // 2) HEAL
        const injured = tower.pos.findClosestByRange(FIND_MY_CREEPS, {
            filter: c => c.hits < c.hitsMax
        });
        if (injured) {
            tower.heal(injured);
            return;
        }

        // --- Tunables ---
        const CONTAINER_EMERGENCY_HITS = 20000;

        // Rampart floor: elevated to 50k to provide substantial buffer against invaders
        const RAMPART_FLOOR = 50000;
        const WALL_RAMPART_MAX = 250000; // Cap for general maintenance so it doesn't drain everything

        // Energy gates
        const MIN_ENERGY_FOR_EMERGENCY = 100;   // allow emergency even when low
        const MIN_ENERGY_FOR_RAMPARTS = 200;    // allow rampart upkeep at medium energy
        const ENERGY_FOR_NORMAL_REPAIR = 0.50;  // lowered to 50% so it helps out more often

        // 3) EMERGENCY container saving (prevents losing infrastructure)
        if (tower.store[RESOURCE_ENERGY] >= MIN_ENERGY_FOR_EMERGENCY) {
            const dyingContainer = tower.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_CONTAINER && s.hits < CONTAINER_EMERGENCY_HITS
            });
            if (dyingContainer) {
                tower.repair(dyingContainer);
                return;
            }
        }

        // 4) Rampart floor upkeep (this is what stops “decay within minutes”)
        if (tower.store[RESOURCE_ENERGY] >= MIN_ENERGY_FOR_RAMPARTS) {
            const weakRampart = tower.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_RAMPART && s.hits < RAMPART_FLOOR
            });
            if (weakRampart) {
                tower.repair(weakRampart);
                return;
            }
        }

        // 5) Normal repairs only when tower is high energy
        const cap = tower.store.getCapacity(RESOURCE_ENERGY);
        if (tower.store[RESOURCE_ENERGY] < cap * ENERGY_FOR_NORMAL_REPAIR) return;

        const damaged = tower.pos.findClosestByRange(FIND_STRUCTURES, {
            filter: s => {
                if (s.hits >= s.hitsMax) return false;
                if (s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART) {
                    return s.hits < WALL_RAMPART_MAX;
                }
                return true;
            }
        });

        if (damaged) {
            tower.repair(damaged);
        }
    }
};
