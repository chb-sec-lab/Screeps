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

    planCore: function(room) {
        const spawns = room.find(FIND_MY_SPAWNS);
        if (spawns.length === 0) return;
        const anchor = spawns[0].pos;

        const rcl = room.controller ? room.controller.level : 0;
        const allowedExt = CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][rcl] || 0;
        const allowedTowers = CONTROLLER_STRUCTURES[STRUCTURE_TOWER][rcl] || 0;

        const currentExt = room.find(FIND_MY_STRUCTURES, {filter: s => s.structureType === STRUCTURE_EXTENSION}).length +
                           room.find(FIND_CONSTRUCTION_SITES, {filter: s => s.structureType === STRUCTURE_EXTENSION}).length;
        const currentTowers = room.find(FIND_MY_STRUCTURES, {filter: s => s.structureType === STRUCTURE_TOWER}).length +
                              room.find(FIND_CONSTRUCTION_SITES, {filter: s => s.structureType === STRUCTURE_TOWER}).length;

        // Abort if we already have everything allowed at this RCL
        if (currentExt >= allowedExt && currentTowers >= allowedTowers) return;

        let placedExt = currentExt;
        let placedTowers = currentTowers;

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

                    if (placedExt < allowedExt) {
                        if (room.createConstructionSite(pos, STRUCTURE_EXTENSION) === OK) placedExt++;
                    } else if (placedTowers < allowedTowers) {
                        if (room.createConstructionSite(pos, STRUCTURE_TOWER) === OK) placedTowers++;
                    }

                    if (placedExt >= allowedExt && placedTowers >= allowedTowers) return;
                }
            }
        }
    }
};