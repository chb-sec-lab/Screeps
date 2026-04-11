/**
 * utils.logger.js - SCOS v6.0.0
 * Updated: 2026-02-11 20:34 CET (Amsterdam)
 * Role: High-Visibility Diagnostics
 */
module.exports = {
    log: function(msg, type = 'info') {
        const colors = { info: '#ffffff', warn: '#ffaa00', error: '#ff4d4d', success: '#00ffcc' };
        const timeStr = new Date().toLocaleTimeString('nl-NL'); // Amsterdam Format
        console.log(`<span style="color:${colors[type]}">[${timeStr}] ${msg}</span>`);
    },
    
    report: function(stats) {
        if (Game.time % 20 !== 0) return;

        console.log(`\n<span style="color:#53d2b7; font-weight:bold;">--- SCOS HEARTBEAT ${Game.time} ---</span>`);
        
        // GLOBAL LINE
        const cpu = stats.cpu ? stats.cpu.toFixed(1) : '0.0';
        const bucketStr = stats.bucket === 10000 ? `<span style="color:#00ffcc">10k</span>` : stats.bucket;
        const recycleStr = stats.recycling > 0 ? ` | <span style="color:#ffb766">♻️ ${stats.recycling} recycling</span>` : '';
        
        console.log(`🌍 GLOBAL | Pop: ${stats.pop}/${stats.cap} | CPU: ${cpu} (Bucket: ${bucketStr})${recycleStr}`);

        // QUEUE LINE
        const queueInfo = (stats.queue && stats.queue.length) ? stats.queue.slice(0, 5).join(' ➔ ') : '<span style="color:#9db0c6">clear</span>';
        console.log(`📋 QUEUE  | ${queueInfo}`);

        // DEFENSE LINE
        const def = stats.defense;
        if (def && def.active) {
            console.log(`🚨 DEFENSE| ALERT in ${def.room}! Def: ${def.current}/${def.need} Heal: ${def.currentHealers}/${def.healerNeed} | Threat (H/T/E): ${def.homeThreat}/${def.targetThreat}/${def.expansionThreat}`);
        }

        // ROOMS
        if (stats.rooms && stats.rooms.length) {
            stats.rooms.forEach(r => {
                const rclStr = r.rcl > 0 ? `RCL ${r.rcl}` : 'Unclaimed';
                const spawnStr = r.spawns.length > 0 ? r.spawns.join(', ') : '<span style="color:#9db0c6">No Spawns</span>';
                
                console.log(`<span style="color:#53d2b7; font-weight:bold;">[${r.label}] ${r.name}</span> <span style="color:#9db0c6">(${rclStr}) | NRG: ${r.nrg}/${r.cap} | Spawns: ${spawnStr} | TTL: ${r.ttl}</span>`);
                console.log(`  └─ ${r.roles}`);
            });
        }
        console.log('');
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
