/**
 * main.js - SCOS Kernel
 * Role: Orchestrator / Spawn Policy / Defense Escalation / Audit Snapshots
 */
const rooms = require('config.rooms');
const roles = require('config.roles');
const logger = require('utils.logger');
const towerLogic = require('structure.tower');
const linkLogic = require('structure.link');
const labLogic = require('structure.lab');
const planner = require('utils.planner');
const inventory = require('utils.inventory');
const market = require('utils.market');
const expander = require('utils.expansion');
const DEFENSE_COOLDOWN_TICKS = 200;
const TACTICAL_AUDIT_INTERVAL = 200;
const STRATEGIC_AUDIT_INTERVAL = 3600;
const AUDIT_RETENTION_TACTICAL = 120;
const AUDIT_RETENTION_STRATEGIC = 100;

// --- GLOBAL PATHFINDER OVERRIDE ---
// Automatisches Blockieren von Räumen für alle Creeps
const originalMoveTo = Creep.prototype.moveTo;
Creep.prototype.moveTo = function(target, opts) {
    opts = opts || {};
    const userCallback = opts.roomCallback;
    
    // 🛠️ FIX: Give PathFinder enough CPU headroom to calculate detours around blacklisted rooms!
    // CPU FIX: Nur für raumübergreifende Reisen maxOps erhöhen, lokal auf 2000 lassen!
    let isCrossRoom = false;
    if (target.roomName && target.roomName !== this.room.name) isCrossRoom = true;
    if (target.pos && target.pos.roomName !== this.room.name) isCrossRoom = true;
    if (!opts.maxOps) opts.maxOps = isCrossRoom ? 8000 : 2000;

    const creep = this;

    opts.roomCallback = function(roomName) {
        if (rooms.BLACKLIST && rooms.BLACKLIST.includes(roomName)) {
            return false; // ⛔ Weist den PathFinder an, diesen Raum komplett zu ignorieren
        }

        // Scout-spezifische Feind-Vermeidung (Routing um Feindbasen herum)
        if (creep.memory && creep.memory.role === 'scout' && roomName !== creep.room.name) {
            const rData = Memory.inventory && Memory.inventory.rooms ? Memory.inventory.rooms[roomName] : null;
            if (rData) {
                if (rData.dangerUntil && Game.time < rData.dangerUntil) return false; // Raum ist temporär gesperrt
                if (rData.hostileTowers > 0 && !rData.my) return false; // Feindliche Base! Umweg berechnen.
            }
        }

        if (userCallback) {
            return userCallback(roomName);
        }
        return undefined;
    };
    
    return originalMoveTo.call(this, target, opts);
};

let modules = {};
const roleNames = ['harvester', 'hauler', 'remoteHauler', 'scavenger', 'repairer', 'defender', 'vanguard', 'medic', 'breacher', 'remoteMiner', 'builder', 'claimer', 'upgrader', 'healer', 'mineralMiner', 'chemist', 'scout'];

roleNames.forEach(name => {
    try { modules[name] = require('role.' + name); } catch (e) { /* Safe Load */ }
});

// --- GLOBAL CONSOLE COMMANDS ---
global.intel = function() {
    if (!Memory.inventory || !Memory.inventory.rooms) return "Keine Inventar-Daten gefunden.";
    let intel = Memory.inventory.rooms;
    console.log(`--- SCOS SCOUT INTEL ---`);
    Object.keys(intel).forEach(r => {
        let d = intel[r];
        let owner = d.my ? 'ME' : (d.reservation || 'None');
        let danger = '';
        if (d.dangerUntil && Game.time < d.dangerUntil) {
            danger = ` | ⚠️ DANGER (${d.dangerUntil - Game.time}t)`;
        } else if (d.hostileTowers > 0 && !d.my) {
            danger = ` | 🏰 ENEMY BASE`;
        }
        console.log(`🌍 [${r}] | 👑 Owner: ${owner} | ⚡ Src: ${d.sources} | 💎 Min: ${d.mineralAmount} | ⏱️ Scan: ${Game.time - d.lastUpdated}t ago${danger}`);
    });
    return "Intel report generated.";
};

