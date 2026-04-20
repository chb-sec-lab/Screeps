/**
 * utils.planner.js - SCOS Automated Construction
 * Safely plans roads and basic infrastructure without blowing up the CPU.
 */
const roomsConfig = require('config.rooms');

module.exports = {
    run: function(room) {
        // Abort if global construction site limit is near (max 100)
        if (Object.keys(Game.constructionSites).length > 80) return;

        // Nur CORE-Basen bekommen Spawns, Extensions etc. Remote-Minen werden verschont!
        const isRemote = roomsConfig.registry && roomsConfig.registry[room.name] && roomsConfig.registry[room.name].type === 'REMOTE';
        if (!isRemote) this.planCore(room);

        this.planRoads(room);
        this.planExtractors(room);
        this.planContainers(room);
        this.planRamparts(room);
        this.planLinks(room);
        this.planLabs(room);
    },

    paveRoute: function(startPos, endTarget) {
        const path = PathFinder.search(startPos, { pos: endTarget.pos, range: 1 }, {
            plainCost: 2,
            swampCost: 2, // Treat swamps like plains so we naturally pave them
            maxOps: 8000, // WICHTIG: Erlaubt Wegfindung über Raumgrenzen hinweg
            roomCallback: function(roomName) {
                let targetRoom = Game.rooms[roomName];
                if (!targetRoom) return false;
                let costs = new PathFinder.CostMatrix;
                
                targetRoom.find(FIND_STRUCTURES).forEach(function(struct) {
                    if (struct.structureType === STRUCTURE_ROAD) {
                        costs.set(struct.pos.x, struct.pos.y, 1); // Prefer existing roads to avoid parallel paths
                    } else if (struct.structureType !== STRUCTURE_CONTAINER &&
                               (struct.structureType !== STRUCTURE_RAMPART || !struct.my)) {
                        costs.set(struct.pos.x, struct.pos.y, 255); // Block solid buildings
                    }
                });
                
                targetRoom.find(FIND_CONSTRUCTION_SITES).forEach(function(site) {
                    if (site.structureType === STRUCTURE_ROAD) {
                        costs.set(site.pos.x, site.pos.y, 1); // Vorhandene Baustellen bevorzugen! (Vermeidet parallele Straßen)
                    }
                });
                return costs;
            }
        }).path;

        // Place a road construction site on each step of the path
        path.forEach(pos => {
            if (Game.rooms[pos.roomName]) { // Nur wenn wir Sicht in dem Raum haben
                pos.createConstructionSite(STRUCTURE_ROAD);
            }
        });
    },

    planRemoteHighways: function(room, anchor) {
        if (!roomsConfig.registry) return;

        // Get all remote rooms for this base
        const remoteRoomNames = Object.keys(roomsConfig.registry).filter(rn =>
            roomsConfig.registry[rn].type === 'REMOTE' && roomsConfig.registry[rn].base === room.name
        );
        if (remoteRoomNames.length === 0) return;

        // Use memory to stagger the planning
        if (!room.memory.planner) room.memory.planner = {};
        if (room.memory.planner.nextRemoteIndex === undefined || room.memory.planner.nextRemoteIndex >= remoteRoomNames.length) {
            room.memory.planner.nextRemoteIndex = 0;
        }

        const remoteRoomName = remoteRoomNames[room.memory.planner.nextRemoteIndex];
        const remoteRoom = Game.rooms[remoteRoomName];

        // If we have vision, plan roads to its sources
        if (remoteRoom) {
            const remoteSources = remoteRoom.find(FIND_SOURCES);
            if (remoteSources.length > 0) {
                // To be even safer, let's just plan to ONE source per run.
                if (room.memory.planner.nextRemoteSourceIndex === undefined || room.memory.planner.nextRemoteSourceIndex >= remoteSources.length) {
                    room.memory.planner.nextRemoteSourceIndex = 0;
                }

                const sourceToPlan = remoteSources[room.memory.planner.nextRemoteSourceIndex];
                console.log(`[Planner] Planning highway from ${room.name} to source ${sourceToPlan.id} in ${remoteRoomName}.`);
                this.paveRoute(anchor, sourceToPlan);

                // Increment source index for next run
                room.memory.planner.nextRemoteSourceIndex++;
                if (room.memory.planner.nextRemoteSourceIndex >= remoteSources.length) {
                    // We've planned all sources in this room, move to the next room for the next planner run.
                    room.memory.planner.nextRemoteSourceIndex = 0;
                    room.memory.planner.nextRemoteIndex++;
                }
                return; // Only do one path per run.
            }
        }

        // If we don't have vision, or the room has no sources, just move to the next remote room for the next run.
        room.memory.planner.nextRemoteIndex++;
    },

    planRoads: function(room) {
        const spawns = room.find(FIND_MY_SPAWNS);
        if (spawns.length === 0) return;
        const anchor = spawns[0].pos;

        // 1. Wege vom Spawn zu allen Ressourcen und zum Controller
        const localTargets = [...room.find(FIND_SOURCES), ...room.find(FIND_MINERALS)];
        if (room.controller) localTargets.push(room.controller);
        localTargets.forEach(target => this.paveRoute(anchor, target));

        // 2. Extra-Highways: Vom Storage direkt zum Controller und zum Mineral
        if (room.storage) {
            if (room.controller) this.paveRoute(room.storage.pos, room.controller);
            
            const minerals = room.find(FIND_MINERALS);
            if (minerals.length > 0) this.paveRoute(room.storage.pos, minerals[0]);
        }

        // 3. REMOTE HIGHWAYS (STAGGERED & SLOW)
        this.planRemoteHighways(room, anchor);
    },

    planRamparts: function(room) {
        // Ramparts kosten viel Energie im Unterhalt. Wir bauen sie erst ab RCL 4 (wenn Storage & Wirtschaft stabil sind).
        if (!room.controller || !room.controller.my || room.controller.level < 4) return;

        // SCOS Smart-Bunker: Wir schützen NUR das Herzstück der Basis vor Sniper-Angriffen!
        const criticalStructures = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_SPAWN ||
                         s.structureType === STRUCTURE_TOWER ||
                         s.structureType === STRUCTURE_STORAGE ||
                         s.structureType === STRUCTURE_TERMINAL
        });

        criticalStructures.forEach(struct => {
            const hasRampart = struct.pos.lookFor(LOOK_STRUCTURES).some(s => s.structureType === STRUCTURE_RAMPART);
            const hasSite = struct.pos.lookFor(LOOK_CONSTRUCTION_SITES).some(s => s.structureType === STRUCTURE_RAMPART);

            if (!hasRampart && !hasSite) room.createConstructionSite(struct.pos, STRUCTURE_RAMPART);
        });
    },

    planExtractors: function(room) {
        // Extractors können erst ab RCL 6 gebaut werden
        if (!room.controller || !room.controller.my || room.controller.level < 6) return;

        const minerals = room.find(FIND_MINERALS);
        if (minerals.length > 0) {
            const mineral = minerals[0];
            const hasExtractor = mineral.pos.lookFor(LOOK_STRUCTURES).some(s => s.structureType === STRUCTURE_EXTRACTOR);
            const hasSite = mineral.pos.lookFor(LOOK_CONSTRUCTION_SITES).some(s => s.structureType === STRUCTURE_EXTRACTOR);
            
            if (!hasExtractor && !hasSite) {
                if (room.createConstructionSite(mineral.pos, STRUCTURE_EXTRACTOR) === OK) {
                    console.log(`[Planner] Auto-placing Extractor on mineral in ${room.name}`);
                }
            }
        }
    },

    planContainers: function(room) {
        // Container machen ab RCL 2 Sinn
        if (!room.controller || !room.controller.my || room.controller.level < 2) return;

        // Wir wollen Container an: Quellen, Controller und Mineralien
        const targets = [...room.find(FIND_SOURCES), room.controller, ...room.find(FIND_MINERALS)];
        
        // --- SCOS AUTO-CONTAINER: Remote Räume abdecken ---
        if (roomsConfig.registry) {
            Object.keys(roomsConfig.registry).forEach(rn => {
                if (roomsConfig.registry[rn].type === 'REMOTE' && roomsConfig.registry[rn].base === room.name) {
                    if (Game.rooms[rn]) {
                        targets.push(...Game.rooms[rn].find(FIND_SOURCES));
                    }
                }
            });
        }

        targets.forEach(target => {
            const nearby = target.pos.findInRange(FIND_STRUCTURES, 2, { filter: s => s.structureType === STRUCTURE_CONTAINER });
            const nearbySites = target.pos.findInRange(FIND_CONSTRUCTION_SITES, 2, { filter: s => s.structureType === STRUCTURE_CONTAINER });
            
            if (nearby.length === 0 && nearbySites.length === 0) {
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        if (dx === 0 && dy === 0) continue;
                        const pos = new RoomPosition(target.pos.x + dx, target.pos.y + dy, target.pos.roomName);
                        const terrain = Game.map.getRoomTerrain(pos.roomName).get(pos.x, pos.y);
                        if (terrain !== TERRAIN_MASK_WALL) {
                            const hasStuff = pos.lookFor(LOOK_STRUCTURES).length > 0 || pos.lookFor(LOOK_CONSTRUCTION_SITES).length > 0;
                            if (!hasStuff && pos.createConstructionSite(STRUCTURE_CONTAINER) === OK) return; // Nur 1 Container pro Target
                        }
                    }
                }
            }
        });
    },

    planLinks: function(room) {
        // Links sind ab RCL 5 verfügbar
        if (!room.controller || !room.controller.my || room.controller.level < 5) return;

        const allowed = CONTROLLER_STRUCTURES[STRUCTURE_LINK][room.controller.level] || 0;
        const current = room.find(FIND_MY_STRUCTURES, {filter: s => s.structureType === STRUCTURE_LINK}).length +
                        room.find(FIND_CONSTRUCTION_SITES, {filter: s => s.structureType === STRUCTURE_LINK}).length;

        if (current >= allowed) return;

        let placed = current;
        
        // Prioritätenliste der Standorte: 1. Storage, 2. Quellen, 3. Controller
        const targets = [];
        if (room.storage) targets.push(room.storage);
        targets.push(...room.find(FIND_SOURCES));
        targets.push(room.controller);

        for (const target of targets) {
            if (placed >= allowed) break;

            const nearbyLinks = target.pos.findInRange(FIND_MY_STRUCTURES, 2, {filter: s => s.structureType === STRUCTURE_LINK});
            const nearbySites = target.pos.findInRange(FIND_CONSTRUCTION_SITES, 2, {filter: s => s.structureType === STRUCTURE_LINK});

            if (nearbyLinks.length === 0 && nearbySites.length === 0) {
                let spotFound = false;
                // Suche bevorzugt in exakt 2 Feldern Abstand (d=2), um Platz am Container zu lassen. Wenn blockiert, d=1.
                for (let d = 2; d >= 1 && !spotFound; d--) {
                    for (let dx = -d; dx <= d && !spotFound; dx++) {
                        for (let dy = -d; dy <= d && !spotFound; dy++) {
                            if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;

                            const pos = new RoomPosition(target.pos.x + dx, target.pos.y + dy, room.name);
                            const terrain = Game.map.getRoomTerrain(room.name).get(pos.x, pos.y);
                            if (terrain === TERRAIN_MASK_WALL) continue;

                            // Check for blocking structures or construction sites, but ignore roads.
                            const hasBlockingStructure = pos.lookFor(LOOK_STRUCTURES).some(s => s.structureType !== STRUCTURE_ROAD);
                            const hasBlockingSite = pos.lookFor(LOOK_CONSTRUCTION_SITES).some(s => s.structureType !== STRUCTURE_ROAD);

                            if (!hasBlockingStructure && !hasBlockingSite) {
                                if (room.createConstructionSite(pos, STRUCTURE_LINK) === OK) {
                                    placed++;
                                    spotFound = true;
                                }
                            }
                        }
                    }
                }
            }
        }
    },

    planLabs: function(room) {
        // Labs sind ab RCL 6 verfügbar
        if (!room.controller || !room.controller.my || room.controller.level < 6) return;

        const allowed = CONTROLLER_STRUCTURES[STRUCTURE_LAB][room.controller.level] || 0;
        const built = room.find(FIND_MY_STRUCTURES, {filter: s => s.structureType === STRUCTURE_LAB}).length +
                      room.find(FIND_CONSTRUCTION_SITES, {filter: s => s.structureType === STRUCTURE_LAB}).length;

        if (built >= allowed) return;
        const spawns = room.find(FIND_MY_SPAWNS);
        if (spawns.length === 0) return;

        // Kompaktes 10-Labor-Layout. Die ersten beiden [0,1] und [1,2] sind die Zentral-Labore.
        const labStamp = [
            [0,1], [1,2], [0,0], [1,0], [2,1], [2,2], [2,3], [1,3], [0,3], [-1,2]
        ];

        // Einmalig einen leeren Ankerpunkt für den ganzen Block suchen und im Raum-Memory speichern
        if (!room.memory.labAnchor) {
            let found = false;
            for (let radius = 3; radius <= 15 && !found; radius++) {
                for (let dx = -radius; dx <= radius && !found; dx++) {
                    for (let dy = -radius; dy <= radius && !found; dy++) {
                        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;

                        const baseX = spawns[0].pos.x + dx;
                        const baseY = spawns[0].pos.y + dy;

                        let valid = true;
                        for (const offset of labStamp) {
                            const x = baseX + offset[0];
                            const y = baseY + offset[1];
                            if (x < 2 || x > 47 || y < 2 || y > 47 || Game.map.getRoomTerrain(room.name).get(x, y) === TERRAIN_MASK_WALL) { valid = false; break; }
                            const pos = new RoomPosition(x, y, room.name);
                            if (pos.lookFor(LOOK_STRUCTURES).some(s => s.structureType !== STRUCTURE_ROAD) || pos.lookFor(LOOK_CONSTRUCTION_SITES).some(s => s.structureType !== STRUCTURE_ROAD)) { valid = false; break; }
                        }
                        if (valid) { room.memory.labAnchor = { x: baseX, y: baseY }; found = true; }
                    }
                }
            }
        }

        if (room.memory.labAnchor) {
            for (let i = built; i < allowed && i < labStamp.length; i++) {
                const pos = new RoomPosition(room.memory.labAnchor.x + labStamp[i][0], room.memory.labAnchor.y + labStamp[i][1], room.name);
                if (!pos.lookFor(LOOK_STRUCTURES).some(s => s.structureType === STRUCTURE_LAB) && !pos.lookFor(LOOK_CONSTRUCTION_SITES).some(s => s.structureType === STRUCTURE_LAB)) {
                    room.createConstructionSite(pos, STRUCTURE_LAB);
                }
            }
        }
    },

    planCore: function(room) {
        const spawns = room.find(FIND_MY_SPAWNS);
        if (spawns.length === 0) {
            // --- AUTO-BOOTSTRAP FIRST SPAWN ---
            const spawnSites = room.find(FIND_CONSTRUCTION_SITES, { filter: s => s.structureType === STRUCTURE_SPAWN });
            if (spawnSites.length > 0) return; // Bereits in Planung
            
            const sources = room.find(FIND_SOURCES);
            if (sources.length > 0 && room.controller) {
                // Sucht den Weg zwischen Controller und Quelle und platziert den Spawn in die Mitte
                const path = room.findPath(room.controller.pos, sources[0].pos, { ignoreCreeps: true, swampCost: 2 });
                if (path.length > 4) {
                    const midIndex = Math.floor(path.length / 2);
                    const pos = new RoomPosition(path[midIndex].x, path[midIndex].y, room.name);
                    room.createConstructionSite(pos, STRUCTURE_SPAWN);
                    console.log(`[Planner] Auto-placing first Spawn in ${room.name} at ${pos.x},${pos.y}`);
                }
            }
            return; // Beenden, da der Anchor (Spawn) erst fertig gebaut werden muss
        }
        const anchor = spawns[0].pos;

        const rcl = room.controller ? room.controller.level : 0;
        
        // Dynamische Liste aller Kern-Strukturen, die in das Schachbrett-Muster passen.
        // ACHTUNG: STRUCTURE_LINK und STRUCTURE_LAB wurden entfernt! Sie erfordern eigene Platzierungs-Logik.
        const coreStructures = [
            STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_TOWER, STRUCTURE_STORAGE,
            STRUCTURE_TERMINAL, STRUCTURE_OBSERVER,
            STRUCTURE_NUKER, STRUCTURE_POWER_SPAWN, STRUCTURE_FACTORY
        ];

        const state = {};
        let everythingBuilt = true;

        // Ermittle für jede Struktur, was wir auf diesem Level dürfen und was wir schon haben
        for (const type of coreStructures) {
            const allowed = CONTROLLER_STRUCTURES[type][rcl] || 0;
            const built = room.find(FIND_MY_STRUCTURES, {filter: s => s.structureType === type}).length +
                          room.find(FIND_CONSTRUCTION_SITES, {filter: s => s.structureType === type}).length;
            
            state[type] = { allowed, built };
            if (built < allowed) everythingBuilt = false;
        }

        // Abbruch, wenn das aktuelle RCL-Maximum bereits komplett ausgereizt ist
        if (everythingBuilt) return;

        // Expanding square around the spawn (radius 2 to 12)
        for (let radius = 2; radius <= 12; radius++) {
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dy = -radius; dy <= radius; dy++) {
                    // Checkerboard pattern to leave space for roads
                    if ((Math.abs(dx) + Math.abs(dy)) % 2 !== 0) continue;
                    if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;

                    const x = anchor.x + dx;
                    const y = anchor.y + dy;
                    if (x < 2 || x > 47 || y < 2 || y > 47) continue;

                    const pos = new RoomPosition(x, y, room.name);
                    const terrain = Game.map.getRoomTerrain(room.name).get(x, y);
                    if (terrain === TERRAIN_MASK_WALL) continue;

                    const hasStuff = pos.lookFor(LOOK_STRUCTURES).length > 0 || pos.lookFor(LOOK_CONSTRUCTION_SITES).length > 0;
                    if (hasStuff) continue;

                    // Platziere die erste fehlende Struktur aus unserer Prioritätenliste
                    for (const type of coreStructures) {
                        if (state[type].built < state[type].allowed) {
                            if (room.createConstructionSite(pos, type) === OK) {
                                state[type].built++;
                                
                                // Prüfen, ob nach diesem Bauauftrag nun ALLES erfüllt ist
                                everythingBuilt = true;
                                for (const t of coreStructures) {
                                    if (state[t].built < state[t].allowed) everythingBuilt = false;
                                }
                                if (everythingBuilt) return;
                            }
                            break; // Wenn ein Gebäude auf das Feld gesetzt wurde, iteriere nicht weiter für DIESES Feld
                        }
                    }
                }
            }
        }
    }
};