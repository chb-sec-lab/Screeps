/**
 * utils.planner.js - SCOS Automated Construction
 * Safely plans roads and basic infrastructure without blowing up the CPU.
 */
module.exports = {
    run: function(room) {
        // Abort if global construction site limit is near (max 100)
        if (Object.keys(Game.constructionSites).length > 80) return;

        this.planCore(room);
        this.planRoads(room);
        this.planExtractors(room);
        this.planContainers(room);
        this.planRamparts(room);
    },

    planRoads: function(room) {
        const spawns = room.find(FIND_MY_SPAWNS);
        if (spawns.length === 0) return;
        const anchor = spawns[0].pos;

        const targets = [...room.find(FIND_SOURCES)];
        if (room.controller) targets.push(room.controller);

        targets.forEach(target => {
            const path = PathFinder.search(anchor, { pos: target.pos, range: 1 }, {
                plainCost: 2,
                swampCost: 2, // Treat swamps like plains so we naturally pave them
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
                    return costs;
                }
            }).path;

            // Place a road construction site on each step of the path
            path.forEach(pos => {
                room.createConstructionSite(pos, STRUCTURE_ROAD);
            });
        });
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
        
        targets.forEach(target => {
            const nearby = target.pos.findInRange(FIND_STRUCTURES, 2, { filter: s => s.structureType === STRUCTURE_CONTAINER });
            const nearbySites = target.pos.findInRange(FIND_CONSTRUCTION_SITES, 2, { filter: s => s.structureType === STRUCTURE_CONTAINER });
            
            if (nearby.length === 0 && nearbySites.length === 0) {
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        if (dx === 0 && dy === 0) continue;
                        const pos = new RoomPosition(target.pos.x + dx, target.pos.y + dy, room.name);
                        const terrain = Game.map.getRoomTerrain(room.name).get(pos.x, pos.y);
                        if (terrain !== TERRAIN_MASK_WALL) {
                            const hasStuff = pos.lookFor(LOOK_STRUCTURES).length > 0 || pos.lookFor(LOOK_CONSTRUCTION_SITES).length > 0;
                            if (!hasStuff && room.createConstructionSite(pos, STRUCTURE_CONTAINER) === OK) return; // Nur 1 Container pro Target
                        }
                    }
                }
            }
        });
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
        
        // Dynamische Liste aller Kern-Strukturen, die in der Basis stehen sollen
        const coreStructures = [
            STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_TOWER, STRUCTURE_STORAGE,
            STRUCTURE_TERMINAL, STRUCTURE_LINK, STRUCTURE_LAB, STRUCTURE_OBSERVER,
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