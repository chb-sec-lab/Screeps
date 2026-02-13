/**
 * role.builder.js - SCOS v6.3.1
 * Updated: 2026-02-13 CET (Europe/Amsterdam)
 *
 * Key change:
 *  - Build priority by structure type:
 *      1) Spawn
 *      2) Containers
 *      3) (Optional) Towers
 *      4) Everything else (roads last)
 *
 * Also:
 *  - Chooses reachable targets via closest-by-path
 *  - Multi-room via config.rooms registry (workRoom auto-pick or pinned via memory)
 *  - Local harvest fallback (important for new rooms)
 */
const rooms = require('config.rooms');

module.exports = {
    run: function (creep) {

        // -------------------------
        // Tunables
        // -------------------------
        const LOW_ENERGY_REFILL = 0;
        const MIN_PICKUP = 20;

        const CONTAINER_EMERGENCY_HITS = 20000;
        const CONTAINER_REPAIR_THRESHOLD = 0.95;

        const RAMPART_FLOOR = 10000;

        // Roads are expensive to maintain. Build them LAST.
        const BUILD_ROADS_LAST = true;

        const ROOM_REEVAL_TTL = 25;

        // -------------------------
        // Helpers
        // -------------------------
        function getObj(id) {
            return id ? Game.getObjectById(id) : null;
        }
        function clearEnergyLock() {
            creep.memory.energyTargetId = null;
            creep.memory.energyTargetType = null;
        }
        function clearWorkLock() {
            creep.memory.workTargetId = null;
            creep.memory.workTask = null;
        }
        function getRegistryRooms() {
            return rooms.registry ? Object.keys(rooms.registry) : [rooms.HOME];
        }

        function roomHasImportantBuild(roomName) {
            const r = Game.rooms[roomName];
            if (!r) return false;
            const sites = r.find(FIND_CONSTRUCTION_SITES);
            return sites.some(s =>
                s.structureType === STRUCTURE_SPAWN ||
                s.structureType === STRUCTURE_CONTAINER ||
                s.structureType === STRUCTURE_TOWER
            );
        }

        function pickBestWorkRoom() {
            const candidates = getRegistryRooms();
            let best = rooms.HOME;
            let bestScore = -1;

            for (const rn of candidates) {
                const r = Game.rooms[rn];
                if (!r) continue;

                const sites = r.find(FIND_CONSTRUCTION_SITES);
                const spawnSites = sites.filter(s => s.structureType === STRUCTURE_SPAWN).length;
                const containerSites = sites.filter(s => s.structureType === STRUCTURE_CONTAINER).length;
                const towerSites = sites.filter(s => s.structureType === STRUCTURE_TOWER).length;

                // Strongly prefer rooms where important infra is pending
                let score = spawnSites * 10000 + containerSites * 3000 + towerSites * 2000;

                // Emergency container repairs / rampart floor also count
                const dyingContainer = r.find(FIND_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_CONTAINER && s.hits < CONTAINER_EMERGENCY_HITS
                }).length;
                score += dyingContainer * 6000;

                const weakRamp = r.find(FIND_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_RAMPART && s.hits < RAMPART_FLOOR
                }).length;
                score += weakRamp * 500;

                // mild preference for staying put
                if (creep.room.name === rn) score += 50;

                if (score > bestScore) {
                    bestScore = score;
                    best = rn;
                }
            }

            return best;
        }

        function ensureWorkRoom() {
            if (creep.memory.workRoom) return;
            if (creep.memory.lastRoomPickTick && (Game.time - creep.memory.lastRoomPickTick < ROOM_REEVAL_TTL)) return;

            // If this room has important build, stay here
            if (roomHasImportantBuild(creep.room.name)) {
                creep.memory.workRoom = creep.room.name;
                creep.memory.lastRoomPickTick = Game.time;
                return;
            }

            const chosen = pickBestWorkRoom();
            creep.memory.workRoom = chosen;
            creep.memory.lastRoomPickTick = Game.time;
        }

        function moveToWorkRoomIfNeeded() {
            const wr = creep.memory.workRoom;
            if (!wr || creep.room.name === wr) return false;
            const exit = creep.pos.findClosestByRange(creep.room.findExitTo(wr));
            creep.moveTo(exit, { visualizePathStyle: { stroke: '#ffffff' } });
            return true;
        }

        // -------------------------
        // Work room assignment
        // -------------------------
        ensureWorkRoom();
        if (moveToWorkRoomIfNeeded()) return;

        // -------------------------
        // State toggle
        // -------------------------
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] <= LOW_ENERGY_REFILL) {
            creep.memory.working = false;
            clearWorkLock();
            creep.say('🔄 Fill');
        }
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            clearEnergyLock();
            creep.say('🛠️ Work');
        }

        // -------------------------
        // WORK MODE
        // -------------------------
        if (creep.memory.working) {

            // 0) Emergency: save containers
            const dyingContainer = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_CONTAINER && s.hits < CONTAINER_EMERGENCY_HITS
            });
            if (dyingContainer) {
                if (creep.repair(dyingContainer) === ERR_NOT_IN_RANGE) creep.moveTo(dyingContainer);
                return;
            }

            // 1) Rampart floor (only if you already built ramparts)
            const weakRamp = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_RAMPART && s.hits < RAMPART_FLOOR
            });
            if (weakRamp) {
                if (creep.repair(weakRamp) === ERR_NOT_IN_RANGE) creep.moveTo(weakRamp);
                return;
            }

            // 2) BUILD PRIORITIES (spawn -> containers -> towers -> others -> roads last)
            const sites = creep.room.find(FIND_CONSTRUCTION_SITES);

            const pickSite = (arr) => creep.pos.findClosestByPath(arr);

            let targetSite = null;

            // Spawn first
            const spawnSites = sites.filter(s => s.structureType === STRUCTURE_SPAWN);
            targetSite = pickSite(spawnSites);

            // Containers second
            if (!targetSite) {
                const contSites = sites.filter(s => s.structureType === STRUCTURE_CONTAINER);
                targetSite = pickSite(contSites);
            }

            // Tower third (optional)
            if (!targetSite) {
                const towerSites = sites.filter(s => s.structureType === STRUCTURE_TOWER);
                targetSite = pickSite(towerSites);
            }

            // Everything else (but optionally keep roads last)
            if (!targetSite) {
                if (BUILD_ROADS_LAST) {
                    const nonRoad = sites.filter(s => s.structureType !== STRUCTURE_ROAD);
                    targetSite = pickSite(nonRoad);
                } else {
                    targetSite = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
                }
            }

            // Roads last
            if (!targetSite && sites.length) {
                const roadSites = sites.filter(s => s.structureType === STRUCTURE_ROAD);
                targetSite = pickSite(roadSites);
            }

            if (targetSite) {
                const res = creep.build(targetSite);
                if (res === ERR_NOT_IN_RANGE) {
                    creep.moveTo(targetSite, { visualizePathStyle: { stroke: '#ffffff' } });
                } else if (res === ERR_NO_PATH) {
                    // If unreachable, just try another next tick
                }
                return;
            }

            // 3) Light maintenance: containers only
            const weakContainer = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s =>
                    s.structureType === STRUCTURE_CONTAINER &&
                    s.hits < s.hitsMax * CONTAINER_REPAIR_THRESHOLD
            });
            if (weakContainer) {
                if (creep.repair(weakContainer) === ERR_NOT_IN_RANGE) creep.moveTo(weakContainer);
                return;
            }

            // 4) Upgrade fallback
            if (creep.room.controller) {
                if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) creep.moveTo(creep.room.controller);
                return;
            }

            creep.say('💤');
            return;
        }

        // -------------------------
        // FILL MODE (local-first, expansion-safe)
        // -------------------------

        // 1) Dropped energy
        const drop = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
            filter: r => r.resourceType === RESOURCE_ENERGY && r.amount >= MIN_PICKUP
        });
        if (drop) {
            if (creep.pickup(drop) === ERR_NOT_IN_RANGE) creep.moveTo(drop);
            return;
        }

        // 2) Best local structure source (storage/container/link) in CURRENT room
        const structureEnergy = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: s =>
                s.store &&
                s.store[RESOURCE_ENERGY] > 0 &&
                (
                    s.structureType === STRUCTURE_STORAGE ||
                    s.structureType === STRUCTURE_CONTAINER ||
                    s.structureType === STRUCTURE_LINK
                )
        });
        if (structureEnergy) {
            if (creep.withdraw(structureEnergy, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(structureEnergy);
            return;
        }

        // 3) Harvest locally (critical for new rooms)
        const src = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
        if (src) {
            if (creep.harvest(src) === ERR_NOT_IN_RANGE) creep.moveTo(src);
            return;
        }

        creep.say('🚫E');
    }
};
