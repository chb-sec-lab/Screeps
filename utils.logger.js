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
            
        console.log(`--- HEARTBEAT ${Game.time} --- NRG: ${stats.energy}/${stats.cap} | POPS: ${pop}`);
    }
};