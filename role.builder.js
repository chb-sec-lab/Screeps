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

        // Auto-Recycle Reset Logic: Wenn der Creep arbeitet, wird der Idle-Zähler auf 0 gesetzt
        if (creep.memory.lastIdleTick !== Game.time - 1) {
            creep.memory.idleCount = 0;
        }
        
        // --- ACTIVE EVASION (KITING) ---
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
                const pathRes = PathFinder.search(creep.pos, goals, { flee: true, maxRooms: 2 }); // Flucht in Nachbarräume erlaubt!
                if (pathRes.path.length > 0) {
                    creep.move(creep.pos.getDirectionTo(pathRes.path[0]));
                }
                return; // Arbeit strikt blockieren, solange Gefahr droht!
            }
        }

        // -------------------------
        // Tunables
        // -------------------------
        const LOW_ENERGY_REFILL = 0;
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
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] <= LOW_ENERGY_REFILL) {
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
        if (creep.memory.working) {

            // 0) ABSOLUTE EMERGENCY: Build Spawns (Colony Recovery)
            const emergencySpawnSite = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES, {
                filter: s => s.structureType === STRUCTURE_SPAWN
            });
            if (emergencySpawnSite) {
                if (creep.build(emergencySpawnSite) === ERR_NOT_IN_RANGE) creep.moveTo(emergencySpawnSite, { visualizePathStyle: { stroke: '#ffffff' } });
                return;
            }

            // 1) VITAL INFRASTRUCTURE: Extensions (Needed to spawn defenders/bigger creeps)
            // Pulled above Rampart floor so builders don't get trapped upgrading ramparts while the colony starves for capacity.
            const extSite = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES, {
                filter: s => s.structureType === STRUCTURE_EXTENSION
            });
            if (extSite) {
                if (creep.build(extSite) === ERR_NOT_IN_RANGE) creep.moveTo(extSite, { visualizePathStyle: { stroke: '#ffffff' } });
                return;
            }

            // 1) Emergency: save containers
            const dyingContainer = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_CONTAINER && s.hits < CONTAINER_EMERGENCY_HITS
            });
            if (dyingContainer) {
                if (creep.repair(dyingContainer) === ERR_NOT_IN_RANGE) creep.moveTo(dyingContainer);
                return;
            }

            // 2) Rampart floor (only if you already built ramparts)
            const weakRamp = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_RAMPART && s.hits < RAMPART_FLOOR
            });
            if (weakRamp) {
                if (creep.repair(weakRamp) === ERR_NOT_IN_RANGE) creep.moveTo(weakRamp);
                return;
            }

            // 3) BUILD PRIORITIES (extensions -> containers -> towers -> others -> roads last)
            const sites = creep.room.find(FIND_CONSTRUCTION_SITES);

            const pickSite = (arr) => creep.pos.findClosestByRange(arr);

            let targetSite = null;

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
                    targetSite = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
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
            const weakContainer = creep.pos.findClosestByRange(FIND_STRUCTURES, {
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
                if (creep.room.controller.my) {
                    creep.say('Aux:Upg');
                    if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#ffff00' } });
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
                creep.moveTo(new RoomPosition(25, 25, creep.room.name), { range: 22 });
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

        let target = creep.pos.findClosestByRange(FIND_RUINS, {
            ignoreCreeps: true, filter: r => r.store && r.store[RESOURCE_ENERGY] > 0
        });
        if (!target) {
            target = creep.pos.findClosestByRange(FIND_TOMBSTONES, {
                ignoreCreeps: true, filter: t => t.store && t.store[RESOURCE_ENERGY] > 0
            });
        }

        // 1) Dropped energy
        if (!target) {
            target = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES, {
                ignoreCreeps: true,
                filter: r => r.resourceType === RESOURCE_ENERGY && r.amount >= MIN_PICKUP
            });
        }

        // 2) Best local structure source (storage/container/link) in CURRENT room
        if (!target) {
            target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                ignoreCreeps: true,
                filter: s =>
                    s.store &&
                    s.store[RESOURCE_ENERGY] >= 50 &&
                    (
                        s.structureType === STRUCTURE_STORAGE ||
                        s.structureType === STRUCTURE_CONTAINER ||
                        s.structureType === STRUCTURE_LINK
                    )
            });
        }

        if (target) {
            const action = (target.amount !== undefined) ? creep.pickup(target) : creep.withdraw(target, RESOURCE_ENERGY);
            if (action === ERR_NOT_IN_RANGE) creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
            return;
        }

        // 3) Harvest locally (critical for new rooms)
        const src = creep.pos.findClosestByRange(FIND_SOURCES_ACTIVE, { ignoreCreeps: true });
        if (src) {
            if (creep.harvest(src) === ERR_NOT_IN_RANGE) creep.moveTo(src, { visualizePathStyle: { stroke: '#ffaa00' } });
            return;
        } else {
            // Falls die Quellen gerade leer sind (Regeneration), lauf schon mal hin und warte!
            const emptySrc = creep.pos.findClosestByRange(FIND_SOURCES, { ignoreCreeps: true });
            if (emptySrc && !creep.pos.inRangeTo(emptySrc, 3)) {
                creep.moveTo(emptySrc, { visualizePathStyle: { stroke: '#555555' } });
            }
        }

        creep.say('Idle:NoNrg');
        if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
            creep.moveTo(new RoomPosition(25, 25, creep.room.name), { range: 22 });
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
