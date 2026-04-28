/**
 * core.spawner.js - SCOS Infinite-Base Spawner
 * Isoliertes System für dynamische Warteschlangen und Einheiten-Produktion.
 * HINWEIS: Manuelle Werte aus config.rooms und config.roles überschreiben das AI-Scaling!
 */
const rooms = require('config.rooms');
const roles = require('config.roles');
const logger = require('utils.logger');

module.exports = {
    run: function(activeRegistry, roomThreats) {
        const allSpawns = Object.values(Game.spawns);
        const plannedSpawns = [];
        const requestQueue = [];
        let deadlocks = [];
        let queuePreview = [];
        const roomReports = [];
        const HARD_POP_CAP = 60;

        function getPreSpawnTime(creep) {
            const spawnTime = creep.body.length * 3;
            const targetR = creep.memory.targetRoom || creep.memory.workRoom || creep.room.name;
            const homeR = creep.memory.homeRoom || creep.room.name;
            const roomDist = Game.map.getRoomLinearDistance(homeR, targetR);
            return spawnTime + ((roomDist === 0) ? 20 : (roomDist * 50)) + 10; 
        }

        function countAssigned(role, roomName, memoryKey) {
            const live = _.filter(Game.creeps, c => c.memory.role === role && !c.memory.recycle && (c.spawning || c.ticksToLive > getPreSpawnTime(c)) && c.memory[memoryKey] === roomName).length;
            const planned = _.filter(plannedSpawns, m => m.role === role && m[memoryKey] === roomName).length;
            return live + planned;
        }

        function countRole(role) {
            const live = _.filter(Game.creeps, c => c.memory.role === role && !c.memory.recycle && (c.spawning || c.ticksToLive > getPreSpawnTime(c))).length;
            return live + _.filter(plannedSpawns, m => m.role === role).length;
        }

        function cullSurplus(role, roomName, memoryKey, maxAllowed) {
            const creeps = _.filter(Game.creeps, c => c.memory.role === role && !c.memory.recycle && c.memory[memoryKey] === roomName);
            let liveActive = _.filter(creeps, c => !c.spawning);
            
            // PRE-SPAWN FIX: Ignoriere alte Creeps, deren Ersatz bereits spawnt/arbeitet.
            // Verhindert, dass hart arbeitende Creeps kurz vor ihrem Tod plötzlich in den Schredder rennen.
            if (maxAllowed > 0) {
                liveActive = _.filter(liveActive, c => c.ticksToLive > getPreSpawnTime(c));
            }

            if (liveActive.length > maxAllowed) {
                const sorted = _.sortBy(liveActive, 'ticksToLive');
                for (let i = 0; i < (liveActive.length - maxAllowed); i++) { sorted[i].memory.recycle = true; }
            }
        }

        function bodyCost(body) { return _.sum(body, part => BODYPART_COST[part] || 0); }

        const fallbackBodies = { defender: [TOUGH, MOVE, ATTACK, MOVE], claimer: [CLAIM, MOVE], healer: [MOVE, HEAL], scout: [MOVE], vanguard: [TOUGH, MOVE, RANGED_ATTACK], medic: [MOVE, HEAL], breacher: [WORK, MOVE] };

        function getOptimalBody(role, energy) {
            const full = roles.BODIES[role];
            if (full && bodyCost(full) <= energy) return full;
            let body = [], cost = 0;

            if (['harvester', 'remoteMiner', 'mineralMiner'].includes(role)) {
                if (energy < 200) return null; 
                body.push(WORK, CARRY, MOVE); cost += 200;
                while (cost + 200 <= energy && body.length < 15) { body.push(WORK); cost += 100; if (cost + 50 <= energy) { body.push(CARRY); cost += 50; } if (cost + 50 <= energy) { body.push(MOVE); cost += 50; } }
                return body;
            }
            if (['builder', 'upgrader', 'repairer', 'janitor'].includes(role)) {
                if (energy < 200) return null; 
                body.push(WORK, CARRY, MOVE); cost += 200;
                while (cost + 200 <= energy && body.length < 18) { body.push(WORK); cost += 100; if (cost + 50 <= energy) { body.push(CARRY); cost += 50; } if (cost + 50 <= energy) { body.push(MOVE); cost += 50; } }
                return body;
            }
            if (['hauler', 'scavenger', 'chemist', 'remoteHauler'].includes(role)) {
                if (energy < 100) return null;
                body.push(CARRY, MOVE); cost += 100;
                while (cost + 100 <= energy && body.length < 21) { body.push(CARRY); cost += 50; if (cost + 50 <= energy) { body.push(MOVE); cost += 50; } }
                return body;
            }
            const fallback = fallbackBodies[role];
            return (fallback && bodyCost(fallback) <= energy) ? fallback : null;
        }

        function resolveSpawnBody(spawn, role, targetRoomName) {
            const maxCap = spawn.room.energyCapacityAvailable;
            const currentEnergy = spawn.room.energyAvailable;
            const full = roles.BODIES[role];
            const fullCost = full ? bodyCost(full) : Infinity;

            if (fullCost > 0 && fullCost <= currentEnergy) return full;
            let memoryKey = ['builder', 'hauler', 'scavenger', 'repairer', 'chemist', 'mineralMiner', 'janitor'].includes(role) ? 'workRoom' : 'targetRoom';
            const currentCount = countAssigned(role, targetRoomName, memoryKey);
            
            const isEmergency = (role === 'harvester' && currentCount < 2) || 
                                (role === 'hauler' && currentCount === 0) ||
                                (role === 'upgrader' && currentCount === 0);
            if (currentEnergy < maxCap && currentEnergy < fullCost && !isEmergency) return null; 
            return getOptimalBody(role, currentEnergy);
        }

        // --- ZENTRALE CONTROLLER / ROOM LOGIC (Evolution Protocol) ---
        function getPhaseQuotas(level, invData, config) {
            let b = 0, u = 0, r = 0, h = 0, s = 0, phaseName = 'Unknown';
            if (invData) {
                const sites = invData.constructionSites, drops = invData.droppedEnergy;
                if (level <= 2) {
                    const noSp = invData.spawns === 0;
                    b = sites > 0 ? (sites > 5 ? 3 : 2) : (noSp ? 1 : 0); 
                    u = sites > 0 ? 1 : 2; 
                    if (level === 2 && invData.containers > 0 && invData.extensions > 0) { h = 1; phaseName = 'Phase 1 (Logistics)'; } 
                    else { h = noSp ? 0 : 1; phaseName = noSp ? 'Bootstrap (No Spawn)' : 'Phase 1 (Pioneers)'; }
                } else if (level === 3) {
                    b = sites > 0 ? (sites > 5 ? 3 : 2) : 0; u = sites > 0 ? 1 : 3; r = 1; h = 2; s = drops > 1 ? 1 : 0; phaseName = 'Phase 2 (Basic Infra)';
                } else {
                    b = sites > 0 ? (sites > 5 ? 3 : 2) : 0; u = sites > 0 ? 1 : 2; r = 1; h = 1; s = drops > 1 ? 1 : 0; phaseName = 'Phase 3 (Empire)';
                }
                if (invData.my) {
                    if (invData.overflowingContainers > 0) h += invData.overflowingContainers;
                    if (invData.droppedEnergy > 3) s += 1;
                }
            }
            
            // FIX: Manuelle Configs aus config.rooms.js überschreiben IMMER die KI-Logik!
            if (config) {
                if (config.builders !== undefined) b = config.builders;
                if (config.upgraders !== undefined) u = config.upgraders;
                if (config.repairers !== undefined) r = config.repairers;
                if (config.haulers !== undefined) h = config.haulers;
                if (config.scavengers !== undefined) s = config.scavengers;
                // Fallbacks/Legacy
                if (config.maxBuilders !== undefined) b = Math.min(b, config.maxBuilders);
                if (config.maxHaulers !== undefined) h = Math.min(h, config.maxHaulers);
            }
            return { name: phaseName, builder: b, upgrader: u, repairer: r, hauler: h, scav: s };
        }

        // --- THE BASE CHECK (TRIAGE) ---
        // Bewertet die Gesundheit des Raumes auf Gebäude, Creeps und Feinde
        function evaluateRoomState(rn, inv, threats) {
            if (!inv || !inv.my) return 'UNOWNED';
            const hostiles = threats[rn] || 0;
            const hCount = countAssigned('harvester', rn, 'targetRoom');
            const haulCount = countAssigned('hauler', rn, 'workRoom');
            
            if (hostiles > 0) return 'SIEGE';
            if ((hCount + haulCount) === 0 && inv.spawns > 0) return 'COLLAPSE';
            if (inv.spawns === 0) return 'NO_SPAWN';
            if (inv.rcl >= 2 && inv.containers === 0) return 'RECOVERY';
            return 'STABLE';
        }

        const ownedRoomNames = Memory.inventory && Memory.inventory.rooms ? Object.keys(Memory.inventory.rooms).filter(rn => Memory.inventory.rooms[rn].my) : [];
        const canClaimMore = Object.values(Game.rooms).filter(r => r.controller && r.controller.my).length < Game.gcl.level;
        
        const dynamicMinerQueue = [];
        const dynamicMineralQueue = [];
        const dynamicChemistQueue = [];

        const maxClaimers = roles.COUNTS.claimer !== undefined ? roles.COUNTS.claimer : Infinity;
        let currentClaimers = countRole('claimer');

        ownedRoomNames.forEach(rn => {
            const inv = Memory.inventory.rooms[rn], config = activeRegistry[rn];
            let requiredMiners = (inv.rcl >= 4) ? inv.sources * 1 : inv.sources * 2;
            // FIX: config.rooms Override für Harvester!
            if (config && config.harvesters !== undefined) requiredMiners = config.harvesters;
            // FIX 2: Wenn global config.roles für harvester überschrieben wurde, nutze es als Fallback!
            else if (roles.COUNTS.harvester !== undefined) requiredMiners = roles.COUNTS.harvester;

            dynamicMinerQueue.push({ room: rn, current: countAssigned('harvester', rn, 'targetRoom'), required: requiredMiners });
            
            if (inv.rcl >= 6 && inv.extractors > 0 && inv.mineralAmount > 0) {
                dynamicMineralQueue.push({ room: rn, current: countAssigned('mineralMiner', rn, 'workRoom'), required: 1 });
            }
            if (inv.rcl >= 6 && inv.labs >= 3) {
                dynamicChemistQueue.push({ room: rn, current: countAssigned('chemist', rn, 'workRoom'), required: 1 });
            }
        });

        Object.keys(activeRegistry).forEach(rn => {
            const config = activeRegistry[rn];
            const inv = Memory.inventory && Memory.inventory.rooms ? Memory.inventory.rooms[rn] : null;
            const rcl = inv ? inv.rcl : 0;
            const pBoost = (rn === rooms.HOME) ? 0 : 1;
            
            if (config.type === 'CORE') {
                if (!inv || !inv.my) {
                    if (canClaimMore && currentClaimers < maxClaimers) {
                        const clmCount = countAssigned('claimer', rn, 'targetRoom');
                        if (clmCount < 1) {
                            requestQueue.push({ role: 'claimer', memory: { targetRoom: rn, claimMode: 'claim' }, priority: 12 + pBoost, count: clmCount, max: 1 });
                            currentClaimers++;
                        }
                    }
                    return; 
                }

                let quotas = getPhaseQuotas(rcl, inv, config);
                const roomState = evaluateRoomState(rn, inv, roomThreats);
                inv._activeQuotas = quotas; // Speichern für HUD & Culling am Ende

                const dynM = dynamicMinerQueue.find(q => q.room === rn);
                const hCount = countAssigned('hauler', rn, 'workRoom');
                const bCount = countAssigned('builder', rn, 'workRoom');
                const uCount = countAssigned('upgrader', rn, 'targetRoom');
                const rCount = countAssigned('repairer', rn, 'workRoom');
                const sCount = countAssigned('scavenger', rn, 'workRoom');

                // --- STATE MACHINE ROUTING ---
                if (roomState === 'COLLAPSE') {
                    quotas.name = '🚨 COLLAPSE';
                    if (dynM && dynM.current < 1) requestQueue.push({ role: 'harvester', memory: { targetRoom: rn }, priority: 1, count: dynM.current, max: 1 });
                    if (hCount < 1) requestQueue.push({ role: 'hauler', memory: { workRoom: rn }, priority: 2, count: hCount, max: 1 });
                    quotas.builder = 0; quotas.upgrader = 0; quotas.repairer = 0; quotas.scav = 0; quotas.hauler = 1;
                } 
                else if (roomState === 'SIEGE') {
                    quotas.name = '⚔️ SIEGE';
                    if (dynM && dynM.current < dynM.required) requestQueue.push({ role: 'harvester', memory: { targetRoom: rn }, priority: 10 + pBoost, count: dynM.current, max: dynM.required });
                    if (hCount < quotas.hauler) requestQueue.push({ role: 'hauler', memory: { workRoom: rn }, priority: 15 + pBoost, count: hCount, max: quotas.hauler });
                    if (rCount < Math.max(1, quotas.repairer)) requestQueue.push({ role: 'repairer', memory: { workRoom: rn }, priority: 20 + pBoost, count: rCount, max: Math.max(1, quotas.repairer) });
                    quotas.builder = 0; quotas.upgrader = 0; quotas.scav = 0;
                }
                else if (roomState === 'RECOVERY' || roomState === 'NO_SPAWN') {
                    quotas.name = roomState === 'NO_SPAWN' ? '🏗️ NO_SPAWN' : '🏗️ RECOVERY';
                    if (dynM && dynM.current < dynM.required) requestQueue.push({ role: 'harvester', memory: { targetRoom: rn }, priority: 10 + pBoost, count: dynM.current, max: dynM.required });
                    if (hCount < quotas.hauler) requestQueue.push({ role: 'hauler', memory: { workRoom: rn }, priority: 15 + pBoost, count: hCount, max: quotas.hauler });
                    let bMax = Math.max(2, quotas.builder);
                    if (bCount < bMax) requestQueue.push({ role: 'builder', memory: { workRoom: rn }, priority: 20 + pBoost, count: bCount, max: bMax });
                    quotas.upgrader = Math.max(1, quotas.upgrader); // Zwingend 1 Upgrader erlauben!
                }
                else {
                    // STABLE STATE (Normalbetrieb)
                    if (dynM) {
                        if (dynM.current < Math.min(2, dynM.required)) requestQueue.push({ role: 'harvester', memory: { targetRoom: rn }, priority: 10 + pBoost, count: dynM.current, max: Math.min(2, dynM.required) });
                        else if (dynM.current < dynM.required) requestQueue.push({ role: 'harvester', memory: { targetRoom: rn }, priority: 30 + pBoost, count: dynM.current, max: dynM.required });
                    }
                    let bPriority = (quotas.builder > 0 && inv.spawns === 0) ? 15 + pBoost : 40 + pBoost; 
                    if (bCount < quotas.builder) requestQueue.push({ role: 'builder', memory: { workRoom: rn }, priority: bPriority, count: bCount, max: quotas.builder });

                    if (hCount < quotas.hauler) requestQueue.push({ role: 'hauler', memory: { workRoom: rn }, priority: 25 + pBoost, count: hCount, max: quotas.hauler });
                    if (sCount < quotas.scav) requestQueue.push({ role: 'scavenger', memory: { workRoom: rn }, priority: 65 + pBoost, count: sCount, max: quotas.scav });
                    if (rCount < quotas.repairer) requestQueue.push({ role: 'repairer', memory: { workRoom: rn }, priority: 70 + pBoost, count: rCount, max: quotas.repairer });
                }

                // --- GLOBAL UPGRADER LOGIC ---
                if (roomState !== 'COLLAPSE' && roomState !== 'SIEGE') {
                    let uPriority = 50 + pBoost;
                    let uMax = quotas.upgrader;
                    
                    // Der erste Upgrader hat EXTREME Priorität, damit Controller sofort wächst!
                    if (uCount === 0 && uMax > 0) uPriority = 22 + pBoost; 
                    
                    const activeRoom = Game.rooms[rn];
                    if (activeRoom && activeRoom.controller && activeRoom.controller.my && activeRoom.controller.ticksToDowngrade < 5000) {
                        uPriority = 5; 
                        uMax = Math.max(1, uMax); 
                    }
                    if (uCount < uMax && uMax > 0) requestQueue.push({ role: 'upgrader', memory: { targetRoom: rn }, priority: uPriority, count: uCount, max: uMax });
                }

                // Specials (Mineral/Chemist) nur wenn Basis sicher ist
                if (roomState === 'STABLE' || roomState === 'RECOVERY') {
                    const dynMin = dynamicMineralQueue.find(q => q.room === rn);
                    if (dynMin && dynMin.current < dynMin.required) requestQueue.push({ role: 'mineralMiner', memory: { workRoom: rn }, priority: 80 + pBoost, count: dynMin.current, max: dynMin.required });

                    const dynChem = dynamicChemistQueue.find(q => q.room === rn);
                    if (dynChem && dynChem.current < dynChem.required) requestQueue.push({ role: 'chemist', memory: { workRoom: rn }, priority: 85 + pBoost, count: dynChem.current, max: dynChem.required });
                }

            } else if (config.type === 'REMOTE') {
                const baseRoom = config.base || Object.keys(rooms.registry).find(r => rooms.registry[r].type === 'CORE');
                const srcCount = inv ? inv.sources : (config.knownSources || 1);
                let rMinersAllowed = config.remoteMiners !== undefined ? config.remoteMiners : srcCount * (config.minersPerSource || 2);
                let rHaulersAllowed = config.remoteHaulers !== undefined ? config.remoteHaulers : srcCount;
                
                if (inv && inv.visible && inv.overflowingContainers > 0) rHaulersAllowed += inv.overflowingContainers;

                if ((!inv || (!inv.my && !inv.reservation)) && currentClaimers < maxClaimers) {
                    const clmCount = countAssigned('claimer', rn, 'targetRoom');
                    if (clmCount < 1) {
                        requestQueue.push({ role: 'claimer', memory: { targetRoom: rn, claimMode: 'reserve' }, priority: 45 + pBoost, count: clmCount, max: 1 });
                        currentClaimers++;
                    }
                }
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

        // Global Fallbacks (Defense, Army, Scouts) - Nutzt config.roles als Baseline
        const defenseActive = Memory.defense && Memory.defense.activeUntil && Game.time <= Memory.defense.activeUntil;
        if (defenseActive) {
            const dCount = countAssigned('defender', Memory.defense.targetRoom, 'targetRoom');
            if (dCount < Memory.defense.need) requestQueue.push({ role: 'defender', memory: { targetRoom: Memory.defense.targetRoom, homeRoom: Object.keys(rooms.registry).find(r => rooms.registry[r].type === 'CORE') }, priority: 20, count: dCount, max: Memory.defense.need });
            const healCount = countAssigned('healer', Memory.defense.targetRoom, 'targetRoom');
            if (healCount < Memory.defense.healerNeed) requestQueue.push({ role: 'healer', memory: { targetRoom: Memory.defense.targetRoom, homeRoom: Object.keys(rooms.registry).find(r => rooms.registry[r].type === 'CORE') }, priority: 21, count: healCount, max: Memory.defense.healerNeed });
        }
        if (rooms.WAR_MODE) {
            const vCount = countRole('vanguard');
            if (vCount < roles.COUNTS.vanguard) requestQueue.push({ role: 'vanguard', memory: {}, priority: 90, count: vCount, max: roles.COUNTS.vanguard });
            const mCount = countRole('medic');
            if (mCount < roles.COUNTS.medic) requestQueue.push({ role: 'medic', memory: {}, priority: 91, count: mCount, max: roles.COUNTS.medic });
        }
        const scCount = countRole('scout');
        if (scCount < (roles.COUNTS.scout || 1)) requestQueue.push({ role: 'scout', memory: {}, priority: 100, count: scCount, max: roles.COUNTS.scout || 1 });

        requestQueue.sort((a, b) => a.priority - b.priority);
        queuePreview = requestQueue.map(req => `${req.role}${req.memory.targetRoom ? '@'+req.memory.targetRoom : (req.memory.workRoom ? '@'+req.memory.workRoom : '')}:${req.count}/${req.max}`);
        
        const idleSpawns = allSpawns.filter(s => !s.spawning);
        if (idleSpawns.length === 0 && allSpawns.length > 0) queuePreview.unshift('spawn busy');
        
        if (Object.keys(Game.creeps).length >= HARD_POP_CAP) {
            queuePreview = [`POP CAP (${HARD_POP_CAP})`];
            idleSpawns.length = 0;
        }

        for (const spawn of idleSpawns) {
            for (let i = 0; i < requestQueue.length; i++) {
                const req = requestQueue[i];
                if (req.count >= req.max) continue;

                const reqRoom = req.memory.targetRoom || req.memory.workRoom;
                let isMyOwnRoom = reqRoom === spawn.room.name;
                let isMutualAid = (req.role === 'defender' || req.role === 'healer' || req.role === 'claimer');
                
                if (reqRoom && !isMyOwnRoom) {
                    const reqInv = Memory.inventory.rooms[reqRoom];
                    const isMyRemote = activeRegistry[reqRoom] && activeRegistry[reqRoom].base === spawn.room.name;
                    const needsBootstrap = reqInv && reqInv.spawns === 0;
                    if (activeRegistry[reqRoom] && activeRegistry[reqRoom].type === 'CORE' && reqInv && reqInv.my) {
                        if (countAssigned('harvester', reqRoom, 'targetRoom') < 2 || countAssigned('hauler', reqRoom, 'workRoom') < 1) isMutualAid = true;
                    }
                    
                    // --- MUTUAL AID VETO ---
                    // Wenn der Spawn-Raum selbst in der Krise ist oder es verboten wurde, leistet er keine Nothilfe
                    if (isMutualAid && !isMyRemote && !needsBootstrap) {
                        const senderConfig = activeRegistry[spawn.room.name];
                        const senderInv = Memory.inventory.rooms[spawn.room.name];
                        const senderState = senderInv && senderInv._activeQuotas ? senderInv._activeQuotas.name : 'STABLE';
                        
                        const isSenderInCrisis = senderState.includes('COLLAPSE') || senderState.includes('SIEGE') || senderState.includes('RECOVERY');
                        
                        if (senderConfig && senderConfig.disableMutualAid) isMutualAid = false;
                        else if (isSenderInCrisis) isMutualAid = false;
                    }

                    if (!needsBootstrap && !isMyRemote && !isMutualAid) continue; 
                }

                const sRole = req.role;
                const name = roles.generateName(sRole);
                const spawnMemory = Object.assign({ role: sRole }, req.memory);
                if (['defender', 'healer'].includes(sRole)) spawnMemory.homeRoom = spawn.room.name;

                const body = resolveSpawnBody(spawn, sRole, reqRoom);
                if (!body) break; 

                const spawnRes = spawn.spawnCreep(body, name, { memory: spawnMemory });
                if (spawnRes === OK) {
                    plannedSpawns.push(spawnMemory);
                    req.count++; 
                    if (spawnMemory.role === 'harvester') { const qEntry = dynamicMinerQueue.find(q => q.room === spawnMemory.targetRoom); if (qEntry) qEntry.current++; }
                    const logMsg = (!isMyOwnRoom && isMutualAid) ? `🚑 MUTUAL AID: ${spawn.name} spawning ${sRole} to rescue ${reqRoom}!` : `🐣 ${spawn.name} spawning: ${name}`;
                    logger.log(logMsg, 'success');
                    break; 
                } else {
                    if (spawnRes === ERR_NOT_ENOUGH_ENERGY && ((sRole === 'harvester' && countAssigned('harvester', reqRoom, 'targetRoom') < 2) || (sRole === 'hauler' && countAssigned('hauler', reqRoom, 'workRoom') === 0))) deadlocks.push(spawn.room.name);
                    logger.log(`${spawn.name} blocked: role=${sRole} code=${spawnRes}`, 'warn');
                    break; 
                }
            }
        }

        // GENERIERE BERICHTE UND FÜHRE CULLING DURCH
        const fQ = (role, have, need) => (need === 0 && have === 0) ? '' : `${role}:${have}/${need}`;
        
        Object.keys(activeRegistry).forEach(rn => {
            const config = activeRegistry[rn];
            const inv = Memory.inventory.rooms[rn];
            const rcl = inv ? inv.rcl : 0;
            
            let spawnsInfo = [];
            allSpawns.filter(s => s.room.name === rn).forEach(s => { spawnsInfo.push(s.spawning ? `${Game.creeps[s.spawning.name]?.memory.role || 'ukn'}(${s.spawning.remainingTime}t)` : 'IDLE'); });

            const myCreeps = _.filter(Game.creeps, c => (c.memory.targetRoom === rn || c.memory.workRoom === rn) && c.ticksToLive);
            const avgTtl = myCreeps.length > 0 ? Math.floor(_.sum(myCreeps, 'ticksToLive') / myCreeps.length) : 'N/A';

            if (config.type === 'CORE') {
                if (!inv || !inv.my) {
                    ['harvester', 'hauler', 'builder', 'upgrader', 'repairer', 'mineralMiner', 'chemist'].forEach(role => cullSurplus(role, rn, ['builder','hauler','repairer','mineralMiner','chemist'].includes(role) ? 'workRoom' : 'targetRoom', 0));
                    cullSurplus('claimer', rn, 'targetRoom', canClaimMore ? 1 : 0);
                    roomReports.push({ name: rn, label: 'CORE', nrg: Game.rooms[rn] ? Game.rooms[rn].energyAvailable : 0, cap: Game.rooms[rn] ? Game.rooms[rn].energyCapacityAvailable : 0, rcl: rcl, my: false, reservation: inv ? inv.reservation : null, phase: 'Awaiting Claim', spawns: spawnsInfo, ttl: avgTtl, roles: fQ('CLM', countAssigned('claimer', rn, 'targetRoom'), canClaimMore ? 1 : 0) || 'None' });
                } else {
                    const phase = inv._activeQuotas || getPhaseQuotas(rcl, inv, config);
                    const dynM = dynamicMinerQueue.find(q => q.room === rn);
                    
                    let cullB = (roles.COUNTS.builder !== undefined) ? roles.COUNTS.builder : Math.max(1, phase.builder);
                    let cullS = (roles.COUNTS.scavenger !== undefined) ? roles.COUNTS.scavenger : Math.max(1, phase.scav);

                    if (dynM) cullSurplus('harvester', rn, 'targetRoom', dynM.required);
                    cullSurplus('builder', rn, 'workRoom', cullB);
                    cullSurplus('upgrader', rn, 'targetRoom', phase.upgrader);
                    cullSurplus('repairer', rn, 'workRoom', phase.repairer);
                    cullSurplus('hauler', rn, 'workRoom', phase.hauler);
                    cullSurplus('scavenger', rn, 'workRoom', cullS);
                    
                    let rolesStr = [
                        dynM ? fQ('HV', dynM.current, dynM.required) : '',
                        fQ('BLD', countAssigned('builder', rn, 'workRoom'), phase.builder),
                        fQ('UPG', countAssigned('upgrader', rn, 'targetRoom'), phase.upgrader),
                        fQ('REP', countAssigned('repairer', rn, 'workRoom'), phase.repairer),
                        fQ('HAUL', countAssigned('hauler', rn, 'workRoom'), phase.hauler),
                        fQ('SCAV', countAssigned('scavenger', rn, 'workRoom'), phase.scav)
                    ].filter(Boolean).join(' ') || 'None';
                    roomReports.push({ name: rn, label: 'CORE', nrg: Game.rooms[rn] ? Game.rooms[rn].energyAvailable : 0, cap: Game.rooms[rn] ? Game.rooms[rn].energyCapacityAvailable : 0, rcl: rcl, my: true, reservation: null, phase: phase.name, spawns: spawnsInfo, ttl: avgTtl, roles: rolesStr });
                }
            } else {
                roomReports.push({ name: rn, label: 'REMOTE', nrg: 0, cap: 0, rcl: rcl, my: inv ? inv.my : false, reservation: inv ? inv.reservation : null, phase: (inv && inv.my) ? 'Claimed' : (inv && inv.reservation ? `Secured (${inv.reservation})` : 'Unsecured'), spawns: [], ttl: avgTtl, roles: 'Outpost' });
            }
        });

        return { queuePreview, deadlocks, roomReports, popCap: HARD_POP_CAP };
    }
};