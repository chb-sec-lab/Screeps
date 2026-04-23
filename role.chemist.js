/**
 * role.chemist.js - SCOS Lab Technician
 * Verwaltet die Befüllung und Entleerung des Labor-Diamanten.
 */
const survival = require('utils.survival');

module.exports = {
    run: function(creep) {
        const workRoom = creep.memory.workRoom || creep.room.name;
        
        // --- UNIVERSAL SURVIVAL ---
        if (survival.fleeFromHostiles(creep)) return;

        if (creep.room.name !== workRoom) {
            const exit = creep.pos.findClosestByRange(creep.room.findExitTo(workRoom));
            if (exit) creep.moveTo(exit, { visualizePathStyle: { stroke: '#00ffff' } });
            return;
        }

        const ax = creep.room.memory.labAnchor ? creep.room.memory.labAnchor.x : null;
        const ay = creep.room.memory.labAnchor ? creep.room.memory.labAnchor.y : null;
        if (!ax) { creep.say('No Anchor'); return; }

        const labs = creep.room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_LAB });
        let in1 = null, in2 = null;
        let outputs = [];

        labs.forEach(l => {
            if (l.pos.x === ax && l.pos.y === ay + 1) in1 = l;
            else if (l.pos.x === ax + 1 && l.pos.y === ay + 2) in2 = l;
            else outputs.push(l);
        });

        if (!in1 || !in2) return;
        const reaction = creep.room.memory.reaction; // e.g. ['O', 'H']

        // --- 1. RUCKSACK LEEREN ---
        if (creep.store.getUsedCapacity() > 0) {
            const carried = Object.keys(creep.store)[0];
            
            if (reaction && carried === reaction[0] && in1.store.getFreeCapacity(carried) > 0) {
                if (creep.transfer(in1, carried) === ERR_NOT_IN_RANGE) creep.moveTo(in1);
                return;
            }
            if (reaction && carried === reaction[1] && in2.store.getFreeCapacity(carried) > 0) {
                if (creep.transfer(in2, carried) === ERR_NOT_IN_RANGE) creep.moveTo(in2);
                return;
            }

            const sink = creep.room.terminal || creep.room.storage;
            if (sink && creep.transfer(sink, carried) === ERR_NOT_IN_RANGE) creep.moveTo(sink);
            return;
        }

        // --- 2. OUTPUTS ABSAUGEN ---
        for (let out of outputs) {
            const outMin = Object.keys(out.store).find(k => k !== RESOURCE_ENERGY);
            if (outMin) {
                if (creep.withdraw(out, outMin) === ERR_NOT_IN_RANGE) creep.moveTo(out);
                return;
            }
        }

        // --- 3. FALSCHE INPUTS REINIGEN ---
        const in1Min = Object.keys(in1.store).find(k => k !== RESOURCE_ENERGY);
        if (in1Min && (!reaction || in1Min !== reaction[0])) {
            if (creep.withdraw(in1, in1Min) === ERR_NOT_IN_RANGE) creep.moveTo(in1);
            return;
        }
        
        const in2Min = Object.keys(in2.store).find(k => k !== RESOURCE_ENERGY);
        if (in2Min && (!reaction || in2Min !== reaction[1])) {
            if (creep.withdraw(in2, in2Min) === ERR_NOT_IN_RANGE) creep.moveTo(in2);
            return;
        }

        // --- 4. INPUTS BEFÜLLEN ---
        if (reaction) {
            const source = creep.room.terminal || creep.room.storage;
            if (source) {
                if (in1.store.getUsedCapacity(reaction[0]) < 2000 && source.store[reaction[0]] > 0) {
                    if (creep.withdraw(source, reaction[0]) === ERR_NOT_IN_RANGE) creep.moveTo(source);
                    return;
                }
                if (in2.store.getUsedCapacity(reaction[1]) < 2000 && source.store[reaction[1]] > 0) {
                    if (creep.withdraw(source, reaction[1]) === ERR_NOT_IN_RANGE) creep.moveTo(source);
                    return;
                }
            }
        }

        creep.say('Idle:Chem');
        if (creep.room.terminal && !creep.pos.inRangeTo(creep.room.terminal, 2)) creep.moveTo(creep.room.terminal);
    }
};