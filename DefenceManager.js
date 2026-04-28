/**
 * DefenceManager.js
 * Überwacht das Office und seine Territories auf Feinde und spawnt Outpost-Defender.
 */
const roomsConfig = require('config.rooms');

class DefenceManager {
    constructor(officeName) {
        this.officeName = officeName;
    }

    run(roomManager) {
        const localAlerts = this.checkLocalDefence(roomManager);
        const remoteAlerts = this.checkRemoteDefence(roomManager);
        return [...localAlerts, ...remoteAlerts];
    }

    checkLocalDefence(roomManager) {
        const room = Game.rooms[this.officeName];
        if (!room) return;
        const hostiles = room.find(FIND_HOSTILE_CREEPS, {
            filter: c => !roomsConfig.ALLIES.includes(c.owner.username) && c.body.some(p => p.type === ATTACK || p.type === RANGED_ATTACK)
        });
        if (hostiles.length > 0) {
            console.log(`🚨 [DefenceManager] ALERT in Office ${this.officeName}!`);
            const towers = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_TOWER });
            if (towers.length === 0 || hostiles.length > towers.length) {
                 const currentDefenders = _.filter(Game.creeps, c => c.memory.role === 'defender' && c.memory.targetRoom === this.officeName).length;
                 if (currentDefenders < 1) {
                     roomManager.queueSpawn('defender', { targetRoom: this.officeName, homeRoom: this.officeName }, 15);
                 }
            }
            return [{ room: this.officeName, threat: hostiles.length }];
        }
        return [];
    }

    checkRemoteDefence(roomManager) {
        if (!Memory.remoteRooms) return [];
        const territories = Object.keys(Memory.remoteRooms).filter(r => Memory.remoteRooms[r].base === this.officeName);
        const alerts = [];
        
        territories.forEach(territoryName => {
            const room = Game.rooms[territoryName];
            if (room) {
                const hostiles = room.find(FIND_HOSTILE_CREEPS, {
                    filter: c => !roomsConfig.ALLIES.includes(c.owner.username) && c.body.some(p => p.type === ATTACK || p.type === RANGED_ATTACK)
                });
                if (hostiles.length > 0) {
                    const needed = Math.min(2, hostiles.length); // Fordere bis zu 2 Verteidiger an

                    alerts.push({ room: territoryName, threat: hostiles.length });
                    const count = _.filter(Game.creeps, c => c.memory.role === 'defender' && c.memory.targetRoom === territoryName && !c.memory.recycle).length +
                                  roomManager.spawnQueue.filter(q => q.role === 'defender' && q.memory.targetRoom === territoryName).length;

                    if (count < needed) {
                        console.log(`⚔️ [DefenceManager] Outpost Defender requested for ${territoryName}!`);
                        roomManager.queueSpawn('defender', { targetRoom: territoryName, homeRoom: this.officeName }, 15);
                    }
                }
            }
        });
        return alerts;
    }
}

module.exports = DefenceManager;