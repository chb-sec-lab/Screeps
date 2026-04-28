/**
 * Office.js
 * Repräsentiert einen eigenen Raum ("Office") und kapselt seine Sub-Manager.
 */
const RoomManager = require('RoomManager');
const RemoteManager = require('RemoteManager');
const DefenceManager = require('DefenceManager');

class Office {
    constructor(roomName) {
        this.name = roomName;
        this.roomManager = new RoomManager(roomName);
        this.remoteManager = new RemoteManager(roomName);
        this.defenceManager = new DefenceManager(roomName);
    }

    run() {
        // 1. Den Bedarf für diesen Tick ermitteln und die Spawn-Queue füllen.
        // Die Office-Klasse orchestriert hier, damit alle Manager ihre Anfragen einreichen können,
        // bevor die Queue verarbeitet wird.
        this.roomManager.evaluateNeeds(); // Füllt die Queue mit lokalen Anfragen
        this.remoteManager.run(this.roomManager);
        const alerts = this.defenceManager.run(this.roomManager);

        // 2. Die Spawns anweisen, die jetzt volle Queue abzuarbeiten.
        this.roomManager.processSpawnQueue();
        return alerts;
    }
}

module.exports = Office;