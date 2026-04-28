/**
 * RemoteManager.js
 * Verwaltet "Territories" (Remote-Räume). Setzt Miner auf Container, Hauler auf Edge-Links.
 */
class RemoteManager {
    constructor(officeName) {
        this.officeName = officeName;
    }

    run(roomManager) {
        if (!Memory.remoteRooms) return;

        // Finde alle Territorien, die zu diesem Office gehören
        const territories = Object.keys(Memory.remoteRooms).filter(r => Memory.remoteRooms[r].base === this.officeName);

        territories.forEach(territory => {
            this.manageTerritory(territory, roomManager);
            this.planInfrastructure(territory);
        });
    }

    manageTerritory(territoryName, roomManager) {
        const config = Memory.remoteRooms[territoryName];

        // Zähle lebende Creeps UND die, die bereits in der Warteschlange sind, um Überproduktion zu vermeiden
        const count = (role) => {
            const live = _.filter(Game.creeps, c => 
                c.memory.role === role && 
                c.memory.targetRoom === territoryName && 
                !c.memory.recycle
            ).length;
            const queued = roomManager.spawnQueue.filter(q => 
                q.role === role && 
                q.memory.targetRoom === territoryName
            ).length;
            return live + queued;
        };

        const currentMiners = count('remoteMiner');
        const currentHaulers = count('remoteHauler');
        
        if (currentMiners < (config.miners || 0)) {
            console.log(`[RemoteManager] Requesting Miner for ${territoryName}`);
            roomManager.queueSpawn('remoteMiner', { targetRoom: territoryName, homeRoom: this.officeName }, 40);
        }
        if (currentHaulers < (config.haulers || 0)) {
            console.log(`[RemoteManager] Requesting Hauler for ${territoryName}`);
            roomManager.queueSpawn('remoteHauler', { targetRoom: territoryName, homeRoom: this.officeName }, 45);
        }
    }

    planInfrastructure(territoryName) {
        // 1. Straßenbau von Basis-Quellen in den Remote-Raum
        // 2. Container-Platzierung auf den Sources im Remote-Raum
        // 3. Edge-Links: 
        const baseRoom = Game.rooms[this.officeName];
        if (baseRoom && baseRoom.controller.level >= 5) {
            this.planEdgeLink(baseRoom, territoryName);
        }
    }

    planEdgeLink(baseRoom, territoryName) {
        const exitDir = baseRoom.findExitTo(territoryName);
        if (exitDir !== ERR_NO_PATH && exitDir !== ERR_INVALID_ARGS) {
            const exits = baseRoom.find(exitDir);
            if (exits.length > 0) {
                // Den Ausgangs-Block finden, der dem Storage am nächsten liegt (oder die Mitte des Ausgangs)
                const exitPos = baseRoom.storage ? baseRoom.storage.pos.findClosestByRange(exits) : exits[Math.floor(exits.length / 2)];
                if (exitPos) {
                    // 1. Prüfen, ob hier im Umkreis von 3 Feldern schon ein Link steht oder geplant ist
                    const nearbyLinks = exitPos.findInRange(FIND_MY_STRUCTURES, 3, { filter: s => s.structureType === STRUCTURE_LINK });
                    const nearbySites = exitPos.findInRange(FIND_CONSTRUCTION_SITES, 3, { filter: s => s.structureType === STRUCTURE_LINK });

                    if (nearbyLinks.length === 0 && nearbySites.length === 0) {
                        // 2. Weg in Richtung Basis-Zentrum berechnen
                        const targetPos = baseRoom.storage ? baseRoom.storage.pos : new RoomPosition(25, 25, baseRoom.name);
                        const path = baseRoom.findPath(exitPos, targetPos, { ignoreCreeps: true });
                        
                        // path[0] ist 1 Feld vom Ausgang, path[1] ist 2 Felder entfernt (sicher vor Ping-Pong)
                        if (path.length >= 2) {
                            const linkPos = new RoomPosition(path[1].x, path[1].y, baseRoom.name);
                            if (baseRoom.createConstructionSite(linkPos, STRUCTURE_LINK) === OK) {
                                console.log(`[RemoteManager] Planned Edge-Link at ${linkPos} for territory ${territoryName}`);
                            }
                        }
                    }
                }
            }
        }
    }
}

module.exports = RemoteManager;