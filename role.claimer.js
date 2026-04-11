/**
 * role.claimer.js - SCOS v6.1.0
 * Updated: 2026-02-13 CET (Europe/Amsterdam)
 * Behavior:
 *  - targetRoom: creep.memory.targetRoom || rooms.EXPANSION || rooms.TARGET
 *  - mode: creep.memory.claimMode = "claim" | "reserve" (default reserve)
 */
const rooms = require('config.rooms');

module.exports = {
    run: function (creep) {

        const targetRoom = creep.memory.targetRoom || rooms.TARGET;
        const mode = creep.memory.claimMode || "reserve"; // safer default

        // Travel to target room
        if (creep.room.name !== targetRoom) {
            creep.moveTo(new RoomPosition(25, 25, targetRoom), { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
            creep.say('Move:' + targetRoom);
            return;
        }

        // --- BORDER BOUNCE FIX ---
        if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
            creep.moveTo(new RoomPosition(25, 25, creep.room.name));
            return;
        }

        // In target room: act on controller
        const ctrl = creep.room.controller;
        if (!ctrl) return;

        if (mode === "claim") {
            if (ctrl.my) {
                creep.say('Done');
                creep.memory.recycle = true;
                return;
            }
            const res = creep.claimController(ctrl);
            if (res === ERR_NOT_IN_RANGE) {
                creep.moveTo(ctrl, { visualizePathStyle: { stroke: '#ffffff' } });
            } else if (res === ERR_GCL_NOT_ENOUGH) {
                creep.say('GCL Max');
                creep.memory.claimMode = 'reserve'; // Auto-downgrade auf Reserve für zukünftige Ticks
                if (creep.reserveController(ctrl) === ERR_NOT_IN_RANGE) creep.moveTo(ctrl);
            } else if (res === OK) {
                creep.say('Claim');
            }
            return;
        }

        // Default: reserve
        const res = creep.reserveController(ctrl);
        if (res === ERR_NOT_IN_RANGE) creep.moveTo(ctrl, { visualizePathStyle: { stroke: '#ffffff' } });
        else if (res === OK) creep.say('Reserve');
    }
};
