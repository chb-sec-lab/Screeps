/**
 * role.hauler.js - SCOS v6.0.3
 * Updated: 2026-02-13 11:15 CET (Europe/Amsterdam)
 *
 * Priorities (deliver):
 *  1) Towers (keep high, target ~90%+)
 *  2) Spawn/extensions
 *  3) Storage
 *
 * Priorities (withdraw):
 *  - Prefer containers (to keep them empty), then storage
 */
const rooms = require('config.rooms');

module.exports = {
    run: function (creep) {
        // Auto-Recycle Reset Logic
        if (creep.memory.lastIdleTick !== Game.time - 1) {
            creep.memory.idleCount = 0;
        }

        const remoteTargetRoom = creep.memory.targetRoom || null;
        const deliveryRoom = creep.memory.homeRoom || rooms.HOME;
        const localWorkRoom = creep.memory.workRoom || rooms.HOME;

        // --- 1. FEIND-VERMEIDUNG (EIGENSCHUTZ) ---
        let danger = false;
        if (creep.room.name !== deliveryRoom && creep.room.name !== localWorkRoom) {
            const hostiles = creep.room.find(FIND_HOSTILE_CREEPS, {
                filter: c => c.getActiveBodyparts(ATTACK) > 0 || c.getActiveBodyparts(RANGED_ATTACK) > 0 || c.getActiveBodyparts(HEAL) > 0
            });
            const cores = creep.room.find(FIND_HOSTILE_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_INVADER_CORE
            });
            if (hostiles.length > 0 || cores.length > 0) {
                danger = true;
                creep.memory.fleeCooldown = Game.time + 50; // Remember danger!
            }
        }

        if (danger || (creep.memory.fleeCooldown && Game.time < creep.memory.fleeCooldown)) {
            if (creep.room.name !== deliveryRoom && creep.room.name !== localWorkRoom) {
                creep.say('Flee:Enemy');
                const exit = creep.pos.findClosestByRange(creep.room.findExitTo(deliveryRoom));
                if (exit) creep.moveTo(exit, { visualizePathStyle: { stroke: '#ff0000' } });
            } else {
                creep.say('Wait:Safe');
                if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                    creep.moveTo(new RoomPosition(25, 25, creep.room.name), { range: 22 });
                }
                creep.memory.lastIdleTick = Game.time;
                creep.memory.idleCount = (creep.memory.idleCount || 0) + 1;
                if (creep.memory.idleCount > 500) creep.memory.recycle = true;
            }
            return; // Brich alle anderen Aktionen ab!
        }

        if (remoteTargetRoom) {
            // --- PRE-FLIGHT CHECK: Wait for healing if damaged before leaving safe room ---
            if (creep.hits < creep.hitsMax && creep.room.name === deliveryRoom) {
                creep.say('Wait:Heal');
                return; // Warte im sicheren Raum, bis der Tower dich vollgeheilt hat
            }

            // Assigned remote hauler: loot in target room, deliver in home room.
        if (creep.store.getUsedCapacity() === 0) {
                if (creep.room.name !== remoteTargetRoom) {
                    const exit = creep.pos.findClosestByRange(creep.room.findExitTo(remoteTargetRoom));
                    if (exit) creep.moveTo(exit);
                    return;
                }

            const dropped = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES, {
                ignoreCreeps: true, filter: r => r.amount >= 100
                });
                if (dropped) {
                    if (creep.pickup(dropped) === ERR_NOT_IN_RANGE) creep.moveTo(dropped);
                    return;
                }

            const ruin = creep.pos.findClosestByRange(FIND_RUINS, {
                ignoreCreeps: true, filter: r => r.store && r.store.getUsedCapacity() > 0
                });
                if (ruin) {
                const res = Object.keys(ruin.store)[0];
                if (creep.withdraw(ruin, res) === ERR_NOT_IN_RANGE) creep.moveTo(ruin);
                    return;
                }

            const tomb = creep.pos.findClosestByRange(FIND_TOMBSTONES, {
                ignoreCreeps: true, filter: t => t.store && t.store.getUsedCapacity() > 0
                });
                if (tomb) {
                const res = Object.keys(tomb.store)[0];
                if (creep.withdraw(tomb, res) === ERR_NOT_IN_RANGE) creep.moveTo(tomb);
                    return;
                }

            const container = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                ignoreCreeps: true, filter: s => s.structureType === STRUCTURE_CONTAINER && s.store && s.store.getUsedCapacity() >= 200
                });
                if (container) {
                let resToWithdraw = RESOURCE_ENERGY;
                for (let r in container.store) if (r !== RESOURCE_ENERGY && container.store[r] > 0) resToWithdraw = r;
                if (container.store[resToWithdraw] === 0) resToWithdraw = Object.keys(container.store)[0];
                
                if (resToWithdraw && creep.withdraw(container, resToWithdraw) === ERR_NOT_IN_RANGE) creep.moveTo(container);
                    return;
                }

                creep.say('Seek Drop');
            const waitSrc = creep.pos.findClosestByRange(FIND_SOURCES, { ignoreCreeps: true });
            if (waitSrc && !creep.pos.inRangeTo(waitSrc, 3)) {
                creep.moveTo(waitSrc, { visualizePathStyle: { stroke: '#555555' } });
            } else if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                creep.moveTo(new RoomPosition(25, 25, creep.room.name), { range: 22 });
                }
                creep.memory.lastIdleTick = Game.time;
                creep.memory.idleCount = (creep.memory.idleCount || 0) + 1;
                if (creep.memory.idleCount > 500) creep.memory.recycle = true;
                return;
            }

            if (creep.room.name !== deliveryRoom) {
                const exit = creep.pos.findClosestByRange(creep.room.findExitTo(deliveryRoom));
                if (exit) creep.moveTo(exit);
                return;
            }
        } else if (creep.room.name !== localWorkRoom) {
            const exit = creep.pos.findClosestByRange(creep.room.findExitTo(localWorkRoom));
            if (exit) creep.moveTo(exit);
            return;
        }

        const storage = creep.room.storage;
        
        const sources = creep.room.find(FIND_SOURCES);
        const minerals = creep.room.find(FIND_MINERALS);
        const isSourceContainer = (s) => {
            if (s.structureType !== STRUCTURE_CONTAINER) return false;
            for (let src of sources) if (s.pos.inRangeTo(src, 2)) return true;
            for (let min of minerals) if (s.pos.inRangeTo(min, 2)) return true;
            return false;
        };
        const isBaseContainer = (s) => s.structureType === STRUCTURE_CONTAINER && !isSourceContainer(s);

        // --- If empty: withdraw (drops first, then containers, then storage) ---
        if (creep.store.getUsedCapacity() === 0) {
            // 1. Pick up dropped resources (crucial before containers are built)
            const dropped = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES, {
                ignoreCreeps: true, filter: r => r.amount >= 50
            });
            if (dropped) {
                if (creep.pickup(dropped) === ERR_NOT_IN_RANGE) creep.moveTo(dropped, { visualizePathStyle: { stroke: '#ffaa00' } });
                return;
            }

            // 2. Tombstones & Ruins
            const tomb = creep.pos.findClosestByRange(FIND_TOMBSTONES, { ignoreCreeps: true, filter: t => t.store && t.store.getUsedCapacity() > 0 });
            if (tomb) {
                const res = Object.keys(tomb.store)[0];
                if (creep.withdraw(tomb, res) === ERR_NOT_IN_RANGE) creep.moveTo(tomb, { visualizePathStyle: { stroke: '#ffaa00' } });
                return;
            }
            const ruin = creep.pos.findClosestByRange(FIND_RUINS, { ignoreCreeps: true, filter: r => r.store && r.store.getUsedCapacity() > 0 });
            if (ruin) {
                const res = Object.keys(ruin.store)[0];
                if (creep.withdraw(ruin, res) === ERR_NOT_IN_RANGE) creep.moveTo(ruin, { visualizePathStyle: { stroke: '#ffaa00' } });
                return;
            }

            // 3. Source & Mineral Containers (Immer leeren, um Mining nicht zu blockieren)
            let src = creep.pos.findClosestByRange(FIND_STRUCTURES, {
            ignoreCreeps: true,
                filter: s =>
                    isSourceContainer(s) && s.store && s.store.getUsedCapacity() >= 100
            });
            
            let resToWithdraw = null;

            // 3.5 Core Link (Unload beamed energy into storage)
            if (!src && storage) {
                let coreLink = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                ignoreCreeps: true,
                filter: s => s.structureType === STRUCTURE_LINK && s.store[RESOURCE_ENERGY] >= 200 && s.pos.inRangeTo(storage, 2)
                });
                if (coreLink) { src = coreLink; resToWithdraw = RESOURCE_ENERGY; }
            }

            // 4. Storage & Sink Containers (Ausgleich / Balancing)
            // Wenn Spawns, Türme ODER leere Container (Upgrader-Bin) dringend Energie brauchen!
            if (!src) {
                const needsRefill = creep.room.find(FIND_STRUCTURES, {
                    filter: s => 
                        ((s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0) ||
                        (s.structureType === STRUCTURE_TOWER && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && s.store[RESOURCE_ENERGY] < s.store.getCapacity(RESOURCE_ENERGY) * 0.90) ||
                        (s.structureType === STRUCTURE_CONTAINER && creep.room.controller && s.pos.inRangeTo(creep.room.controller, 3) && s.store[RESOURCE_ENERGY] < 800) || 
                        (isBaseContainer(s) && s.store[RESOURCE_ENERGY] < 500 && (!creep.room.controller || !s.pos.inRangeTo(creep.room.controller, 3))) 
                });
                if (needsRefill.length > 0) { 
                    src = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                    ignoreCreeps: true,
                        filter: s => 
                            (s.structureType === STRUCTURE_STORAGE && s.store[RESOURCE_ENERGY] > 0) ||
                            (isBaseContainer(s) && s.store[RESOURCE_ENERGY] >= 1000 && (!creep.room.controller || !s.pos.inRangeTo(creep.room.controller, 3))) 
                    });
                    if (src) resToWithdraw = RESOURCE_ENERGY; 
                }
            }

            if (src) {
                if (!resToWithdraw) {
                    resToWithdraw = RESOURCE_ENERGY;
                    for (let r in src.store) if (r !== RESOURCE_ENERGY && src.store[r] > 0) resToWithdraw = r;
                    if (src.store[resToWithdraw] === 0) resToWithdraw = Object.keys(src.store)[0];
                }
                if (resToWithdraw && creep.withdraw(src, resToWithdraw) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(src, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
            } else {
                creep.say('Idle:Empty');
                // Anti-Ping-Pong im Idle
                const waitSrc = creep.pos.findClosestByRange(FIND_SOURCES, { ignoreCreeps: true });
            if (waitSrc && !creep.pos.inRangeTo(waitSrc, 3)) {
                creep.moveTo(waitSrc, { visualizePathStyle: { stroke: '#555555' } });
            } else if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                creep.moveTo(new RoomPosition(25, 25, creep.room.name), { range: 22 });
                }
                creep.memory.lastIdleTick = Game.time;
                creep.memory.idleCount = (creep.memory.idleCount || 0) + 1;
                if (creep.memory.idleCount > 500) creep.memory.recycle = true;
            }
            return;
        }

        // --- If carrying: deliver by priority ---

        // MINERAL-DELIVERY (Unclogging Containers & System-Wide Export)
        for (const res in creep.store) {
            if (res !== RESOURCE_ENERGY && creep.store[res] > 0) {
                let sink = creep.room.terminal || creep.room.storage;
                if (sink && sink.store.getFreeCapacity(res) > 0) {
                    if (creep.transfer(sink, res) === ERR_NOT_IN_RANGE) creep.moveTo(sink);
                    return;
                }
                
                // SYSTEMÜBERGREIFENDER DROP: Finde das nächste freie Storage/Terminal im Imperium!
                let globalSink = null;
                let bestDist = Infinity;
                for (let rn in Game.rooms) {
                    const r = Game.rooms[rn];
                    if (r.controller && r.controller.my && (r.storage || r.terminal)) {
                        const targetSink = (r.terminal && r.terminal.store.getFreeCapacity(res) > 0) ? r.terminal : 
                                         ((r.storage && r.storage.store.getFreeCapacity(res) > 0) ? r.storage : null);
                        if (targetSink) {
                            const dist = Game.map.getRoomLinearDistance(creep.room.name, rn);
                            if (dist < bestDist) { bestDist = dist; globalSink = targetSink; }
                        }
                    }
                }
                if (globalSink) {
                    creep.say('Export:Min');
                    if (creep.transfer(globalSink, res) === ERR_NOT_IN_RANGE) creep.moveTo(globalSink, { visualizePathStyle: { stroke: '#ff00ff' } });
                    return;
                }
            }
        }
        
        // Falls wir NUR Mineralien dabei haben, aber im ganzen Imperium kein Platz ist, bleiben wir hängen. 
        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
            if (creep.store.getUsedCapacity() > 0) creep.say('Stuck:Min');
            return;
        }

        const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);
        
        const spawnExt = creep.pos.findClosestByRange(FIND_STRUCTURES, {
            ignoreCreeps: true,
            filter: s =>
                (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) &&
                s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });

        const towersNeed = creep.room.find(FIND_STRUCTURES, {
            filter: s =>
                s.structureType === STRUCTURE_TOWER &&
                s.store.getFreeCapacity(RESOURCE_ENERGY) > 0 &&
                s.store[RESOURCE_ENERGY] < s.store.getCapacity(RESOURCE_ENERGY) * 0.90
        });

        if (hostiles.length > 0) {
            // KRIEGSMODUS: Türme haben absolute Priorität, um die Basis zu verteidigen!
            if (towersNeed.length) {
                const t = creep.pos.findClosestByRange(towersNeed, { ignoreCreeps: true });
                if (t && creep.transfer(t, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(t);
                return;
            }
            if (spawnExt) {
                if (creep.transfer(spawnExt, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(spawnExt);
                return;
            }
        } else {
            // FRIEDENSMODUS: Wirtschaft geht vor! Spawns/Extensions füllen, um Deadlocks zu verhindern.
            if (spawnExt) {
                if (creep.transfer(spawnExt, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(spawnExt);
                return;
            }
            if (towersNeed.length) {
                const t = creep.pos.findClosestByRange(towersNeed, { ignoreCreeps: true });
                if (t && creep.transfer(t, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(t);
                return;
            }
        }

        // 2.5) Controller Containers (Upgrader Bins) - Priority fill!
        if (creep.room.controller) {
            const upgraderBin = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: s => 
                    s.structureType === STRUCTURE_CONTAINER &&
                    s.pos.inRangeTo(creep.room.controller, 3) &&
                    s.store.getFreeCapacity(RESOURCE_ENERGY) > 0 &&
                    s.store[RESOURCE_ENERGY] < 1500 // Balance: Platz lassen, nicht komplett überfüllen
            });
            if (upgraderBin) {
                if (creep.transfer(upgraderBin, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(upgraderBin);
                return;
            }
        }

        // 3) Storage
        if (storage && storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
            if (creep.transfer(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(storage);
            return;
        }

        // 4) Base Containers (Mini-Storage if no real Storage exists)
        if (!storage) {
            const baseContainer = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: s => 
                    isBaseContainer(s) &&
                    s.store.getFreeCapacity(RESOURCE_ENERGY) > 0 &&
                    s.store[RESOURCE_ENERGY] < 1800 // Balance
            });
            if (baseContainer) {
                if (creep.transfer(baseContainer, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(baseContainer);
                return;
            }
        }

        // 5) SYSTEMÜBERGREIFENDER ENERGY DROP (Export Excess Energy)
        // Wenn die Basis randvoll ist und kein lokales Storage existiert, bringen wir die Energie ins Hauptlager!
        if (!storage || storage.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
            let globalEnergySink = null;
            let bestDist = Infinity;
            for (let rn in Game.rooms) {
                if (rn === creep.room.name) continue;
                const r = Game.rooms[rn];
                if (r.controller && r.controller.my && (r.storage || r.terminal)) {
                    const targetSink = (r.terminal && r.terminal.store.getFreeCapacity(RESOURCE_ENERGY) > 0) ? r.terminal : 
                                     ((r.storage && r.storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) ? r.storage : null);
                    if (targetSink) {
                        const dist = Game.map.getRoomLinearDistance(creep.room.name, rn);
                        if (dist < bestDist) { bestDist = dist; globalEnergySink = targetSink; }
                    }
                }
            }
            if (globalEnergySink) {
                creep.say('Export:Nrg');
                if (creep.transfer(globalEnergySink, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(globalEnergySink, { visualizePathStyle: { stroke: '#ff00ff' } });
                return;
            }
        }

        creep.say('Idle:Full');
        if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
            creep.moveTo(new RoomPosition(25, 25, creep.room.name), { range: 22 });
        }
        creep.memory.lastIdleTick = Game.time;
        creep.memory.idleCount = (creep.memory.idleCount || 0) + 1;
        if (creep.memory.idleCount > 500) creep.memory.recycle = true;
    }
};
