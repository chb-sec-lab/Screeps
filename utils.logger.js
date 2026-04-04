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
        const roleShort = {
            harvester: 'HARV',
            hauler: 'HAUL',
            scavenger: 'SCAV',
            repairer: 'REP',
            defender: 'DEF',
            remoteMiner: 'RMIN',
            builder: 'BLD',
            healer: 'HEAL',
            upgrader: 'UPG',
            claimer: 'CLM',
            vanguard: 'VAN',
            medic: 'MED',
            breacher: 'BRC',
            mineralMiner: 'MINM'
        };

        const pop = Object.entries(stats.census)
            .filter(([r, c]) => c > 0)
            .map(([r, c]) => `${roleShort[r] || r.toUpperCase()}:${c}`)
            .join(' | ');

        const roomInfo = stats.rooms
            ? `HOME:${stats.rooms.home} TARGET:${stats.rooms.target} EXP:${stats.rooms.expansion}`
            : 'HOME:? TARGET:? EXP:?';

        const mineralInfo = stats.assignments && stats.assignments.dynamicMineralMiners ? stats.assignments.dynamicMineralMiners.map(q => `MM@${q.room}:${q.current}/${q.required}`).join(' ') + ' ' : '';
        const assignmentInfo = stats.assignments
            ? `${mineralInfo}${stats.assignments.dynamicMiners ? stats.assignments.dynamicMiners.map(q => `HV@${q.room}:${q.current}/${q.required}`).join(' ') + ' ' : ''}B@H:${stats.assignments.homeBuilders || 0}/${stats.assignments.homeBuilderNeed || 1} B@T:${stats.assignments.targetBuilders || 0}/1 RP@T:${stats.assignments.targetRepairers || 0}/2 U@T:${stats.assignments.targetUpgraders || 0}/${stats.assignments.targetUpgraderNeed || 1} H@T:${stats.assignments.targetHaulers || 0}/1 B@M:${stats.assignments.miningBuilders || 0}/2 U@M:${stats.assignments.miningUpgraders || 0}/1 H@M:${stats.assignments.miningHaulers || 0}/1 RM@M:${stats.assignments.miningRemoteMiners || 0}/4 C@M:${stats.assignments.miningClaimers || 0}/1`
            : 'B@H:0/1 B@T:0/1 RP@T:0/2 U@T:0/1 H@T:0/1 B@M:0/2 U@M:0/1 H@M:0/1 RM@M:0/4 C@M:0/1';

        let spawnInfo = 'Spawn:none';
        if (stats.spawn) {
            if (stats.spawn.busy > 0) {
                spawnInfo = `Spawn:BUSY ${stats.spawn.busy}/${stats.spawn.total}`;
            } else {
                spawnInfo = `Spawn:IDLE ${stats.spawn.total}/${stats.spawn.total}`;
            }

            if (stats.spawn.actions && stats.spawn.actions.length) {
                spawnInfo += ` NEXT ${stats.spawn.actions.slice(0, 2).join(' | ')}`;
            } else if (stats.spawn.action) {
                spawnInfo = `Spawn:NEXT ${stats.spawn.action}`;
            }
        }

        const queueInfo = (stats.queue && stats.queue.length)
            ? stats.queue.slice(0, 5).join(' > ')
            : 'clear';

        const homeThreat = stats.defense ? (stats.defense.homeThreat || 0) : 0;
        const targetThreat = stats.defense ? (stats.defense.targetThreat || 0) : 0;
        const expansionThreat = stats.defense ? (stats.defense.expansionThreat || 0) : 0;
        const threatTriplet = `${homeThreat}/${targetThreat}/${expansionThreat}`;
        const defenseInfo = (stats.defense && stats.defense.active)
            ? `DEF ALERT room:${stats.defense.room} def:${stats.defense.current}/${stats.defense.need} heal:${stats.defense.currentHealers}/${stats.defense.healerNeed} threat(H/T/E):${threatTriplet}`
            : `DEF clear threat(H/T/E):${threatTriplet}`;

        console.log(`--- HEARTBEAT ${Game.time} ---`);
        console.log(`NRG ${stats.energy}/${stats.cap} | POP ${pop}`);
        console.log(`ROOMS ${roomInfo}`);
        console.log(`ASSIGN ${assignmentInfo}`);
        console.log(defenseInfo);
        console.log(`${spawnInfo} | QUEUE ${queueInfo}`);
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
