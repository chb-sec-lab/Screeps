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
        const pop = Object.entries(stats.census)
            .filter(([r, c]) => c > 0)
            .map(([r, c]) => `${r[0].toUpperCase()}:${c}`)
            .join(' | ');

        const roomInfo = stats.rooms
            ? `HOME:${stats.rooms.home} TARGET:${stats.rooms.target} EXP:${stats.rooms.expansion}`
            : 'HOME:? TARGET:? EXP:?';

        const assignmentInfo = stats.assignments
            ? `B@T:${stats.assignments.targetBuilders || 0}/2 U@T:${stats.assignments.targetUpgraders || 0}/1 C@E:${stats.assignments.expansionClaimers || 0}/1 RM@E:${stats.assignments.expansionRemoteMiners || 0}/4 H@E:${stats.assignments.expansionHaulers || 0}/1`
            : 'B@T:0/2 U@T:0/1 C@E:0/1 RM@E:0/4 H@E:0/1';

        let spawnInfo = 'Spawn:none';
        if (stats.spawn) {
            if (stats.spawn.busy) {
                spawnInfo = `Spawn:BUSY ${stats.spawn.name} (${stats.spawn.remainingTime})`;
            } else if (stats.spawn.action) {
                spawnInfo = `Spawn:NEXT ${stats.spawn.action}`;
            } else {
                spawnInfo = 'Spawn:IDLE';
            }
        }

        const queueInfo = (stats.queue && stats.queue.length)
            ? stats.queue.slice(0, 5).join(' > ')
            : 'clear';

        console.log(`--- HEARTBEAT ${Game.time} ---`);
        console.log(`NRG ${stats.energy}/${stats.cap} | POP ${pop}`);
        console.log(`ROOMS ${roomInfo}`);
        console.log(`ASSIGN ${assignmentInfo}`);
        console.log(`${spawnInfo} | QUEUE ${queueInfo}`);
    }
};
