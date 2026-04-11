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

        for (let roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room.controller || !room.controller.my || !room.terminal) continue;
            if (room.terminal.cooldown > 0) continue; // Terminal ist gerade beschäftigt

            const terminal = room.terminal;

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