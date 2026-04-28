/**
 * RoomManager.js
 * Kümmert sich um lokale Infrastruktur, Spawning-Queues und den "Janitor" (Wartung).
 */
const utils = require('utils');
const roomsConfig = require('config.rooms');
const rolesConfig = require('config.roles');

class RoomManager {
    constructor(roomName) {
        this.roomName = roomName;
        this.spawnQueue = [];
    }

    evaluateNeeds() {
        this.spawnQueue = []; // Warteschlange jeden Tick leeren (Just-In-Time)
        
        this.evaluateEconomyAndCull();
        this.runJanitor();
    }

    evaluateEconomyAndCull() {
        const room = Game.rooms[this.roomName];
        if (!room || !room.controller || !room.controller.my) return;

        const rcl = room.controller.level;
        const inv = Memory.inventory && Memory.inventory.rooms ? Memory.inventory.rooms[this.roomName] : null;
        const config = roomsConfig.registry ? roomsConfig.registry[this.roomName] : {};

        // --- 1. EVOLUTION PROTOCOL (Phasen berechnen) ---
        let b = 0, u = 0, r = 0, h = 0, s = 0, phaseName = 'Unknown';
        if (inv) {
            const sites = inv.constructionSites, drops = inv.droppedEnergy;
            if (rcl <= 2) {
                const noSp = inv.spawns === 0;
                b = sites > 0 ? (sites > 5 ? 3 : 2) : (noSp ? 1 : 0);
                u = sites > 0 ? 1 : 2;
                if (rcl === 2 && inv.containers > 0 && inv.extensions > 0) { h = 1; phaseName = 'Phase 1 (Logistics)'; }
                else { h = noSp ? 0 : 1; phaseName = noSp ? 'Bootstrap (No Spawn)' : 'Phase 1 (Pioneers)'; }
            } else if (rcl === 3) {
                b = sites > 0 ? (sites > 5 ? 3 : 2) : 0; u = sites > 0 ? 1 : 3; r = 1; h = 2; s = drops > 1 ? 1 : 0; phaseName = 'Phase 2 (Basic Infra)';
            } else {
                b = sites > 0 ? (sites > 5 ? 3 : 2) : 0; u = sites > 0 ? 1 : 2; r = 1; h = 1; s = drops > 1 ? 1 : 0; phaseName = 'Phase 3 (Empire)';
            }
            
            // Self-Healing Logistics
            if (inv.my) {
                if (inv.overflowingContainers > 0) h += inv.overflowingContainers;
                if (inv.droppedEnergy > 3) s += 1;
            }
        }

        // Legacy-Overrides aus config.rooms.js respektieren
        if (config) {
            if (config.builders !== undefined) b = config.builders;
            if (config.upgraders !== undefined) u = config.upgraders;
            if (config.repairers !== undefined) r = config.repairers;
            if (config.haulers !== undefined) h = config.haulers;
            if (config.scavengers !== undefined) s = config.scavengers;
        }

        // Daten für das Boardroom-HUD sichern
        if (inv) inv._activeQuotas = { name: phaseName, builder: b, upgrader: u, repairer: r, hauler: h, scav: s };

        // --- 2. WARTESCHLANGE FÜLLEN ---
        const count = (role, memoryKey) => {
            const live = _.filter(Game.creeps, c => c.memory.role === role && c.memory[memoryKey] === this.roomName && !c.memory.recycle).length;
            const queued = this.spawnQueue.filter(q => q.role === role && q.memory[memoryKey] === this.roomName).length;
            return live + queued;
        };

        let maxHarvesters = (rcl >= 4) ? (inv ? inv.sources : 1) : (inv ? inv.sources * 2 : 2);
        if (config && config.harvesters !== undefined) maxHarvesters = config.harvesters;
        else if (rolesConfig.COUNTS.harvester !== undefined) maxHarvesters = rolesConfig.COUNTS.harvester;

        if (count('harvester', 'targetRoom') < maxHarvesters) this.queueSpawn('harvester', { targetRoom: this.roomName }, 10);
        if (count('hauler', 'workRoom') < h) this.queueSpawn('hauler', { workRoom: this.roomName }, 20);
        if (count('upgrader', 'targetRoom') < 1) this.queueSpawn('upgrader', { targetRoom: this.roomName }, 22); // Anti-Downgrade Fix
        if (count('builder', 'workRoom') < b) this.queueSpawn('builder', { workRoom: this.roomName }, 30);
        if (count('upgrader', 'targetRoom') < u) this.queueSpawn('upgrader', { targetRoom: this.roomName }, 40);
        if (count('repairer', 'workRoom') < r) this.queueSpawn('repairer', { workRoom: this.roomName }, 50);
        if (count('scavenger', 'workRoom') < s) this.queueSpawn('scavenger', { workRoom: this.roomName }, 60);

        // --- 3. CULL SURPLUS (Überschuss recyceln) ---
        this.cullSurplus('harvester', 'targetRoom', maxHarvesters);
        this.cullSurplus('hauler', 'workRoom', h);
        this.cullSurplus('builder', 'workRoom', b);
        this.cullSurplus('upgrader', 'targetRoom', u);
        this.cullSurplus('repairer', 'workRoom', r);
        this.cullSurplus('scavenger', 'workRoom', s);
    }

