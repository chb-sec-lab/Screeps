/**
 * structure.link.js - SCOS Link Network
 * Intelligentes Producer/Consumer Netzwerk (Verteilt Energie bedarfsgerecht)
 */
module.exports = {
    run: function(room) {
        const links = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_LINK });
        if (links.length < 2) return;

        const coreLinks = [];
        const controllerLinks = [];
        const sourceLinks = [];

        // 1. Rollen anhand der Position ermitteln (unterstützt mehrere Links pro Rolle)
        links.forEach(link => {
            if (room.storage && link.pos.inRangeTo(room.storage, 2)) {
                coreLinks.push(link);
            } else if (room.controller && link.pos.inRangeTo(room.controller, 3)) { // Range 3 für Upgrader-Flexibilität
                controllerLinks.push(link);
            } else {
                sourceLinks.push(link);
            }
        });

        // 2. Empfänger definieren: Controller-Links haben oberste Priorität, Core-Links fangen den Rest auf
        let receivers = [...controllerLinks, ...coreLinks];

        // Empfänger nach freiem Platz sortieren (der leerste Link steht ganz oben)
        receivers.sort((a, b) => b.store.getFreeCapacity(RESOURCE_ENERGY) - a.store.getFreeCapacity(RESOURCE_ENERGY));

        // 3. Source Links entleeren
        sourceLinks.forEach(sender => {
            if (sender.cooldown > 0 || sender.store[RESOURCE_ENERGY] < 100) return; // Behalte Reste, spare Cooldowns

            for (let receiver of receivers) {
                if (sender.id === receiver.id) continue;
                
                const freeSpace = receiver.store.getFreeCapacity(RESOURCE_ENERGY);
                if (freeSpace > 100) { // Sende nur, wenn sich der Transfer lohnt
                    const amount = Math.min(sender.store[RESOURCE_ENERGY], freeSpace);
                    sender.transferEnergy(receiver, amount);
                    
                    // Ein Link kann pro Tick nur einmal senden! Wir brechen für diesen Sender ab.
                    break;
                }
            }
        });

        // 4. Fallback: Core Links befeuern Controller Links (falls Source Links nicht reichten)
        // (Passiert, wenn Miner gerade spawnen, aber der Storage voll ist)
        coreLinks.forEach(core => {
            if (core.cooldown > 0 || core.store[RESOURCE_ENERGY] < 100) return;
            
            // Nur pushen, wenn im Storage genug Puffer ist
            if (room.storage && room.storage.store[RESOURCE_ENERGY] > 10000) {
                // Finde einen bedürftigen Controller-Link
                const emptyCtrlLink = controllerLinks.find(l => l.store.getFreeCapacity(RESOURCE_ENERGY) >= 400);
                if (emptyCtrlLink) {
                    const amount = Math.min(core.store[RESOURCE_ENERGY], emptyCtrlLink.store.getFreeCapacity(RESOURCE_ENERGY));
                    core.transferEnergy(emptyCtrlLink, amount);
                }
            }
        });
    }
};