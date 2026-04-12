/**
 * role.harvester.js - SCOS v6.2.0
 * Fix: Strict Delivery Priority (Extensions > Storage > Containers)
 */
module.exports = {
    run: function(creep) {
        // Auto-Recycle Reset Logic
        if (creep.memory.lastIdleTick !== Game.time - 1) {
            creep.memory.idleCount = 0;
        }
        
        // --- ACTIVE EVASION (KITING) ---
        // Weicht bewaffneten Feinden aus, die näher als 5 Felder kommen, arbeitet ansonsten weiter!
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

        // ---------------------------
        // Helpers: Source Balancing
        // ---------------------------
        function countAssignedMiners(sourceId) {
            return _.sum(Game.creeps, c =>
                c.my &&
                c.memory &&
                c.memory.role === 'harvester' &&
                c.memory.targetSourceId === sourceId
            );
        }

        function pickLeastAssignedSource(room) {
            const sources = room.find(FIND_SOURCES);
            if (!sources.length) return null;

            let best = null;
            let bestCount = Infinity;
            let bestRange = Infinity;

            for (const s of sources) {
                const cnt = countAssignedMiners(s.id);
                const r = creep.pos.getRangeTo(s);
                if (cnt < bestCount || (cnt === bestCount && r < bestRange)) {
                    best = s;
                    bestCount = cnt;
                    bestRange = r;
                }
            }
            return best;
        }

        const targetRoom = creep.memory.targetRoom;
        if (targetRoom && creep.room.name !== targetRoom) {
            const exit = creep.pos.findClosestByRange(creep.room.findExitTo(targetRoom));
            if (exit) creep.moveTo(exit, { visualizePathStyle: { stroke: '#ffaa00' } });
            return;
        }

        let source = creep.memory.targetSourceId ? Game.getObjectById(creep.memory.targetSourceId) : null;
        // Auto-Fix: Falls die Quelle nicht mehr existiert oder im falschen Raum ist
        if (source && source.room.name !== creep.room.name) source = null;
        
        const isDepleted = source && source.energy === 0;

        // REFLEX: Wenn der Rucksack Platz hat, ABER die Quelle leer ist und wir Energie dabei haben -> Liefern!
        if (creep.store.getFreeCapacity() > 0 && !(isDepleted && creep.store.getUsedCapacity() > 0)) {

            // Falls keine Quelle gelockt ist, suche die am wenigsten besetzte
            if (!source) {
                source = pickLeastAssignedSource(creep.room);
                if (source) {
                    creep.memory.targetSourceId = source.id;
                    creep.memory.overbookCount = 0;
                }
            }
            
            if (source) {
                const assigned = countAssignedMiners(source.id);
                const MAX_MINERS_PER_SOURCE = 5; // Erhöht für starke Overbooking-Szenarien (z.B. 9 Miner auf 2 Quellen)

                // Anti-Clustering: Wenn die Quelle überbucht ist, versuche zu wechseln!
                if (assigned > MAX_MINERS_PER_SOURCE) {
                    creep.memory.overbookCount = (creep.memory.overbookCount || 0) + 1;
                    if (creep.memory.overbookCount >= 8) { // 8 Ticks in Folge überbucht
                        const bestAlt = pickLeastAssignedSource(creep.room);
                        if (bestAlt && bestAlt.id !== source.id) {
                            const altAssigned = countAssignedMiners(bestAlt.id);
                            if (altAssigned < assigned) {
                                creep.memory.targetSourceId = bestAlt.id;
                                creep.memory.overbookCount = 0;
                                source = bestAlt;
                                creep.say('Swap Src');
                            }
                        }
                    }
                } else {
                    creep.memory.overbookCount = 0;
                }

                if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
            }
        } else {
            // 1. Priority: Links (Stationary mining beam)
            let target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: (s) => s.structureType === STRUCTURE_LINK && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && creep.pos.inRangeTo(s, 2)
            });

            // 2. Priority: Containers (Stationary mining buffer)
            if (!target) {
                target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: (s) => s.structureType === STRUCTURE_CONTAINER && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && creep.pos.inRangeTo(s, 3)
                });
            }

            // 3. Fallback: Vital Infrastructure (Spawn & Extensions) - Springt ein, wenn Container voll/nicht da ist!
            if (!target) {
                target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                    ignoreCreeps: true,
                    filter: (s) => {
                        return (s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_SPAWN) &&
                               s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                    }
                });
            }

            // 4. Secondary: Storage
            if (!target) {
                target = creep.room.storage;
                if (target && target.store.getFreeCapacity(RESOURCE_ENERGY) === 0) target = null;
            }

            if (target) {
                if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                }
            } else {
                // Fallback: If the base is 100% full, use WORK parts to help out instead of idling
                const site = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
                if (site) {
                    creep.say('Aux:Bld');
                    if (creep.build(site) === ERR_NOT_IN_RANGE) creep.moveTo(site, { visualizePathStyle: { stroke: '#ffff00' } });
                } else if (creep.room.controller) {
                    creep.say('Aux:Upg');
                    if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#ffff00' } });
                } else {
                    creep.say('Idle:Full');
                    let source = Game.getObjectById(creep.memory.targetSourceId);
                    if (source) {
                        if (!creep.pos.inRangeTo(source, 3)) creep.moveTo(source, { range: 3, visualizePathStyle: { stroke: '#555555' } });
                    } else if (creep.room.controller) {
                        if (!creep.pos.inRangeTo(creep.room.controller, 3)) creep.moveTo(creep.room.controller, { range: 3, visualizePathStyle: { stroke: '#555555' } });
                    }
                    creep.memory.lastIdleTick = Game.time;
                    creep.memory.idleCount = (creep.memory.idleCount || 0) + 1;
                    if (creep.memory.idleCount > 500) creep.memory.recycle = true;
                }
            }
        }
    }
};