module.exports.loop = function () {
    // --- CPU CIRCUIT BREAKER ---
    // Verhindert den finalen Absturz: Überspringt Ticks, wenn das Bucket leerläuft!
    if (Game.cpu.bucket < 500) {
        console.log(`⚠️ CRITICAL CPU BUCKET (${Game.cpu.bucket}). Skipping tick to recover.`);
        return; 
    }

    // --- AUTO-EXPANSION TARGET OVERRIDE ---
    if (Memory.empire && Memory.empire.targetRoom) {
        rooms.TARGET = Memory.empire.targetRoom;
    }

    for (let name in Memory.creeps) if (!Game.creeps[name]) delete Memory.creeps[name];

    // --- INVENTORY SCAN ---
    inventory.run();

    const census = {};
    roleNames.forEach(r => census[r] = 0);
    const homeRoom = Game.rooms[rooms.HOME];
    const allSpawns = Object.values(Game.spawns);

    // --- ACTIVE REGISTRY (Topology) ---
    // FIX: 'var' erzwingt das Hoisting der Variable. Verhindert ReferenceErrors, falls Codeblöcke de-synchronisiert wurden.
    var activeRegistry = {}; 
    if (rooms.registry) {
        for (let rn in rooms.registry) activeRegistry[rn] = rooms.registry[rn];
    }
    if (Memory.inventory && Memory.inventory.rooms) {
        Object.keys(Memory.inventory.rooms).forEach(rn => {
            // Wenn ein Raum uns gehört, wird er IMMER dynamisch zur eigenen Kolonie (CORE) hochgestuft!
            if (Memory.inventory.rooms[rn].my) {
                if (!activeRegistry[rn]) activeRegistry[rn] = { type: 'CORE' };
                else activeRegistry[rn].type = 'CORE'; // WICHTIG: Erhält Parameter wie maxBuilders am Leben!
            }
        });
    }
    if (Memory.empire && Memory.empire.targetRoom && !activeRegistry[Memory.empire.targetRoom]) {
        activeRegistry[Memory.empire.targetRoom] = { type: 'CORE' };
    }

    // --- EVOLUTION PROTOCOL (RCL-Based Dynamic Quotas) ---
    // JIT (Just-In-Time) Bedarfssteuerung: Evaluiert JEDEN geclaimten Raum einzeln basierend auf RCL UND tatsächlichem Bedarf
    function getPhaseQuotas(level, invData, config, roomName) {
        if (!invData) return { name: 'Unknown', builder: 0, upgrader: 0, repairer: 0, hauler: 0, scav: 0 };
        const sites = invData.constructionSites;
        const drops = invData.droppedEnergy;
        
        let b = 0, u = 0, r = 0, h = 0, s = 0;
        let phaseName = '';
        
        if (level <= 2) {
            const noSpawn = invData.spawns === 0;
            b = sites > 0 ? (sites > 5 ? 3 : 2) : (noSpawn ? 1 : 0); // AUTO-VISION: 1 Pionier geht vor um den Raum aufzudecken, falls der Planner noch nicht lief!
            u = sites > 0 ? 1 : 2; // FIX: Immer Upgrader mitschicken, um Downgrade zu verhindern und RCL zu pushen!
            
            // JIT LOGISTIK: Ab RCL 2 brauchen wir 1 Hauler, der die Container leert und Extensions füllt
            if (level === 2 && invData.containers > 0 && invData.extensions > 0) {
                h = 1;
                phaseName = 'Phase 1 (Logistics)';
            } else {
                h = noSpawn ? 0 : 1; 
                phaseName = noSpawn ? 'Bootstrap (No Spawn)' : 'Phase 1 (Pioneers)';
            }
        } else if (level === 3) {
            b = sites > 0 ? (sites > 5 ? 3 : 2) : 0; // JIT: 0 Builder wenn nichts zu bauen ist!
            u = sites > 0 ? 1 : 3; // JIT: Arbeiter werden zu Upgradern umgeschichtet
            r = 1; h = 2; // Erhöht für besseren Durchsatz
            s = drops > 1 ? 1 : 0; // JIT: Scavenger nur bei tatsächlichem Müll
            phaseName = 'Phase 2 (Basic Infra)';
        } else {
            b = sites > 0 ? (sites > 5 ? 3 : 2) : 0; 
            u = sites > 0 ? 1 : 2; // Reduce upgrade pressure to favor economy
            r = 1; h = 1; // Base of 1 hauler, let self-healing scale up
            s = drops > 1 ? 1 : 0; 
            phaseName = 'Phase 3 (Empire)';
        }

        // --- SELF-HEALING LOGISTICS (Auto-Scaling from cached inventory) ---
        // This logic now reads from the throttled inventory scanner to prevent CPU spikes.
        if (invData) {
            if (invData.overflowingContainers > 0) h += invData.overflowingContainers;
            if (invData.droppedEnergy > 3) s += 1;
        }

        // Raumspezifische Overrides (z.B. enge Steinbrüche) aus config.rooms.js
        if (config && config.maxBuilders !== undefined) {
            b = Math.min(b, config.maxBuilders);
        }
        if (config && config.maxHaulers !== undefined) {
            h = Math.min(h, config.maxHaulers);
        }
        return { name: phaseName, builder: b, upgrader: u, repairer: r, hauler: h, scav: s };
    }

    const homeInv = Memory.inventory && Memory.inventory.rooms ? Memory.inventory.rooms[rooms.HOME] : null;
    const homeRCL = homeRoom && homeRoom.controller ? homeRoom.controller.level : 1;
    const homePhase = getPhaseQuotas(homeRCL, homeInv, activeRegistry[rooms.HOME], rooms.HOME);
    let HOME_BUILDER_QUOTA = homePhase.builder;
    let HOME_UPGRADER_QUOTA = homePhase.upgrader;
    let HOME_REPAIRER_QUOTA = homePhase.repairer;
    roles.COUNTS.hauler = homePhase.hauler; // Global fallback basis
    roles.COUNTS.scavenger = homePhase.scav;

    // --- GCL AWARENESS ---
    const ownedRooms = Object.values(Game.rooms).filter(r => r.controller && r.controller.my).length;
    const canClaimMore = ownedRooms < Game.gcl.level;

    // Wenn der Target-Raum uns gehört, berechnet er ab sofort seine eigenen autonomen Phasen!
    const targetInv = Memory.inventory && Memory.inventory.rooms ? Memory.inventory.rooms[rooms.TARGET] : null;
    let targetPhase = { builder: 0, upgrader: 0, repairer: 0, hauler: 0 };
    let TARGET_CLAIMER_QUOTA = 0;
    let TARGET_REMOTE_MINER_QUOTA = 0;
    let TARGET_REMOTE_HAULER_QUOTA = 0;

    if (targetInv && targetInv.my) {
        targetPhase = getPhaseQuotas(targetInv.rcl, targetInv, activeRegistry[rooms.TARGET], rooms.TARGET);
    } else if (homeRCL >= 3) {
        TARGET_CLAIMER_QUOTA = 1; // Claim oder Reserve
        if (canClaimMore) {
            targetPhase = targetInv ? getPhaseQuotas(0, targetInv, activeRegistry[rooms.TARGET], rooms.TARGET) : { builder: 1, upgrader: 0, repairer: 0, hauler: 0 }; 
        } else {
            TARGET_REMOTE_MINER_QUOTA = targetInv ? targetInv.sources * 2 : 2; // GCL-MAX FALLBACK: Nutze Target temporär als Remote Mine!
            TARGET_REMOTE_HAULER_QUOTA = targetInv ? targetInv.sources : 1;
        }
    }
    let TARGET_BUILDER_QUOTA = targetPhase.builder;
    let TARGET_UPGRADER_QUOTA = targetPhase.upgrader;
    let TARGET_REPAIRER_QUOTA = targetPhase.repairer;
    let TARGET_HAULER_QUOTA = targetPhase.hauler;

    let MINING_BUILDER_QUOTA = 0;
    let MINING_UPGRADER_QUOTA = 0;
    let MINING_HAULER_QUOTA = 0;
    let MINING_REMOTE_MINER_QUOTA = 0;
    let MINING_CLAIMER_QUOTA = 0;
    let EXPANSION_MINER_QUOTA = 0;
    let EXPANSION_HAULER_QUOTA = 0;

    // --- EXPANSION AS BASE (W8N8) ---
    // FIX: Wenn W8N8 geclaimt ist, wird es IMMER als Basis versorgt, auch wenn der Spawn noch fehlt!
    const expansionInv = Memory.inventory && Memory.inventory.rooms ? Memory.inventory.rooms[rooms.EXPANSION] : null;
    let expansionPhase = { builder: 0, upgrader: 0, repairer: 0, hauler: 0 };
    if (expansionInv && expansionInv.my) {
        expansionPhase = getPhaseQuotas(expansionInv.rcl, expansionInv, activeRegistry[rooms.EXPANSION], rooms.EXPANSION);
    }
    let EXPANSION_BUILDER_QUOTA = expansionPhase.builder;
    let EXPANSION_UPGRADER_QUOTA = expansionPhase.upgrader;
    let EXPANSION_REPAIRER_QUOTA = expansionPhase.repairer;
    if (expansionPhase.hauler > 0) EXPANSION_HAULER_QUOTA = expansionPhase.hauler;

    if (homeRCL >= 4) {
        MINING_BUILDER_QUOTA = 2;
        MINING_UPGRADER_QUOTA = 1;
        MINING_HAULER_QUOTA = 1;
        MINING_REMOTE_MINER_QUOTA = 2;
        MINING_CLAIMER_QUOTA = 1;
    }

    // --- DEFENSE STATUS (Dynamic Empire-Wide) ---
    if (!Memory.defense) Memory.defense = {};
    
    const ALLIES = rooms.ALLIES || []; // Whitelist for passing players

    function getHostileCount(room) {
        if (!room) return 0;
        const creeps = room.find(FIND_HOSTILE_CREEPS, {
            filter: c =>
                !ALLIES.includes(c.owner.username) &&
                (c.getActiveBodyparts(ATTACK) > 0 ||
                c.getActiveBodyparts(RANGED_ATTACK) > 0 ||
                c.getActiveBodyparts(HEAL) > 0)
        }).length;
        const cores = room.find(FIND_HOSTILE_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_INVADER_CORE
        }).length;
        return creeps + cores;
    }

    const roomThreats = {};
    let hasLiveThreat = false;
    let urgentRoom = rooms.HOME;
    let urgentThreat = 0;

    Object.keys(activeRegistry).forEach(roomName => {
        const threat = getHostileCount(Game.rooms[roomName]);
        roomThreats[roomName] = threat;
        
        if (threat > 0) hasLiveThreat = true;
        if (threat > urgentThreat) {
            urgentThreat = threat;
            urgentRoom = roomName;
        }
    });

    if (hasLiveThreat) {
        Memory.defense.activeUntil = Game.time + DEFENSE_COOLDOWN_TICKS;
        Memory.defense.targetRoom = urgentRoom;
        Memory.defense.need = Math.min(3, Math.max(1, urgentThreat)); // Skaliert bis max 3 Defender
        Memory.defense.healerNeed = urgentThreat >= 2 ? 1 : 0; // 1 Healer-Support ab 2+ Feinden
    }

    const defenseActive = Memory.defense.activeUntil && Game.time <= Memory.defense.activeUntil;
    const defenseTargetRoom = defenseActive ? (Memory.defense.targetRoom || rooms.TARGET) : null;
    const defenseNeed = defenseActive ? (Memory.defense.need || 1) : 0;
    const defenseHealerNeed = defenseActive ? (Memory.defense.healerNeed || 0) : 0;

    // --- PASS 1: CENSUS & SOURCE TRACKING ---
    const sourceAssignments = {};
    [homeRoom, Game.rooms[rooms.TARGET], Game.rooms[rooms.EXPANSION]].forEach(room => {
        if (room) room.find(FIND_SOURCES).forEach(s => sourceAssignments[s.id] = 0);
    });

    for (let name in Game.creeps) {
        const creep = Game.creeps[name];
        census[creep.memory.role]++;
        if (creep.memory.role === 'harvester' && creep.memory.targetSourceId) {
            sourceAssignments[creep.memory.targetSourceId] = (sourceAssignments[creep.memory.targetSourceId] || 0) + 1;
        }
        
        if (creep.hits < (creep.memory.lastHits || creep.hitsMax)) logger.log(`⚠️ ATTACK: ${creep.name} in ${creep.room.name}!`, 'error');
        creep.memory.lastHits = creep.hits;

        // --- VISUALS: Creep Role / Function Labels ---
        if (creep.room) {
            creep.room.visual.text(creep.memory.role, creep.pos.x, creep.pos.y + 0.4, { font: 0.3, color: '#a2b9d1', opacity: 0.8 });
        }

        // --- AUTO-RECYCLE OBSOLETE DEFENSE ---
        if (creep.memory.role === 'defender' || creep.memory.role === 'healer') {
            if (!defenseActive) {
                creep.memory.recycle = true;
            } else if (creep.memory.recycle) {
                creep.memory.recycle = false; // Alarm ist zurück! Abmarsch abbrechen.
            }
        }

        // --- UNIVERSAL RECYCLE COMMAND ---
        if (creep.memory.recycle) {
            creep.say('Recycle');

            // --- DUMP RESOURCES BEFORE RECYCLING ---
            if (creep.store.getUsedCapacity() > 0) {
                const resType = Object.keys(creep.store)[0]; // Energie oder Mineralien
                let sink = creep.room.storage;
                if (!sink || sink.store.getFreeCapacity(resType) === 0) {
                    sink = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                        filter: s => (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_CONTAINER) &&
                                     s.store && s.store.getFreeCapacity(resType) > 0
                    });
                }
                if (sink) {
                    if (creep.transfer(sink, resType) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(sink, { visualizePathStyle: { stroke: '#00ffcc' } });
                    }
                    continue; 
                }
            }

            let spawn = creep.pos.findClosestByRange(FIND_MY_SPAWNS) || Object.values(Game.spawns)[0];
            if (spawn) {
                if (creep.room.name !== spawn.room.name) {
                    creep.moveTo(new RoomPosition(25, 25, spawn.room.name), { visualizePathStyle: { stroke: '#ff00ff' }, reusePath: 50 });
                } else if (spawn.recycleCreep(creep) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ff00ff' } });
                }
            }
            continue; 
        }

        // --- UNIVERSAL MEMORY PURGE & ORPHAN MIGRATION ---
        let memoryPatched = false;
        for (let key in creep.memory) {
            if (['E57S55', 'E57S56', 'E58S55', 'E58S56', 'W8N8'].includes(creep.memory[key])) { // Clean up old hardcodes
                if (!activeRegistry[creep.memory[key]]) {
                    creep.memory[key] = Memory.empire && Memory.empire.targetRoom ? Memory.empire.targetRoom : rooms.HOME;
                    memoryPatched = true;
                }
            }
        }
        
        // --- LEGACY CREEP MIGRATION ---
        // Erzeugt die fehlenden Keys für alte Creeps, damit sie nicht von der strikten Quote ignoriert werden.
        if (!creep.memory.targetRoom && !creep.memory.workRoom) {
            if (['hauler', 'builder', 'repairer', 'scavenger', 'mineralMiner'].includes(creep.memory.role)) {
                creep.memory.workRoom = creep.memory.homeRoom || rooms.HOME;
            }
            if (['harvester', 'upgrader', 'claimer', 'remoteMiner'].includes(creep.memory.role)) {
                creep.memory.targetRoom = rooms.HOME;
            }
        }
        if (memoryPatched) delete creep.memory._move;

        // QUARANTINE ZONE & SAFE CORRIDOR LOGIC
        // The pathfinder naturally tries to shortcut through E57S55. We must actively forbid it.
        if (creep.room.name === 'E57S55') {
            creep.say('EVAC');
            const evacExit = creep.pos.findClosestByRange(creep.room.findExitTo(rooms.MINING));
            if (evacExit) creep.moveTo(evacExit, { visualizePathStyle: { stroke: '#ff0000' } });
            continue; 
        }

        if (Game.cpu.getUsed() > Game.cpu.tickLimit * 0.8) {
            creep.say('CPU');
            continue; 
        }

        if (modules[creep.memory.role]) {
            try { modules[creep.memory.role].run(creep); } catch (e) { }
        }
    }

    // --- PASS 3: INFRASTRUCTURE (TOWERS) ---
    Object.keys(activeRegistry).forEach(roomName => {
        const room = Game.rooms[roomName];
        if (room) {
            const towers = room.find(FIND_MY_STRUCTURES, {filter: {structureType: STRUCTURE_TOWER}});
            towers.forEach(t => {
                try { towerLogic.run(t); } catch (e) { logger.log('Tower Error: ' + e, 'error'); }
            });
            try { linkLogic.run(room); } catch (e) { logger.log('Link Error: ' + e, 'error'); }
            try { labLogic.run(room); } catch (e) { logger.log('Lab Error: ' + e, 'error'); }
        }
    });

    // --- PASS 4: SPAWNING (MULTI-SPAWN INFINITE BASES) ---
    var queuePreview = [];
    const spawnActions = [];
    const plannedSpawns = [];
    const targetRoom = rooms.TARGET;
    const expansionRoom = rooms.EXPANSION;
    const armyOn = rooms.WAR_MODE === true;

    function getPreSpawnTime(creep) {
        const spawnTime = creep.body.length * 3;
        const targetR = creep.memory.targetRoom || creep.memory.workRoom || creep.room.name;
        const homeR = creep.memory.homeRoom || creep.memory.home || creep.room.name;
        const roomDist = Game.map.getRoomLinearDistance(homeR, targetR);
        const travelTime = (roomDist === 0) ? 20 : (roomDist * 50); // 20 Ticks im eigenen Raum, 50 pro Raumwechsel
        return spawnTime + travelTime + 10; // +10 Ticks Sicherheitspuffer
    }

    function countAssigned(role, roomName, memoryKey) {
        const live = _.filter(Game.creeps, c =>
            c.memory.role === role &&
            !c.memory.recycle &&
            (c.spawning || c.ticksToLive > getPreSpawnTime(c)) && 
            c.memory[memoryKey] === roomName // STRIKTE TRENNUNG: Kein Raten mehr, um Culling-Bugs zu verhindern!
        ).length;
        const planned = _.filter(plannedSpawns, m =>
            m.role === role && m[memoryKey] === roomName
        ).length;
        return live + planned;
    }

    function countRole(role) {
        const live = _.filter(Game.creeps, c => c.memory.role === role && !c.memory.recycle && (c.spawning || c.ticksToLive > getPreSpawnTime(c))).length;
        return live + _.filter(plannedSpawns, m => m.role === role).length;
    }

    function cullSurplus(role, roomName, memoryKey, maxAllowed) {
        const creeps = _.filter(Game.creeps, c => 
            c.memory.role === role && 
            !c.memory.recycle &&
            c.memory[memoryKey] === roomName // STRIKTE TRENNUNG: Schützt Remote-Hauler vor dem lokalen Schredder!
        );
        
        const liveActive = _.filter(creeps, c => !c.spawning);
        if (liveActive.length > maxAllowed) {
            const sorted = _.sortBy(liveActive, 'ticksToLive');
            const excess = liveActive.length - maxAllowed;
            for (let i = 0; i < excess; i++) {
                // Deaktiviert: Keine sofortigen Hinrichtungen mehr! 
                // Überschüssige Einheiten arbeiten weiter, bis sie natürlich auslaufen.
                // sorted[i].memory.recycle = true; 
            }
        }
    }

    function bodyCost(body) {
        return _.sum(body, part => BODYPART_COST[part] || 0);
    }

    const fallbackBodies = {
        defender: [TOUGH, MOVE, ATTACK, MOVE],
        claimer: [CLAIM, MOVE],
        healer: [MOVE, HEAL],
        scout: [MOVE],
        vanguard: [TOUGH, MOVE, RANGED_ATTACK],
        medic: [MOVE, HEAL],
        breacher: [WORK, MOVE]
    };

    function getOptimalBody(role, energy) {
        const full = roles.BODIES[role];
        if (full && bodyCost(full) <= energy) return full;

        let body = [];
        let cost = 0;

        // Harvesters, Remote Miners, Mineral Miners: Prioritize WORK, then CARRY/MOVE
        if (role === 'harvester' || role === 'remoteMiner' || role === 'mineralMiner') {
            // BUGFIX: Ein Creep MUSS zwingend [WORK, CARRY, MOVE] haben, sonst ist er bewegungsunfähig (keine Beine)!
            // Selbst im absoluten Notstand muss der Spawn auf 200 Energie warten (die er automatisch generiert).
            if (energy < 200) return null; 
            body.push(WORK, CARRY, MOVE); cost += 200;
            
            while (cost + 200 <= energy && body.length < 15) { // Add more WORK, CARRY, MOVE
                body.push(WORK); cost += 100;
                if (cost + 50 <= energy) { body.push(CARRY); cost += 50; }
                if (cost + 50 <= energy) { body.push(MOVE); cost += 50; }
            }
            return body;
        }

        // Builders, Upgraders, Repairers: Prioritize WORK, then CARRY/MOVE
        if (role === 'builder' || role === 'upgrader' || role === 'repairer') {
            if (energy < 200) return null; // MUST afford [WORK, CARRY, MOVE]
            body.push(WORK, CARRY, MOVE); cost += 200;

            while (cost + 200 <= energy && body.length < 18) { // Add more WORK, CARRY, MOVE
                body.push(WORK); cost += 100;
                if (cost + 50 <= energy) { body.push(CARRY); cost += 50; }
                if (cost + 50 <= energy) { body.push(MOVE); cost += 50; }
            }
            return body;
        }

        // Haulers, Scavengers, Chemists, Remote Haulers: Prioritize CARRY, then MOVE
        if (role === 'hauler' || role === 'scavenger' || role === 'chemist' || role === 'remoteHauler') {
            if (energy < 100) return null; // MUST afford [CARRY, MOVE]
            body.push(CARRY, MOVE); cost += 100;
            
            while (cost + 100 <= energy && body.length < 21) { // Add more CARRY, MOVE
                body.push(CARRY); cost += 50;
                if (cost + 50 <= energy) { body.push(MOVE); cost += 50; }
            }
            return body;
        }

        const fallback = fallbackBodies[role];
        if (fallback && bodyCost(fallback) <= energy) return fallback;
        
        return null;
    }

    function resolveSpawnBody(spawn, role, targetRoomName) {
        const r = Game.rooms[targetRoomName] || spawn.room;
        const maxCap = spawn.room.energyCapacityAvailable;
        const currentEnergy = spawn.room.energyAvailable;
        
        const full = roles.BODIES[role];
        const fullCost = full ? bodyCost(full) : Infinity;

        if (fullCost > 0 && fullCost <= currentEnergy) return full;

        let memoryKey = 'targetRoom';
        if (['builder', 'hauler', 'scavenger', 'repairer', 'chemist', 'mineralMiner'].includes(role)) memoryKey = 'workRoom';
        
        const currentCount = countAssigned(role, targetRoomName, memoryKey);
        
        // Notstand: Verhindert das Verhungern der Kolonie
        const isEmergency = (role === 'harvester' && currentCount < 2) || (role === 'hauler' && currentCount === 0);

        // Death-Spiral-Fix: Warten auf volle Energie, außer es herrscht absoluter Notstand!
        if (currentEnergy < maxCap && currentEnergy < fullCost && !isEmergency) {
            return null; 
        }

        return getOptimalBody(role, currentEnergy);
    }

    // DYNAMISCHE LISTEN AUS DEM INVENTAR LESEN (Spart CPU!)
    const ownedRoomNames = Memory.inventory && Memory.inventory.rooms ? Object.keys(Memory.inventory.rooms).filter(rn => Memory.inventory.rooms[rn].my) : [];
    const dynamicMinerQueue = [];
    ownedRoomNames.forEach(rn => {
        const inv = Memory.inventory.rooms[rn];
        const config = activeRegistry[rn];
        // Fact-Based Scaling: 1 großer Miner (5 WORK = 10e/t) reicht für lückenlosen Abbau bei RCL 4+
        let multiplier = (inv.rcl >= 4) ? 1 : 2; 

        let requiredMiners = inv.sources * multiplier;
        if (config && config.harvesters !== undefined) requiredMiners = config.harvesters; // Hard-Override

        const currentMiners = countAssigned('harvester', rn, 'targetRoom');
        dynamicMinerQueue.push({ room: rn, current: currentMiners, required: requiredMiners });
    });

    const dynamicMineralQueue = [];
    ownedRoomNames.forEach(rn => {
        const inv = Memory.inventory.rooms[rn];
        if (inv.rcl >= 6 && inv.extractors > 0 && inv.mineralAmount > 0) {
            const currentMiners = countAssigned('mineralMiner', rn, 'workRoom');
            dynamicMineralQueue.push({ room: rn, current: currentMiners, required: 1 });
        }
    });

    const dynamicChemistQueue = [];
    ownedRoomNames.forEach(rn => {
        const inv = Memory.inventory.rooms[rn];
        if (inv.rcl >= 6 && inv.labs >= 3) {
            const currentChemists = countAssigned('chemist', rn, 'workRoom');
            dynamicChemistQueue.push({ room: rn, current: currentChemists, required: 1 });
        }
    });

    // --- INFINITE-BASE SPAWN QUEUE GENERATION ---
    let requestQueue = [];

    Object.keys(activeRegistry).forEach(rn => {
        const config = activeRegistry[rn];
        const inv = Memory.inventory && Memory.inventory.rooms ? Memory.inventory.rooms[rn] : null;
        const rcl = inv ? inv.rcl : 0;
        const isHome = rn === rooms.HOME;
        const pBoost = isHome ? 0 : 1; // Core Base wird bei Gleichstand leicht bevorzugt (-1 zur Prio)
        
        if (config.type === 'CORE') {
            const phase = getPhaseQuotas(rcl, inv, config, rn);
            
            const dynM = dynamicMinerQueue.find(q => q.room === rn);
            if (dynM) {
                if (dynM.current < Math.min(3, dynM.required)) {
                    requestQueue.push({ role: 'harvester', memory: { targetRoom: rn }, priority: 10 + pBoost, count: dynM.current, max: Math.min(3, dynM.required) });
                } else if (dynM.current < dynM.required) {
                    requestQueue.push({ role: 'harvester', memory: { targetRoom: rn }, priority: 30 + pBoost, count: dynM.current, max: dynM.required });
                }
            }

            const bCount = countAssigned('builder', rn, 'workRoom');
            let bPriority = 40 + pBoost; 
            if (phase.builder > 0 && inv && inv.spawns === 0) bPriority = 15 + pBoost; // Bootstrap Pioneer!
            if (bCount < phase.builder) requestQueue.push({ role: 'builder', memory: { workRoom: rn }, priority: bPriority, count: bCount, max: phase.builder });

            const uCount = countAssigned('upgrader', rn, 'targetRoom');
            if (uCount < phase.upgrader) requestQueue.push({ role: 'upgrader', memory: { targetRoom: rn }, priority: 50 + pBoost, count: uCount, max: phase.upgrader });

            const hCount = countAssigned('hauler', rn, 'workRoom');
            if (hCount < phase.hauler) requestQueue.push({ role: 'hauler', memory: { workRoom: rn }, priority: 25 + pBoost, count: hCount, max: phase.hauler });

            const sCount = countAssigned('scavenger', rn, 'workRoom');
            if (sCount < phase.scav) requestQueue.push({ role: 'scavenger', memory: { workRoom: rn }, priority: 65 + pBoost, count: sCount, max: phase.scav });

            const rCount = countAssigned('repairer', rn, 'workRoom');
            if (rCount < phase.repairer) requestQueue.push({ role: 'repairer', memory: { workRoom: rn }, priority: 70 + pBoost, count: rCount, max: phase.repairer });

            const dynMin = dynamicMineralQueue.find(q => q.room === rn);
            if (dynMin && dynMin.current < dynMin.required) requestQueue.push({ role: 'mineralMiner', memory: { workRoom: rn }, priority: 80 + pBoost, count: dynMin.current, max: dynMin.required });

            const dynChem = dynamicChemistQueue.find(q => q.room === rn);
            if (dynChem && dynChem.current < dynChem.required) requestQueue.push({ role: 'chemist', memory: { workRoom: rn }, priority: 85 + pBoost, count: dynChem.current, max: dynChem.required });

        } else if (config.type === 'REMOTE') {
            const baseRoom = config.base || Object.keys(rooms.registry).find(r => rooms.registry[r].type === 'CORE');
            // Spezifische Einstellungen aus der config.rooms.js nutzen (z.B. minersPerSource)
            const mMult = config.minersPerSource || 2; // Optimaler Fallback für Remotes
            const srcCount = inv ? inv.sources : (config.knownSources || 1);
            const rMinersAllowed = srcCount * mMult;
            
            // --- SELF-HEALING REMOTE LOGISTICS ---
            // Beginne mit 1 Hauler pro Quelle. Füge nur dann mehr hinzu, wenn die Container überlaufen.
            // Das verhindert das Herumstehen von überflüssigen Haulern und spart massiv Energie.
            let rHaulersAllowed = srcCount;
            const remoteInv = Memory.inventory && Memory.inventory.rooms ? Memory.inventory.rooms[rn] : null;
            if (remoteInv && remoteInv.visible) {
                const overflowingContainers = remoteInv.overflowingContainers || 0;
                if (overflowingContainers > 0) rHaulersAllowed += overflowingContainers; // Add 1 hauler per overflowing container
            }

            const needsClaim = !inv || (!inv.my && !inv.reservation);
            if (needsClaim) {
                const clmCount = countAssigned('claimer', rn, 'targetRoom');
                // BUGFIX: Remote rooms are outposts. They should ONLY ever be reserved, never claimed!
                if (clmCount < 1) requestQueue.push({ role: 'claimer', memory: { targetRoom: rn, claimMode: 'reserve' }, priority: 45 + pBoost, count: clmCount, max: 1 });
            }

            // Downgrade-Schutz: Wenn wir die Mine geclaimt haben, brauchen wir 1 Upgrader, sonst verfällt sie!
            if (inv && inv.my) {
                const upgCount = countAssigned('upgrader', rn, 'targetRoom');
                if (upgCount < 1) requestQueue.push({ role: 'upgrader', memory: { targetRoom: rn, homeRoom: baseRoom }, priority: 55 + pBoost, count: upgCount, max: 1 });
            }

            const rmCount = countAssigned('remoteMiner', rn, 'targetRoom');
            if (rmCount < rMinersAllowed) requestQueue.push({ role: 'remoteMiner', memory: { targetRoom: rn, homeRoom: baseRoom }, priority: 47 + pBoost, count: rmCount, max: rMinersAllowed });

            const rhCount = countAssigned('remoteHauler', rn, 'targetRoom');
            if (rhCount < rHaulersAllowed) requestQueue.push({ role: 'remoteHauler', memory: { targetRoom: rn, homeRoom: baseRoom }, priority: 48 + pBoost, count: rhCount, max: rHaulersAllowed });
        }
    });

    // Global Fallbacks (Defense, Army, Scouts)
    if (defenseActive) {
        const dCount = countAssigned('defender', defenseTargetRoom, 'targetRoom');
        if (dCount < defenseNeed) requestQueue.push({ role: 'defender', memory: { targetRoom: defenseTargetRoom, homeRoom: Object.keys(rooms.registry).find(r => rooms.registry[r].type === 'CORE') }, priority: 20, count: dCount, max: defenseNeed });
        
        const healCount = countAssigned('healer', defenseTargetRoom, 'targetRoom');
        if (healCount < defenseHealerNeed) requestQueue.push({ role: 'healer', memory: { targetRoom: defenseTargetRoom, homeRoom: Object.keys(rooms.registry).find(r => rooms.registry[r].type === 'CORE') }, priority: 21, count: healCount, max: defenseHealerNeed });
    }

    if (armyOn) {
        const vCount = countRole('vanguard');
        if (vCount < roles.COUNTS.vanguard) requestQueue.push({ role: 'vanguard', memory: {}, priority: 90, count: vCount, max: roles.COUNTS.vanguard });
        const mCount = countRole('medic');
        if (mCount < roles.COUNTS.medic) requestQueue.push({ role: 'medic', memory: {}, priority: 91, count: mCount, max: roles.COUNTS.medic });
    }
    
    const scCount = countRole('scout');
    if (scCount < roles.COUNTS.scout) requestQueue.push({ role: 'scout', memory: {}, priority: 100, count: scCount, max: roles.COUNTS.scout });

    // 1) Sortiere die Queue streng nach Priorität (Niedrige Zahl = Hohe Priorität)
    requestQueue.sort((a, b) => a.priority - b.priority);

    // 2) Erzeuge die visuelle Queue für den HUD (aus der neuen Liste)
    queuePreview = requestQueue.map(req => {
        let label = req.role;
        if (req.memory.targetRoom) label += `@${req.memory.targetRoom}`;
        else if (req.memory.workRoom) label += `@${req.memory.workRoom}`;
        return `${label}:${req.count}/${req.max}`;
    });

    const idleSpawns = allSpawns.filter(s => !s.spawning);
    if (idleSpawns.length === 0 && allSpawns.length > 0) queuePreview.unshift('spawn busy');

    // --- FAILSAFE: GLOBAL POPULATION CAP ---
    const HARD_POP_CAP = 60;
    if (Object.keys(Game.creeps).length >= HARD_POP_CAP) {
        queuePreview = [`POP CAP (${HARD_POP_CAP})`];
        idleSpawns.length = 0; // Force-abort all spawn logic this tick
        if (Game.time % 20 === 0) logger.log(`🛑 Global Population Cap (${HARD_POP_CAP}) reached! Spawning halted to prevent Quota Leaks.`, 'error');
    }

    let deadlocks = [];
    for (const spawn of idleSpawns) {
        for (let i = 0; i < requestQueue.length; i++) {
            const req = requestQueue[i];
            
            if (req.count >= req.max) continue; // Wurde evt. schon von einem anderen Spawn im selben Tick bedient!

            // LOCALIZED SPAWNING (Entfernungs-Blindheit fixen)
            // Ein Spawn bedient bevorzugt den eigenen Raum oder Remote-Räume, die zu ihm gehören.
            const reqRoom = req.memory.targetRoom || req.memory.workRoom;
            let isMyOwnRoom = true;
            let isMutualAid = false;

            if (reqRoom) {
                const reqInv = Memory.inventory && Memory.inventory.rooms ? Memory.inventory.rooms[reqRoom] : null;
                const needsBootstrap = reqInv && reqInv.spawns === 0;
                const isMyRemote = activeRegistry[reqRoom] && activeRegistry[reqRoom].base === spawn.room.name;
                isMyOwnRoom = reqRoom === spawn.room.name;

                // --- SCOS MUTUAL AID PROTOCOL (Imperiale Nothilfe) ---
                // 1. Verteidigung: Defender und Healer dürfen zur Rettung vom gesamten Imperium gebaut werden!
                if (req.role === 'defender' || req.role === 'healer') {
                    isMutualAid = true;
                }
                // 2. Wirtschaftskollaps: Wenn eine CORE-Basis tot ist (0 Miner oder 0 Hauler),
                // darf jede andere Basis sofort Erste-Hilfe-Creeps schicken, um sie wiederzubeleben!
                if (activeRegistry[reqRoom] && activeRegistry[reqRoom].type === 'CORE' && !isMyOwnRoom) {
                    const hrvCount = countAssigned('harvester', reqRoom, 'targetRoom');
                    const haulCount = countAssigned('hauler', reqRoom, 'workRoom');
                    if (hrvCount === 0 || haulCount === 0) isMutualAid = true;
                }

                // Darf nur spawnen, wenn es mein Raum/Remote ist, gebootstrapped wird ODER Nothilfe greift.
                if (!needsBootstrap && !isMyRemote && !isMyOwnRoom && !isMutualAid) {
                    continue; 
                }
            }

            const sRole = req.role;
            const name = roles.generateName(sRole);
            const spawnMemory = Object.assign({ role: sRole }, req.memory);

            // Defenders und Healers ziehen sich zur Heilung in den Raum zurück, der sie gebaut hat!
            if (sRole === 'defender' || sRole === 'healer') {
                spawnMemory.homeRoom = spawn.room.name;
            }

            const body = resolveSpawnBody(spawn, sRole, reqRoom);
            if (!body) break; // STRIKTE PRIORITÄT: Wenn der wichtigste Creep wartet, dürfen unwichtige Creeps ihm die Energie nicht wegkaufen!

            const spawnRes = spawn.spawnCreep(body, name, { memory: spawnMemory });
            if (spawnRes === OK) {
                plannedSpawns.push(spawnMemory);
                req.count++; // Lokalen Counter hochzählen, damit der nächste Spawn nicht nochmal das Gleiche baut!
                
                if (spawnMemory.role === 'harvester') {
                    const qEntry = dynamicMinerQueue.find(q => q.room === spawnMemory.targetRoom);
                    if (qEntry) qEntry.current++;
                }

                spawnActions.push(`${spawn.name}:${sRole}[${body.length}]->${spawnMemory.targetRoom || spawnMemory.workRoom || spawn.room.name}`);
                const logMsg = (!isMyOwnRoom && isMutualAid) ? `🚑 MUTUAL AID: ${spawn.name} spawning ${sRole} to rescue ${reqRoom}!` : `🐣 ${spawn.name} spawning: ${name}`;
                logger.log(logMsg, 'success');
                break; // Erfolgreich gespawnt! Weiter zum nächsten freien Spawn.
            } else {
                if (spawnRes === ERR_NOT_ENOUGH_ENERGY && isEmergency) {
                    deadlocks.push(spawn.room.name); // Raum verhungert und kann Retter nicht bezahlen!
                }
                logger.log(`${spawn.name} blocked: role=${sRole} code=${spawnRes}`, 'warn');
                break; // Auch bei Fehler abbrechen, um Energie-Diebstahl zu verhindern!
            }
        }
    }

    const recyclingCount = _.filter(Game.creeps, c => c.memory.recycle).length;

    const spawnsByRoom = {};
    allSpawns.forEach(s => {
        if (!spawnsByRoom[s.room.name]) spawnsByRoom[s.room.name] = [];
        if (s.spawning) {
            const spawningCreep = Game.creeps[s.spawning.name];
            const role = spawningCreep ? spawningCreep.memory.role : 'unknown';
            spawnsByRoom[s.room.name].push(`${role}(${s.spawning.remainingTime}t)`);
        } else {
            spawnsByRoom[s.room.name].push('IDLE');
        }
    });

    function getRoomTTL(roomName) {
        const creeps = _.filter(Game.creeps, c => 
            !c.spawning && 
            (c.room.name === roomName || c.memory.workRoom === roomName || c.memory.targetRoom === roomName)
        );
        if (!creeps.length) return 'N/A';
        const ttls = creeps.map(c => c.ticksToLive).filter(t => t !== undefined);
        if (!ttls.length) return 'N/A';
        const avg = Math.round(_.sum(ttls) / ttls.length);
        const min = _.min(ttls);
        return `min ${min}, avg ${avg}`;
    }

    const fQ = (role, have, need) => {
        if (need === 0 && have === 0) return '';
        return `${role}:${have}/${need}`;
    };

    const roomReports = [];
    
    Object.keys(activeRegistry).forEach(rn => {
        const config = activeRegistry[rn];
        const inv = Memory.inventory.rooms[rn];
        const rcl = inv ? inv.rcl : 0;
        
        if (config.type === 'CORE') {
            const phase = getPhaseQuotas(rcl, inv, config);
            const dynM = dynamicMinerQueue.find(q => q.room === rn);
            const dynMin = dynamicMineralQueue.find(q => q.room === rn);
            const dynChem = dynamicChemistQueue.find(q => q.room === rn);

            // --- SURPLUS CULLING (Active Quota Enforcement) ---
            if (dynM) cullSurplus('harvester', rn, 'targetRoom', dynM.required);
            cullSurplus('mineralMiner', rn, 'workRoom', dynMin ? dynMin.required : 0);
            cullSurplus('chemist', rn, 'workRoom', dynChem ? dynChem.required : 0);

            if (!inv || !inv.my) {
                cullSurplus('claimer', rn, 'targetRoom', 1);
                if (!canClaimMore && inv) {
                    cullSurplus('remoteMiner', rn, 'targetRoom', inv.sources * 2);
                    cullSurplus('hauler', rn, 'targetRoom', inv.sources);
                } else {
                    cullSurplus('remoteMiner', rn, 'targetRoom', 0);
                    cullSurplus('hauler', rn, 'targetRoom', 0);
                }
            } else {
                cullSurplus('claimer', rn, 'targetRoom', 0);
                cullSurplus('remoteMiner', rn, 'targetRoom', 0);
                cullSurplus('hauler', rn, 'targetRoom', 0);
            }

            const b = countAssigned('builder', rn, 'workRoom');
            const u = countAssigned('upgrader', rn, 'targetRoom');
            const r = countAssigned('repairer', rn, 'workRoom');
            const h = countAssigned('hauler', rn, 'workRoom');
            const s = countAssigned('scavenger', rn, 'workRoom');
            
            let rolesStr = [];
            if (dynM) rolesStr.push(fQ('HV', dynM.current, dynM.required));
            if (dynChem) rolesStr.push(fQ('CHM', dynChem.current, dynChem.required));
            
            if (!inv || !inv.my) {
                rolesStr.push(fQ('CLM', countAssigned('claimer', rn, 'targetRoom'), 1));
                // GCL Fallback ins HUD einfügen: Wenn wir nicht claimen können, zeigen wir die Remote-Miner an!
                if (!canClaimMore && inv) {
                    rolesStr.push(fQ('RMIN', countAssigned('remoteMiner', rn, 'targetRoom'), inv.sources * 2));
                    rolesStr.push(fQ('RHAUL', countAssigned('hauler', rn, 'targetRoom'), inv.sources));
                }
            }
            
            rolesStr.push(fQ('BLD', b, phase.builder));
            rolesStr.push(fQ('UPG', u, phase.upgrader));
            rolesStr.push(fQ('REP', r, phase.repairer));
            rolesStr.push(fQ('HAUL', h, phase.hauler));
            rolesStr.push(fQ('SCAV', s, phase.scav));
            
            roomReports.push({
                name: rn, label: 'CORE',
                nrg: Game.rooms[rn] ? Game.rooms[rn].energyAvailable : 0,
                cap: Game.rooms[rn] ? Game.rooms[rn].energyCapacityAvailable : 0,
                rcl: rcl,
                my: inv ? inv.my : false,
                reservation: inv ? inv.reservation : null,
                phase: phase.name,
                spawns: spawnsByRoom[rn] || [],
                ttl: getRoomTTL(rn),
                roles: rolesStr.filter(Boolean).join(' ') || 'None'
            });
        } else if (config.type === 'REMOTE') {
            const baseRoom = config.base || rooms.HOME;
            const mMult = config.minersPerSource || 3;
            const srcCount = inv ? inv.sources : (config.knownSources || 1);
            const rMinersAllowed = srcCount * mMult;
            const rHaulersAllowed = srcCount * mMult;

            cullSurplus('claimer', rn, 'targetRoom', 1);
            cullSurplus('remoteMiner', rn, 'targetRoom', rMinersAllowed);
            cullSurplus('hauler', rn, 'targetRoom', rHaulersAllowed);

            const clm = countAssigned('claimer', rn, 'targetRoom');
            const rMiners = countAssigned('remoteMiner', rn, 'targetRoom');
            const rHaulers = countAssigned('hauler', rn, 'targetRoom');
            
            let remotePhase = 'Unsecured Mine';
            if (inv && inv.my) remotePhase = 'Claimed (Pending Core)';
            else if (inv && inv.reservation) remotePhase = `Secured Mine (${inv.reservation})`;

            roomReports.push({
                name: rn, label: 'REMOTE',
                nrg: Game.rooms[rn] ? Game.rooms[rn].energyAvailable : 0,
                cap: Game.rooms[rn] ? Game.rooms[rn].energyCapacityAvailable : 0,
                rcl: rcl,
                my: inv ? inv.my : false,
                reservation: inv ? inv.reservation : null,
                phase: remotePhase,
                spawns: [], ttl: getRoomTTL(rn),
                roles: [
                    fQ('CLM', clm, 1),
                    (inv && inv.my) ? fQ('UPG', countAssigned('upgrader', rn, 'targetRoom'), 1) : '',
                    fQ('RMIN', rMiners, rMinersAllowed),
                    fQ('HAUL', rHaulers, rHaulersAllowed)
                ].filter(Boolean).join(' ') || 'None'
            });
        }
    });

    logger.report({
        recycling: recyclingCount,
        cpu: Game.cpu.getUsed(),
        bucket: Game.cpu.bucket,
        credits: Game.market ? Game.market.credits : 0,
        earned: Memory.market ? Memory.market.earned : 0,
        pop: Object.keys(Game.creeps).length,
        cap: HARD_POP_CAP,
        queue: queuePreview,
        deadlocks: deadlocks,
        rooms: roomReports,
        defense: {
            active: !!defenseActive,
            room: defenseTargetRoom,
            need: defenseNeed,
            current: countAssigned('defender', defenseTargetRoom, 'targetRoom'),
            ttls: _.filter(Game.creeps, c => c.memory.role === 'defender' && c.memory.targetRoom === defenseTargetRoom).map(c => c.ticksToLive || 'spwn').join(','),
            healerNeed: defenseHealerNeed,
            currentHealers: countAssigned('healer', defenseTargetRoom, 'targetRoom'),
            homeThreat: 0,
            targetThreat: roomThreats[defenseTargetRoom] || 0,
            expansionThreat: 0
        },
    });

    // --- PASS 5: AUDIT SNAPSHOTS (Tactical + Strategic) ---
    function getBufferedEnergy(room) {
        if (!room) return 0;
        return _.sum(
            room.find(FIND_STRUCTURES, {
                filter: s =>
                    s.store &&
                    (s.structureType === STRUCTURE_STORAGE ||
                        s.structureType === STRUCTURE_CONTAINER ||
                        s.structureType === STRUCTURE_LINK)
            }),
            s => s.store[RESOURCE_ENERGY] || 0
        );
    }

    function getLowRampartCount(room, floor) {
        if (!room) return 0;
        return room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_RAMPART && s.hits < floor
        }).length;
    }

    function buildAuditSnapshot(tick) {
        const trackedRooms = [rooms.HOME, rooms.TARGET, rooms.EXPANSION];
        const roomSnapshots = trackedRooms.map(roomName => {
            const room = Game.rooms[roomName];
            const creepsInRoom = _.filter(Game.creeps, c => c.room.name === roomName);
            const rolePop = _.countBy(creepsInRoom, c => c.memory.role || 'unknown');
            return {
                name: roomName,
                visible: !!room,
                energyAvailable: room ? room.energyAvailable : 0,
                energyCapacity: room ? room.energyCapacityAvailable : 0,
                bufferedEnergy: getBufferedEnergy(room),
                hostiles: roomThreats[roomName] || 0,
                lowRamparts: getLowRampartCount(room, 50000),
                rolePopulation: rolePop
            };
        });

        return {
            tick: tick,
            totalBufferedEnergy: _.sum(roomSnapshots, r => r.bufferedEnergy || 0),
            totalHostiles: _.sum(roomSnapshots, r => r.hostiles || 0),
            spawnBusy: _.filter(allSpawns, s => s.spawning).length,
            spawnTotal: allSpawns.length,
            population: Object.keys(Game.creeps).length,
            rooms: roomSnapshots
        };
    }

    if (!Memory.audit) Memory.audit = {};
    if (!Memory.audit.tactical) Memory.audit.tactical = [];
    if (!Memory.audit.strategic) Memory.audit.strategic = [];

    if (Game.time % TACTICAL_AUDIT_INTERVAL === 0) {
        const tacticalSnapshot = buildAuditSnapshot(Game.time);
        Memory.audit.tactical.push(tacticalSnapshot);
        if (Memory.audit.tactical.length > AUDIT_RETENTION_TACTICAL) {
            Memory.audit.tactical = Memory.audit.tactical.slice(-AUDIT_RETENTION_TACTICAL);
        }
        logger.auditTactical(tacticalSnapshot);
    }

    if (Game.time % STRATEGIC_AUDIT_INTERVAL === 0) {
        const strategicSnapshot = buildAuditSnapshot(Game.time);
        Memory.audit.strategic.push(strategicSnapshot);
        if (Memory.audit.strategic.length > AUDIT_RETENTION_STRATEGIC) {
            Memory.audit.strategic = Memory.audit.strategic.slice(-AUDIT_RETENTION_STRATEGIC);
        }
        logger.auditStrategic(strategicSnapshot);
    }

    // --- PASS 6: PIXEL GENERATION (Market/CPU) ---
    if (Game.cpu.bucket === 10000 && Game.cpu.generatePixel) {
        Game.cpu.generatePixel();
        logger.log('💎 Pixel generated! (10,000 Bucket converted)', 'success');
    }

    // --- PASS 7: MARKET (Auto-Sell) ---
    market.run();

    // --- PASS 8: AUTO-EXPANSION ---
    expander.run();

    // --- PASS 9: AUTOMATED BASE PLANNING ---
    // Alle 1001 Ticks prüfen. Verhindert CPU-Spikes und Kollisionen mit anderen Events.
    if (Game.time % 1001 === 0) {
        Object.values(Game.rooms)
            .filter(r => r.controller && r.controller.my)
            .forEach(r => planner.run(r));
    }
};