    cullSurplus(role, memoryKey, maxAllowed) {
        const creeps = _.filter(Game.creeps, c => c.memory.role === role && !c.memory.recycle && c.memory[memoryKey] === this.roomName);
        let liveActive = _.filter(creeps, c => !c.spawning);
        
        // Pre-Spawn Fix: Schreddere nicht sofort Creeps, die gerade erst ersetzt werden
        if (maxAllowed > 0) {
            liveActive = _.filter(liveActive, c => c.ticksToLive > 100); 
        }

        if (liveActive.length > maxAllowed) {
            const sorted = _.sortBy(liveActive, 'ticksToLive');
            for (let i = 0; i < (liveActive.length - maxAllowed); i++) { 
                sorted[i].memory.recycle = true; 
            }
        }
    }

    // Öffentliche API für andere Manager, um Creeps anzufordern
    queueSpawn(role, memory, priority = 50) {
        this.spawnQueue.push({ role, memory, priority });
    }

    processSpawnQueue() {
        if (this.spawnQueue.length === 0) return;
        this.spawnQueue.sort((a, b) => a.priority - b.priority);
        
        const room = Game.rooms[this.roomName];
        const availableSpawn = room.find(FIND_MY_SPAWNS).find(s => !s.spawning);
        
        if (availableSpawn) {
            const request = this.spawnQueue.shift();
            const body = utils.getOptimalBody(request.role, room.energyAvailable);
            if (body) {
                const spawnMemory = Object.assign({ role: request.role }, request.memory);
                availableSpawn.spawnCreep(body, `${request.role}_${Game.time}`, { memory: spawnMemory });
            } else {
                this.spawnQueue.unshift(request); // Zurücklegen, falls Energie nicht reicht
            }
        }
    }

    runJanitor() {
        const inv = Memory.inventory && Memory.inventory.rooms ? Memory.inventory.rooms[this.roomName] : null;
        const room = Game.rooms[this.roomName];
        if (!inv || !room || inv.rcl < 3) return;

        // Fordere einen Janitor an, wenn Straßen oder Container verfallen
        const decayingRoads = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_ROAD && s.hits < s.hitsMax * 0.5 }).length > 0;
        const decayingContainers = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER && s.hits < s.hitsMax * 0.8 }).length > 0;
        
        const currentJanitors = _.filter(Game.creeps, c => c.memory.role === 'janitor' && c.memory.office === this.roomName && !c.memory.recycle).length +
                                this.spawnQueue.filter(q => q.role === 'janitor' && q.memory.office === this.roomName).length;

        if ((decayingRoads || decayingContainers) && currentJanitors < 1) {
            this.queueSpawn('janitor', { office: this.roomName }, 70);
        }
    }
}

module.exports = RoomManager;