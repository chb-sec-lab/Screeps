/**
 * structure.link.js - SCOS Link Network
 * Routes energy from Sources -> Controller -> Storage
 */
module.exports = {
    run: function(room) {
        const links = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_LINK });
        if (links.length < 2) return; // Wir brauchen mindestens 2 Links zum Beamen

        let coreLink = null;
        let controllerLink = null;
        const sourceLinks = [];

        // Klassifiziere alle Links im Raum anhand ihrer Position
        links.forEach(link => {
            if (room.storage && link.pos.inRangeTo(room.storage, 2)) {
                coreLink = link;
            } else if (room.controller && link.pos.inRangeTo(room.controller, 2)) {
                controllerLink = link;
            } else {
                sourceLinks.push(link);
            }
        });

        // 1. Source Links beamen zum Controller (wenn Platz), ansonsten zum Core Link (Storage)
        sourceLinks.forEach(sender => {
            if (sender.store.getUsedCapacity(RESOURCE_ENERGY) >= 400 && sender.cooldown === 0) {
                if (controllerLink && controllerLink.store.getFreeCapacity(RESOURCE_ENERGY) >= 400) {
                    sender.transferEnergy(controllerLink);
                } else if (coreLink && coreLink.store.getFreeCapacity(RESOURCE_ENERGY) >= 400) {
                    sender.transferEnergy(coreLink);
                }
            }
        });

        // 2. Fallback: Core Link beamt zum Controller (falls Controller leer und Storage sehr voll ist)
        if (coreLink && controllerLink && coreLink.cooldown === 0 && coreLink.store.getUsedCapacity(RESOURCE_ENERGY) >= 400) {
            if (controllerLink.store.getFreeCapacity(RESOURCE_ENERGY) >= 400 && room.storage && room.storage.store[RESOURCE_ENERGY] > 30000) {
                coreLink.transferEnergy(controllerLink);
            }
        }
    }
};