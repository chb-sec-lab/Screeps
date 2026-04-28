/**
 * Boardroom.js
 * Zentrale Steuerlogik ("Boardroom"). Verwaltet alle eigenen Räume als "Offices".
 */
const Office = require('Office');

class Boardroom {
    constructor() {
        this.offices = {};
        this.activeAlerts = [];
    }

    run() {
        // Initiiere globale Remote-Memory, falls nicht vorhanden.
        // Standard-Konfiguration für W9N6 wie gefordert.
        if (!Memory.remoteRooms) {
            Memory.remoteRooms = {
                'W9N6': { base: 'W7N8', miners: 1, haulers: 2 } // W7N8 als Beispiel-Basis
            };
        }

        this.activeAlerts = [];
        // Iteriere dynamisch über alle sichtbaren Räume (keine fest kodierten Raumnamen)
        for (let roomName in Game.rooms) {
            let room = Game.rooms[roomName];
            if (room.controller && room.controller.my) {
                if (!this.offices[roomName]) this.offices[roomName] = new Office(roomName);
                const officeAlerts = this.offices[roomName].run();
                if (officeAlerts && officeAlerts.length > 0) this.activeAlerts.push(...officeAlerts);
            }
        }
    }

    getHUDData() {
        let allQueues = [];
        
        // 1. Globale Warteschlange aus allen lokalen Office-Queues zusammenbauen
        for (let roomName in this.offices) {
            const rm = this.offices[roomName].roomManager;
            if (rm && rm.spawnQueue) allQueues.push(...rm.spawnQueue);
        }
        allQueues.sort((a, b) => a.priority - b.priority);
        const queuePreview = allQueues.map(req => `${req.role}@${req.memory.targetRoom || req.memory.workRoom || '?'}`).slice(0, 5);

        // 2. Raum-Berichte für das HUD generieren
        const roomReports = [];
        const inv = Memory.inventory && Memory.inventory.rooms ? Memory.inventory.rooms : {};
        
        // 1. Alle Creeps einmalig einer "Heimat"-Basis für die Zählung zuweisen.
        // Verhindert doppelte Zählungen und "verlorene" Creeps im HUD.
        const creepsByRoom = {};
        for (const name in Game.creeps) {
            const creep = Game.creeps[name];
            const mem = creep.memory;
            // Die primäre Zuweisung bestimmt, zu welchem Raum ein Creep "gehört".
            const assignedRoom = mem.office || mem.workRoom || mem.targetRoom || mem.homeRoom || creep.room.name;
            if (!creepsByRoom[assignedRoom]) {
                creepsByRoom[assignedRoom] = [];
            }
            creepsByRoom[assignedRoom].push(creep);
        }

        const roleMap = { harvester: 'HV', hauler: 'HAUL', builder: 'BLD', upgrader: 'UPG', repairer: 'REP', scavenger: 'SCAV', remoteMiner: 'RM', remoteHauler: 'RH', claimer: 'CLM', defender: 'DEF', janitor: 'JAN' };

        for (let rn in inv) {
            const rData = inv[rn];
            const isCore = this.offices[rn] !== undefined;
            const isRemote = Memory.remoteRooms && Memory.remoteRooms[rn];

            if (!isCore && !isRemote) continue; // Ignoriere fremde Räume

            const label = isCore ? 'CORE' : 'REMOTE';
            const activeRoom = Game.rooms[rn];
            // Greife auf die vorsortierte Liste zu, anstatt alle Creeps neu zu filtern.
            const myCreeps = (creepsByRoom[rn] || []).filter(c => c.ticksToLive);
            const avgTtl = myCreeps.length > 0 ? Math.floor(_.sum(myCreeps, 'ticksToLive') / myCreeps.length) : 'N/A';
            
            let spawnsInfo = [];
            if (activeRoom) {
                activeRoom.find(FIND_MY_SPAWNS).forEach(s => {
                    if (s.spawning) {
                        const spawningCreepName = s.spawning.name;
                        const role = Memory.creeps[spawningCreepName]?.role || 'ukn';
                        spawnsInfo.push(`${role}(${s.spawning.remainingTime}t)`);
                    } else {
                        spawnsInfo.push('IDLE');
                    }
                });
            }

            // Creep-Population dynamisch zählen
            const roleCounts = _.countBy(myCreeps, c => c.memory.role);
            const rolesStr = Object.entries(roleCounts).map(([role, count]) => `${roleMap[role] || role.substring(0,4).toUpperCase()}:${count}`).join(' ') || 'None';

            roomReports.push({
                name: rn, label: label, nrg: activeRoom ? activeRoom.energyAvailable : 0, cap: activeRoom ? activeRoom.energyCapacityAvailable : 0,
                rcl: rData.rcl || 0, my: rData.my || false, reservation: rData.reservation || null, phase: rData._activeQuotas ? rData._activeQuotas.name : (isCore ? 'MCA Active' : 'Outpost'),
                spawns: spawnsInfo, ttl: avgTtl, roles: rolesStr
            });
        }

        const defenseStatus = {
            active: this.activeAlerts.length > 0,
            alerts: this.activeAlerts
        };

        return { queue: queuePreview.length > 0 ? queuePreview : ['clear'], deadlocks: [], rooms: roomReports, defense: defenseStatus };
    }
}

module.exports = Boardroom;