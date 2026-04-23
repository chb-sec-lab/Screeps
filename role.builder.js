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
const survival = require('utils.survival');

module.exports = {
    run: function (creep) {

        // Auto-Recycle Reset Logic: Wenn der Creep arbeitet, wird der Idle-Zähler auf 0 gesetzt
        if (creep.memory.lastIdleTick !== Game.time - 1) {
            creep.memory.idleCount = 0;
        }

        // Clear unreachable target if the timeout has expired
        if (creep.memory.unreachableTimeout && Game.time >= creep.memory.unreachableTimeout) {
            creep.memory.unreachableTargetId = null;
            creep.memory.unreachableTimeout = null;
        }
        
        // --- UNIVERSAL SURVIVAL ---
        if (survival.fleeFromHostiles(creep)) return;

        // -------------------------
        // Tunables
        // -------------------------
        const MIN_PICKUP = 20;

        const CONTAINER_EMERGENCY_HITS = 20000;
        const CONTAINER_REPAIR_THRESHOLD = 0.95;

        const RAMPART_FLOOR = 50000;

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
            creep.memory.unreachableTargetId = null; // Clear unreachable target when work lock clears
            creep.memory.unreachableTimeout = null;
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
                s.structureType === STRUCTURE_EXTENSION ||
                s.structureType === STRUCTURE_CONTAINER ||
                s.structureType === STRUCTURE_TOWER
            );
        }

        function pickBestWorkRoom() {
            const candidates = getRegistryRooms();
            let best = creep.memory.workRoom || rooms.HOME;
            let bestScore = -Infinity;

            for (const rn of candidates) {
                const r = Game.rooms[rn];
                if (!r) continue;

                const buildersAssigned = _.filter(Game.creeps, c => c.memory.role === 'builder' && c.memory.workRoom === rn).length;
                const rData = Memory.inventory && Memory.inventory.rooms ? Memory.inventory.rooms[rn] : null;
                const hasSpawn = rData ? rData.spawns > 0 : false;
                const hasStorage = rData ? rData.storage > 0 : false;

                // Dynamische Kapazitätsgrenze für den Raum (Spezialität des Raumes beachten!)
                // Bootstrap-Räume im Stein haben oft nur 1 Zugang zur Quelle -> Max 1 Builder!
                let maxBuilders = hasStorage ? 4 : (hasSpawn ? 2 : 1);
                
                // Override durch config.rooms.js, falls der Raum explizit limitiert ist!
                if (rooms.registry && rooms.registry[rn] && rooms.registry[rn].maxBuilders !== undefined) {
                    maxBuilders = rooms.registry[rn].maxBuilders;
                }

                if (buildersAssigned >= maxBuilders && rn !== creep.memory.workRoom) {
                    continue; // Raum ist bereits gesättigt für externe!
                }

                const sites = r.find(FIND_CONSTRUCTION_SITES);
                const spawnSites = sites.filter(s => s.structureType === STRUCTURE_SPAWN).length;
                const containerSites = sites.filter(s => s.structureType === STRUCTURE_CONTAINER).length;
                const towerSites = sites.filter(s => s.structureType === STRUCTURE_TOWER).length;
                const extSites = sites.filter(s => s.structureType === STRUCTURE_EXTENSION).length;

                let score = spawnSites * 10000 + extSites * 4000 + containerSites * 3000 + towerSites * 2000 + sites.length * 100;

                // Emergency container repairs / rampart floor also count
                const dyingContainer = r.find(FIND_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_CONTAINER && s.hits < CONTAINER_EMERGENCY_HITS
                }).length;
                score += dyingContainer * 6000;

                const weakRamp = r.find(FIND_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_RAMPART && s.hits < RAMPART_FLOOR
                }).length;
                score += weakRamp * 500;

                // Wenn der Raum mehr Builder hat als er verträgt, starken Malus geben, um die überschüssigen zu vertreiben!
                if (buildersAssigned > maxBuilders && rn === creep.memory.workRoom) {
                    score -= 50000;
                }

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
            let isOverbooked = false;
            if (creep.memory.workRoom) {
                let maxB = 4;
                if (rooms.registry && rooms.registry[creep.memory.workRoom] && rooms.registry[creep.memory.workRoom].maxBuilders !== undefined) {
                    maxB = rooms.registry[creep.memory.workRoom].maxBuilders;
                }
                const assigned = _.filter(Game.creeps, c => c.memory.role === 'builder' && !c.memory.recycle && c.memory.workRoom === creep.memory.workRoom).length;
                if (assigned > maxB) isOverbooked = true;
            }
            
            if (isOverbooked) {
                creep.memory.workRoom = null; // Sofortiger Rauswurf, Such-Loop starten!
            } else if (creep.memory.workRoom && creep.memory.lastRoomPickTick && (Game.time - creep.memory.lastRoomPickTick < ROOM_REEVAL_TTL)) {
                return;
            }

        // If this room has important build, stay here - BUT ONLY IF ALLOWED!
        if (roomHasImportantBuild(creep.room.name)) {
            let maxBHere = 4;
            if (rooms.registry && rooms.registry[creep.room.name] && rooms.registry[creep.room.name].maxBuilders !== undefined) {
                maxBHere = rooms.registry[creep.room.name].maxBuilders;
            }
            const assignedHere = _.filter(Game.creeps, c => c.memory.role === 'builder' && !c.memory.recycle && c.memory.workRoom === creep.room.name).length;
            
            // Verhindert das Hijacking des workRooms, wenn der Raum bereits voll ist!
            if (assignedHere < maxBHere || creep.memory.workRoom === creep.room.name) {
                creep.memory.workRoom = creep.room.name;
                creep.memory.lastRoomPickTick = Game.time;
                return;
            }
            }

            const chosen = pickBestWorkRoom();
            if (creep.memory.workRoom && chosen !== creep.memory.workRoom) {
                creep.say('Migrating');
            }
            creep.memory.workRoom = chosen;
            creep.memory.lastRoomPickTick = Game.time;
        }

        function moveToWorkRoomIfNeeded() {
            const wr = creep.memory.workRoom;
            if (!wr || creep.room.name === wr) return false;
            // Use RoomPosition to let global PathFinder respect the E57S55 blacklist
            creep.moveTo(new RoomPosition(25, 25, wr), { range: 22, visualizePathStyle: { stroke: '#ffffff' } });
            return true;
        }

        // -------------------------
        // Work room assignment
        // -------------------------
        ensureWorkRoom();
        if (moveToWorkRoomIfNeeded()) return;

        // --- BORDER BOUNCE FIX ---
        if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
            creep.moveTo(new RoomPosition(25, 25, creep.room.name));
            return;
        }

        // -------------------------
        // State toggle
        // -------------------------
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.working = false;
            clearWorkLock();
            creep.say('Need Nrg');
        }
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            clearEnergyLock();
            creep.say('Working');
        }

        // -------------------------
        // WORK MODE
        // -------------------------
        // Clear unreachable target if it has expired
        if (creep.memory.unreachableTimeout && Game.time >= creep.memory.unreachableTimeout) {
            creep.memory.unreachableTargetId = null;
            creep.memory.unreachableTimeout = null;
        }

        if (creep.memory.working) {

            // 0) ABSOLUTE EMERGENCY: Build Spawns (Colony Recovery)
            const emergencySpawnSite = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES, {
                filter: s => s.structureType === STRUCTURE_SPAWN && s.id !== creep.memory.unreachableTargetId
            });
            if (emergencySpawnSite) {
                if (creep.build(emergencySpawnSite) === ERR_NOT_IN_RANGE) creep.moveTo(emergencySpawnSite, { reusePath: 5, visualizePathStyle: { stroke: '#ffffff' } });
                return;
            }

            // 1) VITAL INFRASTRUCTURE: Extensions (Needed to spawn defenders/bigger creeps)
            // Pulled above Rampart floor so builders don't get trapped upgrading ramparts while the colony starves for capacity.
            const extSite = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES, {
                filter: s => s.structureType === STRUCTURE_EXTENSION && s.id !== creep.memory.unreachableTargetId
            });
            if (extSite) {
                if (creep.build(extSite) === ERR_NOT_IN_RANGE) creep.moveTo(extSite, { reusePath: 5, visualizePathStyle: { stroke: '#ffffff' } });
                return;
            }

            // 1) Emergency: save containers
            const dyingContainer = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_CONTAINER && s.hits < CONTAINER_EMERGENCY_HITS && s.id !== creep.memory.unreachableTargetId
            });
            if (dyingContainer) {
                if (creep.repair(dyingContainer) === ERR_NOT_IN_RANGE) creep.moveTo(dyingContainer, { reusePath: 5, visualizePathStyle: { stroke: '#ffaa00' } });
                return;
            }

            // 2) Rampart floor (only if you already built ramparts)
            const weakRamp = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_RAMPART && s.hits < RAMPART_FLOOR && s.id !== creep.memory.unreachableTargetId
            });
            if (weakRamp) {
                if (creep.repair(weakRamp) === ERR_NOT_IN_RANGE) creep.moveTo(weakRamp, { reusePath: 5, visualizePathStyle: { stroke: '#8888ff' } });
                return;
            }

            // 3) BUILD PRIORITIES (extensions -> containers -> towers -> others -> roads last)
            const sites = creep.room.find(FIND_CONSTRUCTION_SITES, {
                filter: s => s.id !== creep.memory.unreachableTargetId
            });

            const pickSite = (arr) => creep.pos.findClosestByRange(arr);

            let targetSite = null;

            const contSites = sites.filter(s => s.structureType === STRUCTURE_CONTAINER);
            if (contSites.length) targetSite = pickSite(contSites);

            // Tower third (optional)
            if (!targetSite) {
                const towerSites = sites.filter(s => s.structureType === STRUCTURE_TOWER);
                if (towerSites.length) targetSite = pickSite(towerSites);
            }

            // Everything else (but optionally keep roads last)
            if (!targetSite) {
                if (BUILD_ROADS_LAST) {
                    const nonRoad = sites.filter(s => s.structureType !== STRUCTURE_ROAD);
                    if (nonRoad.length) targetSite = pickSite(nonRoad);
                } else {
                    if (sites.length) targetSite = creep.pos.findClosestByRange(sites);
                }
            }

            // Roads last
            if (!targetSite && sites.length) {
                const roadSites = sites.filter(s => s.structureType === STRUCTURE_ROAD);
                if (roadSites.length) targetSite = pickSite(roadSites);
            }

            if (targetSite) {
                // Set work target, to optimize for consecutive actions.
                const buildResult = creep.build(targetSite);
                if (buildResult === ERR_NOT_IN_RANGE) {
                    const moveResult = creep.moveTo(targetSite, { reusePath: 5, visualizePathStyle: { stroke: '#ffffff' } });
                    if (moveResult === ERR_NO_PATH) {
                        creep.say('NoPath!');
                        creep.memory.unreachableTargetId = targetSite.id;
                        creep.memory.unreachableTimeout = Game.time + 10;
                        clearWorkLock();
                    }
                } else if (buildResult === OK) {
                    if (creep.memory.unreachableTargetId === targetSite.id) {
                        creep.memory.unreachableTargetId = null;
                        creep.memory.unreachableTimeout = null;
                    }
                }
                return;
            }

            // 3) Light maintenance: containers only
            const weakContainer = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: s => s.id !== creep.memory.unreachableTargetId &&
                    s.structureType === STRUCTURE_CONTAINER &&
                    s.hits < s.hitsMax * CONTAINER_REPAIR_THRESHOLD
            });
            if (weakContainer) {
                if (creep.repair(weakContainer) === ERR_NOT_IN_RANGE) {
                    const moveResult = creep.moveTo(weakContainer, { reusePath: 5, visualizePathStyle: { stroke: '#00ffcc' } });
                    if (moveResult === ERR_NO_PATH) {
                        creep.say('NoPath!');
                        creep.memory.unreachableTargetId = weakContainer.id;
                        creep.memory.unreachableTimeout = Game.time + 10;
                    }
                }
                return;
            }

            // 4) Upgrade fallback
            if (creep.room.controller) {
                if (creep.room.controller.my) {
                    if (creep.room.controller.id === creep.memory.unreachableTargetId) return; // Don't try to upgrade if controller is unreachable
                    creep.say('Aux:Upg');
                    if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                        const moveResult = creep.moveTo(creep.room.controller, { reusePath: 5, visualizePathStyle: { stroke: '#ffff00' } });
                        if (moveResult === ERR_NO_PATH) {
                            creep.say('NoPath!');
                            creep.memory.unreachableTargetId = creep.room.controller.id;
                            creep.memory.unreachableTimeout = Game.time + 10;
                        }
                    }
                } else {
                    creep.say('Wait:Claim');
                    if (!creep.pos.inRangeTo(creep.room.controller, 3)) {
                        creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#555555' } });
                    }
                    creep.memory.lastIdleTick = Game.time;
                    creep.memory.idleCount = (creep.memory.idleCount || 0) + 1;
                    if (creep.memory.idleCount > 500) creep.memory.recycle = true;
                }
                return;
            }

            creep.say('Idle:NoJob');
            if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                creep.moveTo(new RoomPosition(25, 25, creep.room.name), { range: 22, reusePath: 5 });
            }
            creep.memory.lastIdleTick = Game.time;
            creep.memory.idleCount = (creep.memory.idleCount || 0) + 1;
            if (creep.memory.idleCount > 25) {
                creep.memory.lastRoomPickTick = 0; // Force re-eval next tick
            }
            if (creep.memory.idleCount > 500) creep.memory.recycle = true;
            return;
        }

        // -------------------------
        // FILL MODE (local-first, expansion-safe)
        // -------------------------

        let target = null;

        // 1. Storage & Containers & Links (most reliable)
        target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
            ignoreCreeps: true, filter: s => s.id !== creep.memory.unreachableTargetId &&
                s.store &&
                s.store[RESOURCE_ENERGY] >= creep.store.getCapacity() * 0.5 && // Only withdraw from sources with decent amount
                (
                    s.structureType === STRUCTURE_STORAGE ||
                    s.structureType === STRUCTURE_CONTAINER ||
                    s.structureType === STRUCTURE_LINK
                )
        });

        // 2. Ruins (energy from destroyed structures)
        if (!target) {
            target = creep.pos.findClosestByRange(FIND_RUINS, {
                ignoreCreeps: true, filter: r => r.id !== creep.memory.unreachableTargetId && r.store && r.store[RESOURCE_ENERGY] > 0
            });
        }
        if (!target) {
             target = creep.pos.findClosestByRange(FIND_TOMBSTONES, {
                 ignoreCreeps: true, filter: t => t.id !== creep.memory.unreachableTargetId && t.store && t.store[RESOURCE_ENERGY] > 0
             });
        }

        // 3. Dropped energy (least reliable, can be spread out)
        if (!target) {
            target = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES, {
                ignoreCreeps: true,
                filter: r => r.id !== creep.memory.unreachableTargetId && r.resourceType === RESOURCE_ENERGY && r.amount >= MIN_PICKUP
            });
        }

        if (target) {
            const action = (target.amount !== undefined) ? creep.pickup(target) : creep.withdraw(target, RESOURCE_ENERGY);
            if (action === ERR_NOT_IN_RANGE) {
                const moveResult = creep.moveTo(target, { reusePath: 5, visualizePathStyle: { stroke: '#ffaa00' } });
                if (moveResult === ERR_NO_PATH) {
                    creep.say('NoPath!');
                    creep.memory.unreachableTargetId = target.id;
                    creep.memory.unreachableTimeout = Game.time + 10;
                }
            }
            return;
        }

        // 4) Harvest locally (critical for new rooms)
        const src = creep.pos.findClosestByRange(FIND_SOURCES_ACTIVE, { ignoreCreeps: true, filter: s => s.id !== creep.memory.unreachableTargetId });
        if (src) {
            if (creep.harvest(src) === ERR_NOT_IN_RANGE) creep.moveTo(src, { reusePath: 5, visualizePathStyle: { stroke: '#ffaa00' } });
            return;
        } else {
            // Falls die Quellen gerade leer sind (Regeneration), lauf schon mal hin und warte!
            const emptySrc = creep.pos.findClosestByRange(FIND_SOURCES, { ignoreCreeps: true });
            if (emptySrc && !creep.pos.inRangeTo(emptySrc, 3)) {
                creep.moveTo(emptySrc, { reusePath: 5, visualizePathStyle: { stroke: '#555555' } });
            }
        }

        creep.say('Idle:NoNrg');
        if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
            creep.moveTo(new RoomPosition(25, 25, creep.room.name), { range: 22, reusePath: 5 });
        }
        creep.memory.lastIdleTick = Game.time;
        creep.memory.idleCount = (creep.memory.idleCount || 0) + 1;
        if (creep.memory.idleCount > 25) {
            creep.memory.lastRoomPickTick = 0; // Force re-eval next tick
        }
        
        // Geduld! Builder warten auf Energie (z.B. Source-Regeneration), anstatt sich zu recyceln.
        // if (creep.memory.idleCount > 500) creep.memory.recycle = true;
    }
};
