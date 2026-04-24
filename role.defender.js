/**
 * Role: Defender v5.4 (Remote Guard)
 * Logic: Hunter-Killer with Fixed Point Patrol.
 * UPDATE: Zieht aktiv in den Zielraum und hält Position bei (31, 3), wenn kein Feind da ist.
 */
const rooms = require('config.rooms');

module.exports = {
    run: function(creep) {
        const targetRoom = creep.memory.targetRoom || creep.memory.target || rooms.TARGET;
        const homeRoom = creep.memory.homeRoom || creep.memory.home || rooms.HOME;

        // --- 0. PRE-FLIGHT & TACTICAL RETREAT ---
        // Pit Stop: Wenn wir im sicheren Raum sind und nicht volle HP haben -> Warten auf Tower
        if (creep.room.name === homeRoom && creep.hits < creep.hitsMax) {
            creep.say('Wait:Heal');
            if (creep.getActiveBodyparts(HEAL) > 0) creep.heal(creep);
            
            // FIX: Bewege dich vom Ausgang weg, um Ping-Pong beim Retreat zu verhindern!
            if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                creep.moveTo(new RoomPosition(25, 25, creep.room.name));
            }
            return;
        }

        // Tactical Retreat: Wenn Lebenspunkte kritisch (< 40%) -> Flucht nach Hause
        if (creep.hits < creep.hitsMax * 0.4 && creep.room.name !== homeRoom) {
            creep.say('Retreating');
            if (creep.getActiveBodyparts(HEAL) > 0) creep.heal(creep);
            creep.moveTo(new RoomPosition(25, 25, homeRoom), {visualizePathStyle: {stroke: '#ffaa00'}, reusePath: 50});
            return;
        }
        
        // --- BORDER BOUNCE FIX ---
        if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
            creep.moveTo(new RoomPosition(25, 25, creep.room.name));
            return;
        }

        // --- 1. TARGET ACQUISITION ---
        const ALLIES = rooms.ALLIES || [];
        const hostiles = creep.room.find(FIND_HOSTILE_CREEPS, {
            filter: c => !ALLIES.includes(c.owner.username)
        });
        
        let target = null;
        if (hostiles.length > 0) {
            target = creep.pos.findClosestByRange(hostiles, { filter: c => c.getActiveBodyparts(HEAL) > 0 });
            if (!target) target = creep.pos.findClosestByRange(hostiles);
        }
        
        if (!target) {
            target = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_INVADER_CORE
            });
        }

        // --- 2. COMBAT ACTIONS ---
        if (target) {
            creep.rangedAttack(target);
            if (creep.pos.isNearTo(target)) creep.attack(target);
            creep.moveTo(target, {visualizePathStyle: {stroke: '#ff0000'}});
            creep.say('Attacking');
        } else {
            // Self-Heal if wounded and no enemy
            if (creep.hits < creep.hitsMax) creep.heal(creep);

            // --- 3. PATROL / GUARD POSITION ---
            if (creep.room.name !== targetRoom) {
                // Reise zum Zielraum
                creep.moveTo(new RoomPosition(25, 25, targetRoom), {visualizePathStyle: {stroke: '#ff0000'}, reusePath: 50});
                creep.say('Deploying');
            } else {
                // Im Zielraum: Halte Position in der Raummitte
                const guardPos = new RoomPosition(25, 25, targetRoom);
                if (!creep.pos.inRangeTo(guardPos, 2)) {
                    creep.moveTo(guardPos, {visualizePathStyle: {stroke: '#555555'}});
                    creep.say('Guarding');
                } else {
                    creep.say('Clear');
                }
            }
        }
    }
};
