/**
 * utils.market.js - SCOS Auto-Sell
 * Verkauft überschüssige Mineralien vollautomatisch an den Meistbietenden.
 */
const logger = require('utils.logger');

module.exports = {
    run: function() {
        // Nur alle 100 Ticks ausführen, um CPU zu sparen (Marktdaten abfragen ist teuer)
        if (Game.time % 100 !== 0) return;

        if (!Memory.market) Memory.market = { earned: 0, spent: 0 };

        const MINERAL_KEEP_AMOUNT = 10000; // Behalte 10k für eigene Labs
        const MIN_MINERAL_PRICE = 0.01;    // Verkaufe nichts unter diesem Preis (Schutz vor Scam-Orders)
        
        const ENERGY_BUY_THRESHOLD = 50000;      // Kaufe Energie, wenn Storage+Terminal unter 50k fallen
        const ENERGY_SURPLUS_THRESHOLD = 150000; // Ab 150k spendet die Basis intern
        const INTERNAL_BATCH_SIZE = 10000;       // Menge pro Sendung
        const MAX_ENERGY_PRICE = 0.05;           // Zahle maximal 0.05 Credits pro Energie
        const MIN_CREDITS = 5000;                // Eiserne Reserve: Gehe niemals pleite

        for (let roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room.controller || !room.controller.my || !room.terminal) continue;
            if (room.terminal.cooldown > 0) continue; // Terminal ist gerade beschäftigt

            const terminal = room.terminal;
            
            const storageEnergy = room.storage ? room.storage.store[RESOURCE_ENERGY] : 0;
            const terminalEnergy = terminal.store[RESOURCE_ENERGY];
            const totalEnergy = storageEnergy + terminalEnergy;

            // --- 0. INTERNAL LOGISTICS: Energie an andere Basen spenden ---
            if (totalEnergy > ENERGY_SURPLUS_THRESHOLD && terminalEnergy > INTERNAL_BATCH_SIZE * 1.5) {
                const starvingRoom = Object.values(Game.rooms).find(r => 
                    r.controller && r.controller.my && r.terminal && r.name !== roomName &&
                    ((r.storage ? r.storage.store[RESOURCE_ENERGY] : 0) + r.terminal.store[RESOURCE_ENERGY]) < ENERGY_BUY_THRESHOLD
                );

                if (starvingRoom) {
                    const cost = Game.market.calcTransactionCost(INTERNAL_BATCH_SIZE, roomName, starvingRoom.name);
                    if (terminalEnergy >= INTERNAL_BATCH_SIZE + cost) {
                        if (terminal.send(RESOURCE_ENERGY, INTERNAL_BATCH_SIZE, starvingRoom.name) === OK) {
                            logger.log(`📦 LOGISTICS: Sent ${INTERNAL_BATCH_SIZE} Energy from ${roomName} to ${starvingRoom.name} to prevent starvation.`, 'success');
                            continue; // Terminal blockiert, springe zum nächsten Raum
                        }
                    }
                }
            }

            // --- 0.5 INTERNAL MINERAL LOGISTICS: Mineralien im Imperium teilen ---
            // Bevor wir an Fremde verkaufen, stellen wir sicher, dass unsere eigenen Basen versorgt sind (für Labs!)
            let mineralSent = false;
            for (let res in terminal.store) {
                if (res === RESOURCE_ENERGY) continue;
                if (terminal.store[res] > 6000) { // Wir haben reichlich davon
                    const needyRoom = Object.values(Game.rooms).find(r => 
                        r.controller && r.controller.my && r.terminal && r.name !== roomName &&
                        ((r.terminal.store[res] || 0) + (r.storage ? (r.storage.store[res] || 0) : 0)) < 2000
                    );
                    
                    if (needyRoom) {
                        const sendAmount = 2000;
                        const cost = Game.market.calcTransactionCost(sendAmount, roomName, needyRoom.name);
                        if (terminalEnergy >= cost) {
                            if (terminal.send(res, sendAmount, needyRoom.name) === OK) {
                                logger.log(`🧪 SYNERGY: Sent ${sendAmount} ${res} from ${roomName} to ${needyRoom.name} for Lab processing.`, 'success');
                                mineralSent = true;
                                break;
                            }
                        }
                    }
                }
            }
            if (mineralSent) continue; // Terminal ist jetzt blockiert, weiter zum nächsten Raum

            // --- 1. AUTO-BUY: Energie vom Markt einkaufen bei Notstand ---
            if (totalEnergy < ENERGY_BUY_THRESHOLD && terminalEnergy > 2000 && Game.market.credits > MIN_CREDITS) {
                const orders = Game.market.getAllOrders({type: ORDER_SELL, resourceType: RESOURCE_ENERGY});
                const validOrders = orders.filter(o => o.amount > 0 && o.price <= MAX_ENERGY_PRICE).sort((a, b) => a.price - b.price);

                if (validOrders.length > 0) {
                    const bestOrder = validOrders[0];
                    let amountToBuy = Math.min(ENERGY_BUY_THRESHOLD - totalEnergy, bestOrder.amount);

                    // Transferkosten-Ratio berechnen, damit wir uns nicht selbst blockieren
                    const costRatio = Game.market.calcTransactionCost(1000, roomName, bestOrder.roomName) / 1000;
                    if (costRatio > 0) {
                        const maxAffordableShipping = Math.floor((terminalEnergy - 1000) / costRatio); // Lass immer 1000 E im Terminal
                        amountToBuy = Math.min(amountToBuy, maxAffordableShipping);
                    }

                    const maxAffordableCredits = Math.floor((Game.market.credits - MIN_CREDITS) / bestOrder.price);
                    amountToBuy = Math.min(amountToBuy, maxAffordableCredits);

                    if (amountToBuy > 1000 && Game.market.deal(bestOrder.id, amountToBuy, roomName) === OK) {
                        Memory.market.spent = (Memory.market.spent || 0) + (amountToBuy * bestOrder.price);
                        logger.log(`🛒 MARKET: Bought ${amountToBuy} ENERGY at ${bestOrder.price} cr/ea for ${roomName}`, 'info');
                        continue; // Max 1 Deal pro Loop
                    }
                }
            }

            // --- 2. AUTO-SELL: Überschüssige Mineralien verkaufen ---

            for (let res in terminal.store) {
                // Energie ignorieren wir vorerst für den Verkauf, wir brauchen sie für die Transferkosten
                if (res === RESOURCE_ENERGY) continue;

                const excess = terminal.store[res] - MINERAL_KEEP_AMOUNT;
                if (excess <= 0) continue;

                // Überschuss gefunden! Finde Käufer auf dem Markt.
                const orders = Game.market.getAllOrders({type: ORDER_BUY, resourceType: res});
                if (orders.length === 0) continue;

                // Filtere gültige Orders und sortiere nach höchstem Preis
                const validOrders = orders.filter(o => 
                    o.amount > 0 && 
                    o.price >= MIN_MINERAL_PRICE
                ).sort((a, b) => b.price - a.price);

                if (validOrders.length === 0) continue;

                const bestOrder = validOrders[0];
                let amountToSell = Math.min(excess, bestOrder.amount);

                // Transferkosten (Energie) berechnen
                const cost = Game.market.calcTransactionCost(amountToSell, roomName, bestOrder.roomName);
                
                // Reicht unsere Energie im Terminal für die Gebühr?
                if (terminal.store[RESOURCE_ENERGY] < cost) {
                    const affordableRatio = terminal.store[RESOURCE_ENERGY] / cost;
                    amountToSell = Math.floor(amountToSell * affordableRatio);
                    if (amountToSell <= 0) continue;
                }

                const resDeal = Game.market.deal(bestOrder.id, amountToSell, roomName);
                if (resDeal === OK) {
                    Memory.market.earned += amountToSell * bestOrder.price;
                    logger.log(`📈 MARKET: Sold ${amountToSell} ${res} at ${bestOrder.price} credits/ea from ${roomName}`, 'success');
                    return; // Max 1 Deal pro Loop, um Limits nicht zu sprengen
                } else {
                    logger.log(`📉 MARKET: Failed to sell ${res} from ${roomName}. Code: ${resDeal}`, 'warn');
                }
            }
        }
    }
};