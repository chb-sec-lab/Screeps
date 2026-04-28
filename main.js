/**
 * main.js - SCOS Kernel (Modularisiert)
 * Role: Orchestrator / Main Event Loop / Audit Snapshots
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

const coreCreeps = require('core.creeps');

const Boardroom = require('Boardroom'); // MCA Architektur laden

const DEFENSE_COOLDOWN_TICKS = 200;
const TACTICAL_AUDIT_INTERVAL = 200;
const STRATEGIC_AUDIT_INTERVAL = 3600;
const AUDIT_RETENTION_TACTICAL = 120;
const AUDIT_RETENTION_STRATEGIC = 100;

// Initialisiere den Boardroom als Singleton
const myBoardroom = new Boardroom();

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
    if (Game.cpu.bucket < 50) {
        console.log(`⚠️ CRITICAL CPU BUCKET (${Game.cpu.bucket}). Skipping tick to recover.`);
        return; 
    }

    // --- AUTO-EXPANSION TARGET OVERRIDE ---
    if (Memory.empire && Memory.empire.targetRoom) {
        rooms.TARGET = Memory.empire.targetRoom;
    }

    // --- INVENTORY SCAN ---
    inventory.run();

    // --- ACTIVE REGISTRY (Topology) ---
    var activeRegistry = {}; 
    if (rooms.registry) {
        for (let rn in rooms.registry) activeRegistry[rn] = rooms.registry[rn];
    }
    if (Memory.inventory && Memory.inventory.rooms) {
        Object.keys(Memory.inventory.rooms).forEach(rn => {
            if (Memory.inventory.rooms[rn].my) {
                if (!activeRegistry[rn]) activeRegistry[rn] = { type: 'CORE' };
                else activeRegistry[rn].type = 'CORE'; 
            }
        });
    }
    if (Memory.empire && Memory.empire.targetRoom && !activeRegistry[Memory.empire.targetRoom]) {
        activeRegistry[Memory.empire.targetRoom] = { type: 'CORE' };
    }

    
    // --- PASS 1: CREEP LIFECYCLE ---
    const recyclingCount = coreCreeps.run(activeRegistry); // Memory-Bereinigung & universelle Creep-Logik

    // --- PASS 2: INFRASTRUCTURE ---
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

    // --- PASS 3: BOARDROOM (Modular Colony Architecture) ---
    // Ersetzt den alten core.spawner komplett
    myBoardroom.run();
    const mcaData = myBoardroom.getHUDData();

    logger.report({
        recycling: recyclingCount,
        cpu: Game.cpu.getUsed(),
        bucket: Game.cpu.bucket,
        credits: Game.market ? Game.market.credits : 0,
        earned: Memory.market ? Memory.market.earned : 0,
        pop: Object.keys(Game.creeps).length,
        cap: 60, // Temporärer Fallback (Hard Pop Cap)
        queue: mcaData.queue, 
        deadlocks: mcaData.deadlocks,
        rooms: mcaData.rooms, 
        defense: mcaData.defense,
    });

    // --- PASS 4: AUDIT SNAPSHOTS (Tactical + Strategic) ---
    // Rekonstruiere roomThreats für die Audit-Funktion aus den MCA-Daten
    const roomThreats = {};
    if (mcaData.defense && mcaData.defense.alerts) {
        mcaData.defense.alerts.forEach(alert => {
            roomThreats[alert.room] = alert.threat;
        });
    }

    const allSpawns = Object.values(Game.spawns);
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

    // --- PASS 5: PIXEL GENERATION (Market/CPU) ---
    if (Game.cpu.bucket === 10000 && Game.cpu.generatePixel) {
        Game.cpu.generatePixel();
        logger.log('💎 Pixel generated! (10,000 Bucket converted)', 'success');
    }

    // --- PASS 6: MARKET (Auto-Sell) ---
    market.run();

    // --- PASS 7: AUTO-EXPANSION ---
    expander.run();

    // --- PASS 8: AUTOMATED BASE PLANNING ---
    // Alle 1001 Ticks prüfen. Verhindert CPU-Spikes und Kollisionen mit anderen Events.
    if (Game.time % 1001 === 0) {
        Object.values(Game.rooms)
            .filter(r => r.controller && r.controller.my)
            .forEach(r => planner.run(r));
    }
};
