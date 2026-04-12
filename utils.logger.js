/**
 * utils.logger.js - SCOS v6.0.0
 * Updated: 2026-02-11 20:34 CET (Amsterdam)
 * Role: High-Visibility Diagnostics
 */
module.exports = {
    log: function(msg, type = 'info') {
        console.log(msg);
    },
    
    report: function(stats) {
        if (Game.time % 20 !== 0) return;
        
        console.log(`--- SCOS HEARTBEAT ${Game.time} ---`);
        
        // GLOBAL LINE
        const cpu = stats.cpu ? stats.cpu.toFixed(1) : '0.0';
        const bucketStr = stats.bucket === 10000 ? `10k` : stats.bucket;
        const recycleStr = stats.recycling > 0 ? ` | ♻️ ${stats.recycling} recycling` : '';
        const creditsStr = stats.credits !== undefined ? ` | 💰 ${Math.floor(stats.credits).toLocaleString()}c (+${Math.floor(stats.earned || 0)})` : '';

        console.log(`🌍 GLOBAL | Pop: ${stats.pop}/${stats.cap} | CPU: ${cpu} (Bucket: ${bucketStr})${creditsStr}${recycleStr}`);

        // QUEUE LINE
        const queueInfo = (stats.queue && stats.queue.length) ? stats.queue.slice(0, 5).join(' ➔ ') : 'clear';
        console.log(`📋 QUEUE  | ${queueInfo}`);

        // WISHLIST LINE
        if (Memory.empire && Memory.empire.wishlist && Memory.empire.wishlist.length > 0) {
            console.log(`🎯 WISH   | ${Memory.empire.wishlist.join(', ')}`);
        }

        // DEFENSE LINE
        const def = stats.defense;
        if (def && def.active) {
            console.log(`🚨 DEFENSE| ALERT in ${def.room}! Def: ${def.current}/${def.need} Heal: ${def.currentHealers}/${def.healerNeed} | Local Threat Lvl: ${def.targetThreat}`);
        }

        // ROOMS
        if (stats.rooms && stats.rooms.length) {
            stats.rooms.forEach(r => {
                let rclStr = 'Unclaimed';
                if (r.my) rclStr = `RCL ${r.rcl}`;
                else if (r.reservation) rclStr = `Res: ${r.reservation}`;

                const spawnStr = r.spawns.length > 0 ? r.spawns.join(', ') : 'No Spawns';
                
                console.log(`[${r.label}] ${r.name} (${rclStr} | ${r.phase}) | NRG: ${r.nrg}/${r.cap} | Spawns: ${spawnStr} | TTL: ${r.ttl}`);
                console.log(`  └─ ${r.roles}`);
            });
        }
    },

    auditTactical: function(snapshot) {
        console.log(
            `AUDIT-T ${snapshot.tick} | ENERGY ${snapshot.totalBufferedEnergy} | HOSTILES ${snapshot.totalHostiles} | SPAWN ${snapshot.spawnBusy}/${snapshot.spawnTotal}`
        );
    },

    auditStrategic: function(snapshot) {
        console.log(`--- STRATEGIC AUDIT ${snapshot.tick} ---`);
        console.log(
            `COLONY energyBuffered=${snapshot.totalBufferedEnergy} hostiles=${snapshot.totalHostiles} population=${snapshot.population}`
        );
        snapshot.rooms.forEach(room => {
            console.log(
                `ROOM ${room.name} vis:${room.visible ? 'Y' : 'N'} nrg:${room.energyAvailable}/${room.energyCapacity} buffer:${room.bufferedEnergy} hostiles:${room.hostiles} rampartsLow:${room.lowRamparts}`
            );
        });
    }
};
